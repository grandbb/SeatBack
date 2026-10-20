// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin v5 — imported directly so Remix resolves without local node_modules
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/cryptography/ECDSA.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/cryptography/MessageHashUtils.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/interfaces/IERC1271.sol";

interface ISeatBackStaking {
    function receiveProceeds(uint256 amount) external;
}

/**
 * @title  SeatBack
 * @notice Event attendance escrow with EIP-712 QR check-in.
 *         No-show proceeds: 50% → staking pool, 50% → organiser.
 *
 * Constructor arguments:
 *   _usdc  — USDC token on Arc Mainnet: 0x3600000000000000000000000000000000000000
 *   _admin — wallet that can call setStakingPool() once: YOUR WALLET ADDRESS
 */
contract SeatBack is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 private constant _DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _CHECK_IN_AUTH_TYPE_HASH =
        keccak256("CheckInAuthorization(uint256 eventId,uint256 reservationId,address attendee,uint256 nonce,uint256 validAfter,uint256 validUntil)");

    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;
    bytes4  private constant _ERC1271_MAGIC = 0x1626ba7e;
    uint256 public  constant MAX_QR_VALIDITY = 5 * 60;

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        if (block.chainid == _CACHED_CHAIN_ID) return _CACHED_DOMAIN_SEPARATOR;
        return keccak256(abi.encode(_DOMAIN_TYPE_HASH, keccak256(bytes("SeatBack")), keccak256(bytes("1")), block.chainid, address(this)));
    }

    struct EventInfo {
        address organizer; address payoutWallet;
        string title; string description; string venue;
        uint256 eventStart; uint256 eventEnd;
        uint32 capacity; uint256 depositAmount;
        uint256 bookingClose; uint256 refundCutoff;
        uint256 checkInStart; uint256 checkInEnd;
        bool cancelled; bool checkInOpened; bool finalized;
    }
    struct ReservationInfo {
        uint256 eventId; address attendee;
        bool active; bool refundable; bool refundClaimed;
    }
    struct EventAccounting {
        uint256 activeDeposits; uint256 outstandingRefunds;
        uint256 organizerCredit; uint256 refundsPaid; uint256 organizerPaid;
    }
    struct CheckInAuthorization {
        uint256 eventId; uint256 reservationId; address attendee;
        uint256 nonce; uint256 validAfter; uint256 validUntil;
    }
    struct CreateEventParams {
        address payoutWallet; string title; string description; string venue;
        uint256 eventStart; uint256 eventEnd; uint32 capacity; uint256 depositAmount;
        uint256 bookingClose; uint256 refundCutoff; uint256 checkInStart; uint256 checkInEnd;
    }

    error InvalidAddress(); error InvalidCapacity(); error InvalidDeposit();
    error InvalidMetadata(string field); error InvalidTimestamps();
    error EventNotFound(); error EventCancelled_(); error EventNotCancelled();
    error BookingClosed(); error CapacityFull(); error AlreadyReserved();
    error NotAttendee(); error NotOrganizer(); error NotRefundable();
    error AlreadyClaimed(); error AlreadyCancelled(); error AlreadyFinalized();
    error AlreadyOpened(); error CheckInWindowClosed(); error CheckInNotOpen();
    error CheckInNotStarted(); error NoProceeds(); error NotActive();
    error TooEarlyToFinalize(); error QrExpired(); error QrNotYetValid();
    error QrValidityTooLong(); error InvalidSignature(); error NonceAlreadyUsed();
    error AttendeeWalletMismatch(); error StakingPoolAlreadySet(); error NotAdmin();

    IERC20 public immutable usdc;
    address public immutable admin;
    address public stakingPool;
    uint256 public stakerShareBps = 50;

    uint256 public eventCount;
    uint256 public reservationCount;
    mapping(uint256 => EventInfo) public events;
    mapping(uint256 => ReservationInfo) public reservations;
    mapping(uint256 => EventAccounting) public accounting;
    mapping(uint256 => uint32) public reservedSeats;
    mapping(uint256 => mapping(address => uint256)) public activeReservationId;
    mapping(uint256 => uint256[]) private eventReservationIds;
    mapping(uint256 => mapping(uint256 => bool)) public usedNonces;

    event EventCreated(uint256 indexed eventId, address indexed organizer, address payoutWallet, uint256 depositAmount, uint256 capacity, uint256 bookingClose, uint256 refundCutoff, uint256 checkInStart, uint256 checkInEnd);
    event Reserved(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee, uint256 depositAmount);
    event ReservationCancelled(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee);
    event CheckInOpened(uint256 indexed eventId);
    event CheckedIn(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee);
    event EventCancelled(uint256 indexed eventId);
    event EventFinalized(uint256 indexed eventId, uint256 noShowProceeds, uint256 refundLiability);
    event RefundClaimed(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee, uint256 amount);
    event ProceedsWithdrawn(uint256 indexed eventId, address indexed payoutWallet, uint256 amount);
    event StakingPoolSet(address indexed pool);
    event StakerProceedsRouted(uint256 indexed eventId, address indexed pool, uint256 stakerAmount, uint256 organiserAmount);

    constructor(address _usdc, address _admin) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_admin == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        admin = _admin;
        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = keccak256(abi.encode(_DOMAIN_TYPE_HASH, keccak256(bytes("SeatBack")), keccak256(bytes("1")), block.chainid, address(this)));
    }

    function setStakingPool(address _pool) external {
        if (msg.sender != admin) revert NotAdmin();
        if (stakingPool != address(0)) revert StakingPoolAlreadySet();
        if (_pool == address(0)) revert InvalidAddress();
        stakingPool = _pool;
        emit StakingPoolSet(_pool);
    }

    function createEvent(CreateEventParams calldata p) external returns (uint256 eventId) {
        if (p.payoutWallet == address(0)) revert InvalidAddress();
        if (p.capacity == 0) revert InvalidCapacity();
        if (p.depositAmount == 0) revert InvalidDeposit();
        _validateMetadata(p.title, 120, "title");
        _validateMetadata(p.description, 500, "description");
        _validateMetadata(p.venue, 200, "venue");
        if (block.timestamp >= p.bookingClose || p.bookingClose > p.refundCutoff || p.refundCutoff > p.checkInStart || p.checkInStart >= p.checkInEnd) revert InvalidTimestamps();
        eventId = eventCount++;
        events[eventId] = EventInfo(msg.sender, p.payoutWallet, p.title, p.description, p.venue, p.eventStart, p.eventEnd, p.capacity, p.depositAmount, p.bookingClose, p.refundCutoff, p.checkInStart, p.checkInEnd, false, false, false);
        emit EventCreated(eventId, msg.sender, p.payoutWallet, p.depositAmount, p.capacity, p.bookingClose, p.refundCutoff, p.checkInStart, p.checkInEnd);
    }

    function reserve(uint256 eventId) external nonReentrant {
        if (eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[eventId];
        if (evt.cancelled) revert EventCancelled_();
        if (block.timestamp >= evt.bookingClose) revert BookingClosed();
        if (reservedSeats[eventId] >= evt.capacity) revert CapacityFull();
        if (activeReservationId[eventId][msg.sender] != 0) revert AlreadyReserved();
        uint256 rid = ++reservationCount;
        reservations[rid] = ReservationInfo(eventId, msg.sender, true, false, false);
        activeReservationId[eventId][msg.sender] = rid;
        eventReservationIds[eventId].push(rid);
        reservedSeats[eventId]++;
        accounting[eventId].activeDeposits += evt.depositAmount;
        usdc.safeTransferFrom(msg.sender, address(this), evt.depositAmount);
        emit Reserved(eventId, rid, msg.sender, evt.depositAmount);
    }

    function cancelReservation(uint256 reservationId) external nonReentrant {
        ReservationInfo storage res = reservations[reservationId];
        if (res.attendee != msg.sender) revert NotAttendee();
        if (!res.active) revert NotActive();
        if (res.refundClaimed) revert AlreadyClaimed();
        EventInfo storage evt = events[res.eventId];
        if (evt.cancelled) revert EventCancelled_();
        if (block.timestamp >= evt.refundCutoff) revert BookingClosed();
        uint256 eid = res.eventId; uint256 dep = evt.depositAmount;
        res.active = false; res.refundable = true;
        activeReservationId[eid][msg.sender] = 0;
        reservedSeats[eid]--;
        accounting[eid].activeDeposits -= dep;
        accounting[eid].outstandingRefunds += dep;
        emit ReservationCancelled(eid, reservationId, msg.sender);
    }

    function openCheckIn(uint256 eventId) external {
        if (eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled_();
        if (evt.checkInOpened) revert AlreadyOpened();
        if (block.timestamp < evt.checkInStart) revert CheckInNotStarted();
        if (block.timestamp >= evt.checkInEnd) revert CheckInWindowClosed();
        evt.checkInOpened = true;
        emit CheckInOpened(eventId);
    }

    function checkIn(uint256 eventId, address attendee) external {
        if (eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled_();
        if (!evt.checkInOpened) revert CheckInNotOpen();
        if (block.timestamp >= evt.checkInEnd) revert CheckInWindowClosed();
        uint256 rid = activeReservationId[eventId][attendee];
        if (rid == 0) revert NotActive();
        ReservationInfo storage res = reservations[rid];
        if (!res.active) revert NotActive();
        res.active = false; res.refundable = true;
        activeReservationId[eventId][attendee] = 0;
        accounting[eventId].activeDeposits -= evt.depositAmount;
        accounting[eventId].outstandingRefunds += evt.depositAmount;
        emit CheckedIn(eventId, rid, attendee);
    }

    function checkInWithSig(CheckInAuthorization calldata auth, bytes calldata sig) external nonReentrant {
        _verifyCheckInAuth(auth, sig);
        _applyCheckIn(auth);
    }

    function cancelEvent(uint256 eventId) external {
        if (eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert AlreadyCancelled();
        if (block.timestamp >= evt.checkInEnd) revert CheckInWindowClosed();
        evt.cancelled = true;
        accounting[eventId].outstandingRefunds += accounting[eventId].activeDeposits;
        accounting[eventId].activeDeposits = 0;
        emit EventCancelled(eventId);
    }

    function finalizeEvent(uint256 eventId) external {
        if (eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[eventId];
        if (evt.cancelled) revert EventCancelled_();
        if (block.timestamp < evt.checkInEnd) revert TooEarlyToFinalize();
        if (!evt.finalized) _finalizeEvent(eventId);
    }

    function claimRefund(uint256 reservationId) external nonReentrant {
        ReservationInfo storage res = reservations[reservationId];
        if (res.attendee == address(0)) revert NotRefundable();
        if (res.refundClaimed) revert AlreadyClaimed();
        uint256 eid = res.eventId;
        EventInfo storage evt = events[eid];
        if (!res.refundable) {
            if (evt.cancelled && res.active) {
                res.active = false; res.refundable = true;
                activeReservationId[eid][res.attendee] = 0;
            } else if (!evt.cancelled && block.timestamp >= evt.checkInEnd) {
                if (!evt.finalized) _finalizeEvent(eid);
                if (!evt.checkInOpened && res.active) {
                    res.active = false; res.refundable = true;
                    activeReservationId[eid][res.attendee] = 0;
                } else revert NotRefundable();
            } else revert NotRefundable();
        }
        uint256 amount = evt.depositAmount;
        res.refundClaimed = true;
        accounting[eid].outstandingRefunds -= amount;
        accounting[eid].refundsPaid += amount;
        usdc.safeTransfer(res.attendee, amount);
        emit RefundClaimed(eid, reservationId, res.attendee, amount);
    }

    function withdrawNoShowProceeds(uint256 eventId) external nonReentrant {
        if (eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled_();
        if (!evt.finalized) {
            if (block.timestamp < evt.checkInEnd) revert TooEarlyToFinalize();
            _finalizeEvent(eventId);
        }
        EventAccounting storage acc = accounting[eventId];
        uint256 total = acc.organizerCredit;
        if (total == 0) revert NoProceeds();
        acc.organizerCredit = 0;
        address pool = stakingPool;
        uint256 stakerAmt = (pool != address(0)) ? (total * stakerShareBps) / 100 : 0;
        uint256 orgAmt = total - stakerAmt;
        acc.organizerPaid += orgAmt;
        if (orgAmt > 0) usdc.safeTransfer(evt.payoutWallet, orgAmt);
        emit ProceedsWithdrawn(eventId, evt.payoutWallet, orgAmt);
        if (stakerAmt > 0 && pool != address(0)) {
            usdc.safeTransfer(pool, stakerAmt);
            try ISeatBackStaking(pool).receiveProceeds(stakerAmt) {} catch {}
            emit StakerProceedsRouted(eventId, pool, stakerAmt, orgAmt);
        }
    }

    function getEvent(uint256 id) external view returns (EventInfo memory) { if (id >= eventCount) revert EventNotFound(); return events[id]; }
    function getAccounting(uint256 id) external view returns (EventAccounting memory) { if (id >= eventCount) revert EventNotFound(); return accounting[id]; }
    function getReservation(uint256 id) external view returns (ReservationInfo memory) { return reservations[id]; }
    function getActiveReservation(uint256 eid, address attendee) external view returns (uint256) { if (eid >= eventCount) revert EventNotFound(); return activeReservationId[eid][attendee]; }
    function getEventReservations(uint256 eid, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (eid >= eventCount) revert EventNotFound();
        uint256[] storage all = eventReservationIds[eid];
        uint256 total = all.length;
        if (offset >= total || limit == 0) return new uint256[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        ids = new uint256[](end - offset);
        for (uint256 i = 0; i < ids.length; i++) ids[i] = all[offset + i];
    }
    function getCheckInDigest(CheckInAuthorization calldata auth) external view returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), keccak256(abi.encode(_CHECK_IN_AUTH_TYPE_HASH, auth.eventId, auth.reservationId, auth.attendee, auth.nonce, auth.validAfter, auth.validUntil)));
    }

    function _verifyCheckInAuth(CheckInAuthorization calldata auth, bytes calldata sig) internal view {
        if (auth.eventId >= eventCount) revert EventNotFound();
        EventInfo storage evt = events[auth.eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled_();
        if (!evt.checkInOpened) revert CheckInNotOpen();
        if (block.timestamp >= evt.checkInEnd) revert CheckInWindowClosed();
        if (auth.validUntil > evt.checkInEnd) revert QrValidityTooLong();
        if (block.timestamp < auth.validAfter) revert QrNotYetValid();
        if (block.timestamp >= auth.validUntil) revert QrExpired();
        if (auth.validUntil - auth.validAfter > MAX_QR_VALIDITY) revert QrValidityTooLong();
        ReservationInfo storage res = reservations[auth.reservationId];
        if (res.attendee != auth.attendee) revert AttendeeWalletMismatch();
        if (res.eventId != auth.eventId) revert AttendeeWalletMismatch();
        if (!res.active) revert NotActive();
        if (activeReservationId[auth.eventId][auth.attendee] != auth.reservationId) revert NotActive();
        if (usedNonces[auth.reservationId][auth.nonce]) revert NonceAlreadyUsed();
        if (!_verifySig(auth, sig)) revert InvalidSignature();
    }

    function _verifySig(CheckInAuthorization calldata auth, bytes calldata sig) internal view returns (bool) {
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), keccak256(abi.encode(_CHECK_IN_AUTH_TYPE_HASH, auth.eventId, auth.reservationId, auth.attendee, auth.nonce, auth.validAfter, auth.validUntil)));
        address recovered = _tryRecover(digest, sig);
        if (recovered != address(0) && recovered == auth.attendee) return true;
        return _checkERC1271(auth.attendee, digest, sig);
    }

    function _applyCheckIn(CheckInAuthorization calldata auth) internal {
        usedNonces[auth.reservationId][auth.nonce] = true;
        ReservationInfo storage res = reservations[auth.reservationId];
        res.active = false; res.refundable = true;
        activeReservationId[auth.eventId][auth.attendee] = 0;
        uint256 dep = events[auth.eventId].depositAmount;
        accounting[auth.eventId].activeDeposits -= dep;
        accounting[auth.eventId].outstandingRefunds += dep;
        emit CheckedIn(auth.eventId, auth.reservationId, auth.attendee);
    }

    function _validateMetadata(string calldata value, uint256 maxBytes, string memory field) internal pure {
        uint256 len = bytes(value).length;
        if (len == 0 || len > maxBytes) revert InvalidMetadata(field);
    }

    function _finalizeEvent(uint256 eventId) internal {
        EventInfo storage evt = events[eventId];
        if (evt.finalized) revert AlreadyFinalized();
        EventAccounting storage acc = accounting[eventId];
        uint256 active = acc.activeDeposits;
        uint256 noShow; uint256 refundLiab;
        evt.finalized = true;
        if (active > 0) {
            if (evt.checkInOpened) { acc.organizerCredit += active; noShow = active; }
            else { acc.outstandingRefunds += active; refundLiab = active; }
            acc.activeDeposits = 0;
        }
        emit EventFinalized(eventId, noShow, refundLiab);
    }

    function _tryRecover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        (address r, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
        if (err != ECDSA.RecoverError.NoError) return address(0);
        return r;
    }

    function _checkERC1271(address wallet, bytes32 digest, bytes calldata sig) internal view returns (bool) {
        if (wallet.code.length == 0) return false;
        try IERC1271(wallet).isValidSignature(digest, sig) returns (bytes4 magic) {
            return magic == _ERC1271_MAGIC;
        } catch { return false; }
    }
}
