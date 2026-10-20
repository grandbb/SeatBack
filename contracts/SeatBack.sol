// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @dev Minimal interface for pushing USDC proceeds into the staking pool.
interface ISeatBackStaking {
    function receiveProceeds(uint256 amount) external;
}

/**
 * @title SeatBack
 * @notice Event attendance escrow contract with EIP-712 QR check-in authorization.
 *
 * Check-in flow:
 *  1. Attendee signs a CheckInAuthorization struct off-chain (EIP-712).
 *     The payload is bound to: chainId, this contract, eventId, reservationId,
 *     attendee wallet, a nonce (unique per reservation), validAfter, validUntil
 *     (max 5 minutes, capped to checkInEnd).
 *  2. The signed payload is encoded as a QR code shown to the organizer.
 *  3. Organizer scans and explicitly submits checkInWithSig(), which verifies:
 *     - caller is the event organizer
 *     - check-in window is open
 *     - time bounds are satisfied (not premature, not expired)
 *     - signature is from the attendee wallet (EOA via ECDSA or SCA via ERC-1271)
 *     - nonce has not been consumed
 *     - reservation is active and belongs to the attendee
 *  4. On success the nonce is consumed and attendance is attested on-chain.
 *
 * Supported wallets:
 *  - EOA wallets (ECDSA, the common case)
 *  - Smart contract accounts implementing ERC-1271 (e.g. Safe, Argent)
 *  Wallets that do not implement either are not supported for QR check-in;
 *  the organizer may still use the direct checkIn(eventId, attendee) path.
 */
contract SeatBack is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ─── EIP-712 ─────────────────────────────────────────────────────────────

    bytes32 private constant _DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private constant _CHECK_IN_AUTH_TYPE_HASH =
        keccak256(
            "CheckInAuthorization(uint256 eventId,uint256 reservationId,address attendee,uint256 nonce,uint256 validAfter,uint256 validUntil)"
        );

    /// @dev Cached domain separator set at construction time.
    ///      _domainChainId caches the deployment-time chainId.
    ///      _domainSeparator() returns a freshly-computed separator on any fork.
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;

    /// @notice Returns the EIP-712 domain separator.
    ///         Always reflects the current chain ID — safe across forks.
    ///         The cached path is used on normal execution to save gas.
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        if (block.chainid == _CACHED_CHAIN_ID) {
            return _CACHED_DOMAIN_SEPARATOR;
        }
        return keccak256(
            abi.encode(
                _DOMAIN_TYPE_HASH,
                keccak256(bytes("SeatBack")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /// @dev Magic return value required by ERC-1271
    bytes4 private constant _ERC1271_MAGIC = 0x1626ba7e;

    /// @notice Maximum QR validity window in seconds (5 minutes)
    uint256 public constant MAX_QR_VALIDITY = 5 * 60;

    // ─── State ────────────────────────────────────────────────────────────────

    struct EventInfo {
        address organizer;
        address payoutWallet;
        string title;
        string description;
        string venue;
        uint256 eventStart;
        uint256 eventEnd;
        uint32 capacity;
        uint256 depositAmount;
        uint256 bookingClose;
        uint256 refundCutoff;
        uint256 checkInStart;
        uint256 checkInEnd;
        bool cancelled;
        bool checkInOpened;
        bool finalized;
    }

    struct ReservationInfo {
        uint256 eventId;
        address attendee;
        bool active;
        bool refundable;
        bool refundClaimed;
    }

    struct EventAccounting {
        uint256 activeDeposits;
        uint256 outstandingRefunds;
        uint256 organizerCredit;
        uint256 refundsPaid;
        uint256 organizerPaid;
        uint256 stakerPaid; // tracks USDC routed to staking pool for auditability
    }

    /// @notice The EIP-712 typed-data struct that the attendee signs for QR check-in.
    struct CheckInAuthorization {
        uint256 eventId;
        uint256 reservationId;
        address attendee;
        uint256 nonce;
        uint256 validAfter;
        uint256 validUntil;
    }

    error InvalidAddress();
    error InvalidCapacity();
    error InvalidDeposit();
    error InvalidMetadata(string field);
    error InvalidTimestamps();
    error EventNotFound();
    error EventCancelled_();
    error EventNotCancelled();
    error BookingClosed();
    error CapacityFull();
    error AlreadyReserved();
    error NotAttendee();
    error NotOrganizer();
    error NotRefundable();
    error AlreadyClaimed();
    error AlreadyCancelled();
    error AlreadyFinalized();
    error AlreadyOpened();
    error CheckInWindowClosed();
    error CheckInNotOpen();
    error CheckInNotStarted();
    error NoProceeds();
    error NotActive();
    error TooEarlyToFinalize();
    error QrExpired();
    error QrNotYetValid();
    error QrValidityTooLong();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error AttendeeWalletMismatch();

    IERC20 public immutable usdc;

    // ─── Staking pool ─────────────────────────────────────────────────────────

    /// @notice Address of the SeatBackStaking contract.
    ///         When set, 50% of no-show proceeds are pushed here; organiser gets 50%.
    ///         When zero, 100% goes to the organiser (backward-compatible).
    address public stakingPool;

    /// @notice Numerator of the staker share (out of 100). Default 50 (50% stakers / 50% organiser).
    uint256 public stakerShareBps = 50;

    /// @notice Owner / deployer who can set the staking pool address once.
    address public immutable admin;

    error NotAdmin();

    /**
     * @notice Set or update the staking pool address.
     *         Can be updated by admin at any time (rotatable for upgrades/recovery).
     *         Pass address(0) to disable routing (100% to organiser).
     * @param _pool New staking pool address, or address(0) to disable.
     */
    function setStakingPool(address _pool) external {
        if (msg.sender != admin) revert NotAdmin();
        // allow address(0) to disable routing; require contract if non-zero
        if (_pool != address(0) && _pool.code.length == 0) revert InvalidAddress();
        stakingPool = _pool;
        emit StakingPoolSet(_pool);
    }

    uint256 public eventCount;
    mapping(uint256 => EventInfo) public events;

    mapping(uint256 => ReservationInfo) public reservations;
    uint256 public reservationCount;

    mapping(uint256 => EventAccounting) public accounting;
    mapping(uint256 => uint32) public reservedSeats;
    mapping(uint256 => mapping(address => uint256)) public activeReservationId;
    mapping(uint256 => uint256[]) private eventReservationIds;

    /// @notice Consumed QR nonces: reservationId => nonce => used
    mapping(uint256 => mapping(uint256 => bool)) public usedNonces;

    // ─── Events ───────────────────────────────────────────────────────────────

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        address payoutWallet,
        uint256 depositAmount,
        uint256 capacity,
        uint256 bookingClose,
        uint256 refundCutoff,
        uint256 checkInStart,
        uint256 checkInEnd
    );
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

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _usdc, address _admin) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_admin == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        admin = _admin;

        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                _DOMAIN_TYPE_HASH,
                keccak256(bytes("SeatBack")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ─── Event management ────────────────────────────────────────────────────

    /// @notice Input struct for createEvent to avoid stack-too-deep.
    struct CreateEventParams {
        address payoutWallet;
        string title;
        string description;
        string venue;
        uint256 eventStart;
        uint256 eventEnd;
        uint32 capacity;
        uint256 depositAmount;
        uint256 bookingClose;
        uint256 refundCutoff;
        uint256 checkInStart;
        uint256 checkInEnd;
    }

    function createEvent(CreateEventParams calldata p) external returns (uint256 eventId) {
        if (p.payoutWallet == address(0)) revert InvalidAddress();
        if (p.capacity == 0) revert InvalidCapacity();
        if (p.depositAmount == 0) revert InvalidDeposit();

        _validateMetadata(p.title, 120, "title");
        _validateMetadata(p.description, 500, "description");
        _validateMetadata(p.venue, 200, "venue");

        if (
            block.timestamp >= p.bookingClose ||
            p.bookingClose > p.refundCutoff ||
            p.refundCutoff > p.checkInStart ||
            p.checkInStart >= p.checkInEnd
        ) {
            revert InvalidTimestamps();
        }

        eventId = eventCount;
        eventCount = eventId + 1;

        events[eventId] = EventInfo({
            organizer: msg.sender,
            payoutWallet: p.payoutWallet,
            title: p.title,
            description: p.description,
            venue: p.venue,
            eventStart: p.eventStart,
            eventEnd: p.eventEnd,
            capacity: p.capacity,
            depositAmount: p.depositAmount,
            bookingClose: p.bookingClose,
            refundCutoff: p.refundCutoff,
            checkInStart: p.checkInStart,
            checkInEnd: p.checkInEnd,
            cancelled: false,
            checkInOpened: false,
            finalized: false
        });

        emit EventCreated(
            eventId,
            msg.sender,
            p.payoutWallet,
            p.depositAmount,
            p.capacity,
            p.bookingClose,
            p.refundCutoff,
            p.checkInStart,
            p.checkInEnd
        );
    }

    // ─── Reservation ─────────────────────────────────────────────────────────

    function reserve(uint256 eventId) external nonReentrant {
        if (eventId >= eventCount) revert EventNotFound();

        EventInfo storage evt = events[eventId];
        if (evt.cancelled) revert EventCancelled_();
        if (block.timestamp >= evt.bookingClose) revert BookingClosed();
        if (reservedSeats[eventId] >= evt.capacity) revert CapacityFull();
        if (activeReservationId[eventId][msg.sender] != 0) revert AlreadyReserved();

        reservationCount += 1;
        uint256 reservationId = reservationCount;

        reservations[reservationId] = ReservationInfo({
            eventId: eventId,
            attendee: msg.sender,
            active: true,
            refundable: false,
            refundClaimed: false
        });

        activeReservationId[eventId][msg.sender] = reservationId;
        eventReservationIds[eventId].push(reservationId);
        reservedSeats[eventId] += 1;

        accounting[eventId].activeDeposits += evt.depositAmount;

        usdc.safeTransferFrom(msg.sender, address(this), evt.depositAmount);

        emit Reserved(eventId, reservationId, msg.sender, evt.depositAmount);
    }

    function cancelReservation(uint256 reservationId) external nonReentrant {
        ReservationInfo storage res = reservations[reservationId];
        if (res.attendee != msg.sender) revert NotAttendee();
        if (!res.active) revert NotActive();
        if (res.refundClaimed) revert AlreadyClaimed();

        EventInfo storage evt = events[res.eventId];
        if (evt.cancelled) revert EventCancelled_();
        if (block.timestamp >= evt.refundCutoff) revert BookingClosed();

        uint256 eventId = res.eventId;
        uint256 depositAmount = evt.depositAmount;

        res.active = false;
        res.refundable = true;

        activeReservationId[eventId][msg.sender] = 0;
        reservedSeats[eventId] -= 1;

        accounting[eventId].activeDeposits -= depositAmount;
        accounting[eventId].outstandingRefunds += depositAmount;

        emit ReservationCancelled(eventId, reservationId, msg.sender);
    }

    // ─── Check-in ────────────────────────────────────────────────────────────

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

    /**
     * @notice Direct check-in by the organizer (no QR signature required).
     * @dev Use this path only when the attendee cannot produce a QR
     *      (e.g. camera failure) or as a fallback. The organizer bears
     *      responsibility for verifying identity by other means.
     */
    function checkIn(uint256 eventId, address attendee) external {
        if (eventId >= eventCount) revert EventNotFound();

        EventInfo storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled_();
        if (!evt.checkInOpened) revert CheckInNotOpen();
        if (block.timestamp >= evt.checkInEnd) revert CheckInWindowClosed();

        uint256 reservationId = activeReservationId[eventId][attendee];
        if (reservationId == 0) revert NotActive();

        ReservationInfo storage res = reservations[reservationId];
        if (!res.active) revert NotActive();

        uint256 depositAmount = evt.depositAmount;

        res.active = false;
        res.refundable = true;

        activeReservationId[eventId][attendee] = 0;

        accounting[eventId].activeDeposits -= depositAmount;
        accounting[eventId].outstandingRefunds += depositAmount;

        emit CheckedIn(eventId, reservationId, attendee);
    }

    /**
     * @notice Check in an attendee using an EIP-712 signed QR authorization.
     * @dev Called by the organizer after scanning the attendee's QR code.
     *
     * Security properties:
     *  - Domain binds to this contract address and chain ID — cross-chain / cross-contract replays are rejected.
     *  - reservationId binds the QR to one booking instance — stale QRs from cancelled/rebooked reservations are rejected.
     *  - nonce is consumed on first use — replay within the same reservation is rejected.
     *  - validAfter / validUntil limit the window (max MAX_QR_VALIDITY = 5 min, capped to checkInEnd).
     *  - attendee field in the payload is matched against reservation.attendee — wallet substitution is rejected.
     *  - Supports EOA (ECDSA) and smart-contract wallets that implement ERC-1271.
     *
     * @param auth  The typed-data payload (must match what the attendee signed).
     * @param sig   The attendee's EIP-712 signature over auth.
     */
    function checkInWithSig(
        CheckInAuthorization calldata auth,
        bytes calldata sig
    ) external nonReentrant {
        _verifyCheckInAuth(auth, sig);
        _applyCheckIn(auth);
    }

    /// @dev Validates organizer, event state, time bounds, reservation, nonce, and signature.
    function _verifyCheckInAuth(
        CheckInAuthorization calldata auth,
        bytes calldata sig
    ) internal view {
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

    /// @dev Verifies EIP-712 signature — EOA first, then ERC-1271.
    function _verifySig(
        CheckInAuthorization calldata auth,
        bytes calldata sig
    ) internal view returns (bool) {
        bytes32 digest = MessageHashUtils.toTypedDataHash(
            DOMAIN_SEPARATOR(),
            keccak256(abi.encode(
                _CHECK_IN_AUTH_TYPE_HASH,
                auth.eventId,
                auth.reservationId,
                auth.attendee,
                auth.nonce,
                auth.validAfter,
                auth.validUntil
            ))
        );
        address recovered = _tryRecover(digest, sig);
        if (recovered != address(0) && recovered == auth.attendee) return true;
        return _checkERC1271(auth.attendee, digest, sig);
    }

    /// @dev Applies state changes after successful auth verification.
    function _applyCheckIn(CheckInAuthorization calldata auth) internal {
        usedNonces[auth.reservationId][auth.nonce] = true;

        ReservationInfo storage res = reservations[auth.reservationId];
        res.active = false;
        res.refundable = true;
        activeReservationId[auth.eventId][auth.attendee] = 0;

        uint256 deposit = events[auth.eventId].depositAmount;
        accounting[auth.eventId].activeDeposits -= deposit;
        accounting[auth.eventId].outstandingRefunds += deposit;

        emit CheckedIn(auth.eventId, auth.reservationId, auth.attendee);
    }

    // ─── Event lifecycle ──────────────────────────────────────────────────────

    function cancelEvent(uint256 eventId) external {
        if (eventId >= eventCount) revert EventNotFound();

        EventInfo storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert AlreadyCancelled();
        if (block.timestamp >= evt.checkInEnd) revert CheckInWindowClosed();

        evt.cancelled = true;

        EventAccounting storage acc = accounting[eventId];
        acc.outstandingRefunds += acc.activeDeposits;
        acc.activeDeposits = 0;

        emit EventCancelled(eventId);
    }

    function finalizeEvent(uint256 eventId) external {
        if (eventId >= eventCount) revert EventNotFound();

        EventInfo storage evt = events[eventId];
        if (evt.cancelled) revert EventCancelled_();
        if (block.timestamp < evt.checkInEnd) revert TooEarlyToFinalize();
        if (evt.finalized) {
            return;
        }

        _finalizeEvent(eventId);
    }

    function claimRefund(uint256 reservationId) external nonReentrant {
        ReservationInfo storage res = reservations[reservationId];
        if (res.attendee == address(0)) revert NotRefundable();
        if (res.refundClaimed) revert AlreadyClaimed();

        uint256 eventId = res.eventId;
        EventInfo storage evt = events[eventId];

        if (!res.refundable) {
            if (evt.cancelled && res.active) {
                res.active = false;
                res.refundable = true;
                activeReservationId[eventId][res.attendee] = 0;
            } else if (!evt.cancelled && block.timestamp >= evt.checkInEnd) {
                if (!evt.finalized) {
                    _finalizeEvent(eventId);
                }

                if (!evt.checkInOpened && res.active) {
                    res.active = false;
                    res.refundable = true;
                    activeReservationId[eventId][res.attendee] = 0;
                } else {
                    revert NotRefundable();
                }
            } else {
                revert NotRefundable();
            }
        }

        uint256 amount = evt.depositAmount;

        res.refundClaimed = true;

        EventAccounting storage acc = accounting[eventId];
        acc.outstandingRefunds -= amount;
        acc.refundsPaid += amount;

        usdc.safeTransfer(res.attendee, amount);

        emit RefundClaimed(eventId, reservationId, res.attendee, amount);
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
        uint256 totalAmount = acc.organizerCredit;
        if (totalAmount == 0) revert NoProceeds();

        acc.organizerCredit = 0;

        address pool = stakingPool;
        uint256 stakerAmount = 0;
        uint256 organiserAmount = totalAmount;

        if (pool != address(0) && totalAmount > 0) {
            // 50% → staking pool, 50% → organiser
            stakerAmount = (totalAmount * stakerShareBps) / 100;
            organiserAmount = totalAmount - stakerAmount;
        }

        // ── Pay organiser first (isolation: organiser share is never at risk) ──
        acc.organizerPaid += organiserAmount;
        if (organiserAmount > 0) {
            usdc.safeTransfer(evt.payoutWallet, organiserAmount);
        }
        emit ProceedsWithdrawn(eventId, evt.payoutWallet, organiserAmount);

        // ── Route staker share: transfer THEN notify (best-effort, non-blocking) ──
        if (stakerAmount > 0 && pool != address(0)) {
            // Transfer USDC to staking pool, then notify it (receiveProceeds).
            // Notify failure is caught and ignored — USDC is already at the pool;
            // the pool operator can reconcile via balance delta.
            acc.stakerPaid += stakerAmount;
            usdc.safeTransfer(pool, stakerAmount);
            try ISeatBackStaking(pool).receiveProceeds(stakerAmount) {
                // success
            } catch {
                // pool notify reverted — USDC already transferred, pool must reconcile
            }
            emit StakerProceedsRouted(eventId, pool, stakerAmount, organiserAmount);
        }
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getEvent(uint256 eventId) external view returns (EventInfo memory) {
        if (eventId >= eventCount) revert EventNotFound();
        return events[eventId];
    }

    function getAccounting(uint256 eventId) external view returns (EventAccounting memory) {
        if (eventId >= eventCount) revert EventNotFound();
        return accounting[eventId];
    }

    function getReservation(uint256 reservationId) external view returns (ReservationInfo memory) {
        return reservations[reservationId];
    }

    function getActiveReservation(uint256 eventId, address attendee) external view returns (uint256 reservationId) {
        if (eventId >= eventCount) revert EventNotFound();
        return activeReservationId[eventId][attendee];
    }

    function getEventReservations(uint256 eventId, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (eventId >= eventCount) revert EventNotFound();

        uint256[] storage allIds = eventReservationIds[eventId];
        uint256 total = allIds.length;

        if (offset >= total || limit == 0) {
            return new uint256[](0);
        }

        uint256 endExclusive = offset + limit;
        if (endExclusive > total) {
            endExclusive = total;
        }

        uint256 size = endExclusive - offset;
        ids = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            ids[i] = allIds[offset + i];
        }
    }

    /**
     * @notice Returns the EIP-712 digest for a CheckInAuthorization.
     * @dev Frontend calls this to generate the digest for signing off-chain.
     *      Not required for contract verification (computed inline in checkInWithSig),
     *      but useful for testing and for off-chain tooling.
     */
    function getCheckInDigest(CheckInAuthorization calldata auth) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                _CHECK_IN_AUTH_TYPE_HASH,
                auth.eventId,
                auth.reservationId,
                auth.attendee,
                auth.nonce,
                auth.validAfter,
                auth.validUntil
            )
        );
        return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _validateMetadata(string calldata value, uint256 maxBytes, string memory field) internal pure {
        uint256 len = bytes(value).length;
        if (len == 0 || len > maxBytes) revert InvalidMetadata(field);
    }

    function _finalizeEvent(uint256 eventId) internal {
        EventInfo storage evt = events[eventId];
        if (evt.finalized) revert AlreadyFinalized();

        EventAccounting storage acc = accounting[eventId];
        uint256 active = acc.activeDeposits;
        uint256 noShowProceeds = 0;
        uint256 refundLiability = 0;

        evt.finalized = true;

        if (active > 0) {
            if (evt.checkInOpened) {
                acc.organizerCredit += active;
                noShowProceeds = active;
            } else {
                acc.outstandingRefunds += active;
                refundLiability = active;
            }

            acc.activeDeposits = 0;
        }

        emit EventFinalized(eventId, noShowProceeds, refundLiability);
    }

    /**
     * @dev Attempt ECDSA recovery. Returns address(0) if the signature is malformed.
     */
    function _tryRecover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, sig);
        if (err != ECDSA.RecoverError.NoError) return address(0);
        return recovered;
    }

    /**
     * @dev Check ERC-1271 signature validity for smart-contract wallets.
     *      Returns false on any revert (non-conformant contracts).
     */
    function _checkERC1271(address wallet, bytes32 digest, bytes calldata sig) internal view returns (bool) {
        if (wallet.code.length == 0) return false;
        try IERC1271(wallet).isValidSignature(digest, sig) returns (bytes4 magic) {
            return magic == _ERC1271_MAGIC;
        } catch {
            return false;
        }
    }
}
