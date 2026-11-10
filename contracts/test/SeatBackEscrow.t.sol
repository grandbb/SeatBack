// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SeatBack} from "../SeatBack.sol";
import {SeatBackStaking} from "../SeatBackStaking.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Pool stub whose receiveProceeds can be made to revert.
contract FlakyPool {
    address public seatBack;
    address public usdc;
    bool public fail;

    constructor(address seatBack_, address usdc_) {
        seatBack = seatBack_;
        usdc = usdc_;
    }

    function setFail(bool f) external {
        fail = f;
    }

    function receiveProceeds(uint256) external view {
        require(!fail, "pool down");
    }
}

/// @notice Integration tests: SeatBack escrow + SeatBackStaking, covering the settlement fixes.
contract SeatBackEscrowTest is Test {
    uint256 internal constant DEPOSIT = 100e6;
    uint256 internal constant N_ATTENDEES = 4;
    uint256 internal constant N_CHECKED_IN = 2;

    address internal admin = makeAddr("admin");
    address internal owner = makeAddr("owner");
    address internal organizer = makeAddr("organizer");
    address internal payout = makeAddr("payout");
    address internal staker = makeAddr("staker");
    address internal random = makeAddr("random");

    address[] internal attendees;

    MockERC20 internal usdc;
    MockERC20 internal sbk;
    SeatBack internal escrow;
    SeatBackStaking internal staking;

    function setUp() public {
        vm.warp(1_000_000);

        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        sbk = new MockERC20("SeatBack Token", "SBK", 18);

        escrow = new SeatBack(address(usdc), admin);
        staking = new SeatBackStaking(address(sbk), address(usdc), address(escrow), owner);
        vm.prank(admin);
        escrow.setStakingPool(address(staking));

        for (uint256 i = 0; i < N_ATTENDEES; i++) {
            attendees.push(makeAddr(string.concat("attendee", vm.toString(i))));
        }

        // Staker stakes and waits out the 24h cooldown.
        sbk.mint(staker, 3e18);
        vm.startPrank(staker);
        sbk.approve(address(staking), type(uint256).max);
        staking.stake(3e18);
        vm.stopPrank();
        vm.warp(block.timestamp + 24 hours + 1);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _params() internal view returns (SeatBack.CreateEventParams memory p) {
        uint256 t0 = block.timestamp;
        p = SeatBack.CreateEventParams({
            payoutWallet: payout,
            title: "Conf",
            description: "A conference",
            venue: "Hall 1",
            eventStart: t0 + 3 days,
            eventEnd: t0 + 3 days + 4 hours,
            capacity: 10,
            depositAmount: DEPOSIT,
            bookingClose: t0 + 1 days,
            refundCutoff: t0 + 2 days,
            checkInStart: t0 + 3 days,
            checkInEnd: t0 + 3 days + 1 hours
        });
    }

    function _createAndReserve(SeatBack esc) internal returns (uint256 id) {
        SeatBack.CreateEventParams memory p = _params();
        vm.prank(organizer);
        id = esc.createEvent(p);
        for (uint256 i = 0; i < attendees.length; i++) {
            address a = attendees[i];
            usdc.mint(a, DEPOSIT);
            vm.startPrank(a);
            usdc.approve(address(esc), type(uint256).max);
            esc.reserve(id);
            vm.stopPrank();
        }
    }

    function _checkInAndFinalize(SeatBack esc, uint256 id) internal {
        vm.warp(esc.getEvent(id).checkInStart);
        vm.startPrank(organizer);
        esc.openCheckIn(id);
        for (uint256 i = 0; i < N_CHECKED_IN; i++) {
            esc.checkIn(id, attendees[i]);
        }
        vm.stopPrank();
        vm.warp(esc.getEvent(id).checkInEnd);
        esc.finalizeEvent(id);
    }

    function _run(SeatBack esc) internal returns (uint256 id) {
        id = _createAndReserve(esc);
        _checkInAndFinalize(esc, id);
    }

    function _claimCheckedInRefunds(SeatBack esc, uint256 id) internal {
        for (uint256 i = 0; i < N_CHECKED_IN; i++) {
            uint256 rid = esc.reservationCount() - N_ATTENDEES + 1 + i;
            vm.prank(attendees[i]);
            esc.claimRefund(rid);
        }
        id; // silence unused
    }

    // ─── 1 ────────────────────────────────────────────────────────────────────

    function test_organizerCannotWithdrawBeforeSettlement() public {
        uint256 id = _run(escrow);
        assertEq(escrow.getAccounting(id).organizerCredit, DEPOSIT * (N_ATTENDEES - N_CHECKED_IN));

        vm.prank(organizer);
        vm.expectRevert(SeatBack.NoShowNotSettled.selector);
        escrow.withdrawOrganizerCredit(id);

        vm.prank(payout);
        vm.expectRevert(SeatBack.NoShowNotSettled.selector);
        escrow.withdrawOrganizerCredit(id);

        assertEq(usdc.balanceOf(organizer), 0);
        assertEq(usdc.balanceOf(payout), 0);
    }

    // ─── 2 ────────────────────────────────────────────────────────────────────

    function test_settlementSplits50_50() public {
        uint256 id = _run(escrow);
        uint256 noShow = DEPOSIT * (N_ATTENDEES - N_CHECKED_IN);
        uint256 poolBefore = usdc.balanceOf(address(staking));

        vm.prank(random);
        escrow.withdrawNoShowProceeds(id);

        assertEq(usdc.balanceOf(address(staking)) - poolBefore, noShow / 2, "pool got 50%");
        assertEq(escrow.getAccounting(id).organizerCredit, noShow / 2, "organizer credit 50%");
        assertEq(escrow.getAccounting(id).stakerPaid, noShow / 2);
        assertEq(usdc.balanceOf(random), 0, "caller gets nothing");
        // Sole staker is credited the staker share (up to 1 wei rounding dust).
        assertApproxEqAbs(staking.pendingReward(staker), noShow / 2, 1);

        vm.prank(organizer);
        escrow.withdrawOrganizerCredit(id);
        assertEq(usdc.balanceOf(payout), noShow / 2, "payout wallet received 50%");
        assertEq(usdc.balanceOf(organizer), 0, "organizer EOA receives nothing");
        assertEq(escrow.getAccounting(id).organizerPaid, noShow / 2);
        assertEq(escrow.getAccounting(id).organizerCredit, 0);
    }

    // ─── 3 ────────────────────────────────────────────────────────────────────

    function test_settlementCannotRunTwice() public {
        uint256 id = _run(escrow);
        escrow.withdrawNoShowProceeds(id);

        vm.expectRevert(SeatBack.NoShowAlreadySettled.selector);
        escrow.withdrawNoShowProceeds(id);

        vm.prank(organizer);
        escrow.withdrawOrganizerCredit(id);

        vm.prank(organizer);
        vm.expectRevert(SeatBack.NoProceeds.selector);
        escrow.withdrawOrganizerCredit(id);
    }

    // ─── 4 ────────────────────────────────────────────────────────────────────

    function test_escrowSolvency() public {
        uint256 id = _run(escrow);
        uint256 totalDeposited = DEPOSIT * N_ATTENDEES;
        assertEq(usdc.balanceOf(address(escrow)), totalDeposited);

        escrow.withdrawNoShowProceeds(id);
        vm.prank(organizer);
        escrow.withdrawOrganizerCredit(id);
        _claimCheckedInRefunds(escrow, id);

        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained exactly");

        assertEq(usdc.balanceOf(organizer), 0, "organizer EOA receives nothing");
        uint256 out = usdc.balanceOf(address(staking)) + usdc.balanceOf(payout);
        for (uint256 i = 0; i < attendees.length; i++) {
            out += usdc.balanceOf(attendees[i]);
        }
        assertEq(out, totalDeposited, "out == deposited");

        // Staker can pull its share; pool is fully backed.
        vm.warp(block.timestamp + 1);
        vm.prank(staker);
        staking.claimReward();
        assertLe(usdc.balanceOf(staker), DEPOSIT);
    }

    // ─── 5 ────────────────────────────────────────────────────────────────────

    function test_setStakingPoolOnlyOnce() public {
        // Already set in setUp.
        vm.prank(admin);
        vm.expectRevert(SeatBack.StakingPoolAlreadySet.selector);
        escrow.setStakingPool(address(staking));

        vm.prank(random);
        vm.expectRevert(SeatBack.NotAdmin.selector);
        escrow.setStakingPool(address(staking));

        SeatBack esc2 = new SeatBack(address(usdc), admin);

        // Wrong USDC token.
        MockERC20 otherUsdc = new MockERC20("Other", "OTH", 6);
        SeatBackStaking badUsdc = new SeatBackStaking(address(sbk), address(otherUsdc), address(esc2), owner);
        vm.prank(admin);
        vm.expectRevert(SeatBack.InvalidStakingPool.selector);
        esc2.setStakingPool(address(badUsdc));

        // Pool bound to a different escrow.
        SeatBackStaking badEscrow = new SeatBackStaking(address(sbk), address(usdc), address(escrow), owner);
        vm.prank(admin);
        vm.expectRevert(SeatBack.InvalidStakingPool.selector);
        esc2.setStakingPool(address(badEscrow));

        // EOA is not a valid pool.
        vm.prank(admin);
        vm.expectRevert(SeatBack.InvalidStakingPool.selector);
        esc2.setStakingPool(random);

        // Zero address.
        vm.prank(admin);
        vm.expectRevert(SeatBack.ZeroAddress.selector);
        esc2.setStakingPool(address(0));

        // Nothing was set by the failed attempts; a genuine pool still works exactly once.
        assertEq(esc2.stakingPool(), address(0));
        SeatBackStaking good = new SeatBackStaking(address(sbk), address(usdc), address(esc2), owner);
        vm.prank(admin);
        esc2.setStakingPool(address(good));
        assertEq(esc2.stakingPool(), address(good));
    }

    // ─── 6 ────────────────────────────────────────────────────────────────────

    function test_createEventRequiresPool() public {
        SeatBack esc2 = new SeatBack(address(usdc), admin);
        SeatBack.CreateEventParams memory p = _params();
        vm.prank(organizer);
        vm.expectRevert(SeatBack.StakingPoolNotSet.selector);
        esc2.createEvent(p);
    }

    // ─── 7 ────────────────────────────────────────────────────────────────────

    function test_failedPoolDeliveryBecomesRetryable() public {
        SeatBack esc2 = new SeatBack(address(usdc), admin);
        FlakyPool pool = new FlakyPool(address(esc2), address(usdc));
        vm.prank(admin);
        esc2.setStakingPool(address(pool));
        pool.setFail(true);

        uint256 id = _run(esc2);
        uint256 half = (DEPOSIT * (N_ATTENDEES - N_CHECKED_IN)) / 2;

        esc2.withdrawNoShowProceeds(id); // must not revert despite pool failure
        assertEq(esc2.unclaimedStakerCredit(id), half, "staker share parked");
        assertEq(usdc.balanceOf(address(pool)), 0, "pool received nothing");
        assertEq(esc2.getAccounting(id).organizerCredit, half);

        // Organiser unaffected by pool failure.
        vm.prank(organizer);
        esc2.withdrawOrganizerCredit(id);
        assertEq(usdc.balanceOf(payout), half);
        assertEq(usdc.balanceOf(organizer), 0, "organizer EOA receives nothing");

        // Retry while still failing: reverts, state unchanged.
        vm.prank(random);
        vm.expectRevert(SeatBack.StakerCreditTransferFailed.selector);
        esc2.retryStakerCredit(id);
        assertEq(esc2.unclaimedStakerCredit(id), half, "unchanged after failed retry");
        assertEq(usdc.balanceOf(address(pool)), 0);

        // Pool recovers; anyone retries.
        pool.setFail(false);
        vm.prank(random);
        esc2.retryStakerCredit(id);
        assertEq(usdc.balanceOf(address(pool)), half, "pool paid on retry");
        assertEq(esc2.unclaimedStakerCredit(id), 0);

        vm.prank(random);
        vm.expectRevert(SeatBack.NoProceeds.selector);
        esc2.retryStakerCredit(id);
    }

    // ─── 8 ────────────────────────────────────────────────────────────────────

    function test_cancelledEventRefundsAll() public {
        uint256 id = _createAndReserve(escrow);
        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT * N_ATTENDEES);

        vm.prank(organizer);
        escrow.cancelEvent(id);

        uint256 firstRid = escrow.reservationCount() - N_ATTENDEES + 1;
        for (uint256 i = 0; i < attendees.length; i++) {
            assertEq(usdc.balanceOf(attendees[i]), 0);
            vm.prank(attendees[i]);
            escrow.claimRefund(firstRid + i);
            assertEq(usdc.balanceOf(attendees[i]), DEPOSIT, "full deposit refunded");
        }
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow empty");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Extended coverage
    // ═════════════════════════════════════════════════════════════════════════

    uint256 internal constant SIGNER_PK = 0xA11CE;
    uint256 internal constant OTHER_PK = 0xB0B;
    address internal signer = vm.addr(SIGNER_PK);

    function _createEvent(SeatBack esc, uint32 cap) internal returns (uint256 id) {
        SeatBack.CreateEventParams memory p = _params();
        p.capacity = cap;
        vm.prank(organizer);
        id = esc.createEvent(p);
    }

    function _reserveAs(SeatBack esc, uint256 id, address a) internal returns (uint256 rid) {
        usdc.mint(a, DEPOSIT);
        vm.startPrank(a);
        usdc.approve(address(esc), type(uint256).max);
        esc.reserve(id);
        vm.stopPrank();
        rid = esc.getActiveReservation(id, a);
    }

    function _openCheckIn(SeatBack esc, uint256 id) internal {
        vm.warp(esc.getEvent(id).checkInStart);
        vm.prank(organizer);
        esc.openCheckIn(id);
    }

    function _auth(uint256 id, uint256 rid, address a, uint256 nonce, uint256 va, uint256 vu)
        internal
        pure
        returns (SeatBack.CheckInAuthorization memory)
    {
        return SeatBack.CheckInAuthorization({
            eventId: id,
            reservationId: rid,
            attendee: a,
            nonce: nonce,
            validAfter: va,
            validUntil: vu
        });
    }

    function _sign(SeatBack esc, uint256 pk, SeatBack.CheckInAuthorization memory a)
        internal
        view
        returns (bytes memory)
    {
        bytes32 d = esc.getCheckInDigest(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Event 0 with `signer` reserved and check-in opened (block.timestamp == checkInStart).
    function _sigFixture() internal returns (uint256 id, uint256 rid) {
        id = _createEvent(escrow, 10);
        rid = _reserveAs(escrow, id, signer);
        _openCheckIn(escrow, id);
    }

    function _goodAuth(uint256 id, uint256 rid) internal view returns (SeatBack.CheckInAuthorization memory) {
        return _auth(id, rid, signer, 1, block.timestamp, block.timestamp + 5 minutes);
    }

    // ─── (a) withdrawOrganizerCredit always pays the payout wallet ────────────

    function test_withdrawGoesToPayoutWallet_whenCalledByOrganizer() public {
        assertTrue(payout != organizer, "precondition: distinct payout wallet");
        uint256 id = _run(escrow);
        escrow.withdrawNoShowProceeds(id);
        uint256 credit = escrow.getAccounting(id).organizerCredit;
        assertGt(credit, 0);

        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256 payBefore = usdc.balanceOf(payout);

        vm.prank(random);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.withdrawOrganizerCredit(id);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit SeatBack.ProceedsWithdrawn(id, payout, credit);
        vm.prank(organizer);
        escrow.withdrawOrganizerCredit(id);

        assertEq(usdc.balanceOf(organizer), orgBefore, "organizer balance unchanged");
        assertEq(usdc.balanceOf(payout) - payBefore, credit, "payout wallet got the credit");
        assertEq(escrow.getAccounting(id).organizerCredit, 0);
    }

    function test_withdrawGoesToPayoutWallet_whenCalledByPayoutWallet() public {
        assertTrue(payout != organizer, "precondition: distinct payout wallet");
        uint256 id = _run(escrow);
        escrow.withdrawNoShowProceeds(id);
        uint256 credit = escrow.getAccounting(id).organizerCredit;
        assertGt(credit, 0);

        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256 payBefore = usdc.balanceOf(payout);

        vm.prank(random);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.withdrawOrganizerCredit(id);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit SeatBack.ProceedsWithdrawn(id, payout, credit);
        vm.prank(payout);
        escrow.withdrawOrganizerCredit(id);

        assertEq(usdc.balanceOf(organizer), orgBefore, "organizer balance unchanged");
        assertEq(usdc.balanceOf(payout) - payBefore, credit, "payout wallet got the credit");
        assertEq(escrow.getAccounting(id).organizerPaid, credit);
    }

    // ─── (b) checkInWithSig ───────────────────────────────────────────────────

    function test_checkInWithSig_happyPath() public {
        (uint256 id, uint256 rid) = _sigFixture();
        SeatBack.CheckInAuthorization memory a = _goodAuth(id, rid);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);

        vm.expectEmit(true, true, true, true, address(escrow));
        emit SeatBack.CheckedIn(id, rid, signer);
        vm.prank(organizer);
        escrow.checkInWithSig(a, sig);

        SeatBack.ReservationInfo memory r = escrow.getReservation(rid);
        assertFalse(r.active, "inactive after check-in");
        assertTrue(r.refundable, "refundable after check-in");
        assertEq(escrow.getActiveReservation(id, signer), 0);
        assertTrue(escrow.usedNonces(rid, 1), "nonce consumed");
        assertEq(escrow.getAccounting(id).activeDeposits, 0);
        assertEq(escrow.getAccounting(id).outstandingRefunds, DEPOSIT);

        vm.prank(signer);
        escrow.claimRefund(rid);
        assertEq(usdc.balanceOf(signer), DEPOSIT, "attendee refunded");
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_checkInWithSig_rejects_notOrganizer() public {
        (uint256 id, uint256 rid) = _sigFixture();
        SeatBack.CheckInAuthorization memory a = _goodAuth(id, rid);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);

        vm.prank(random);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.checkInWithSig(a, sig);

        // The attendee themself cannot self-submit either.
        vm.prank(signer);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.checkInWithSig(a, sig);
    }

    function test_checkInWithSig_rejects_wrongKey() public {
        (uint256 id, uint256 rid) = _sigFixture();
        SeatBack.CheckInAuthorization memory a = _goodAuth(id, rid);
        bytes memory sig = _sign(escrow, OTHER_PK, a);

        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidSignature.selector);
        escrow.checkInWithSig(a, sig);

        // Malformed (wrong-length) signature is also rejected.
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidSignature.selector);
        escrow.checkInWithSig(a, hex"deadbeef");

        // Signature over different payload fields (tampered nonce) is rejected.
        bytes memory good = _sign(escrow, SIGNER_PK, a);
        SeatBack.CheckInAuthorization memory tampered = _goodAuth(id, rid);
        tampered.nonce = 2;
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidSignature.selector);
        escrow.checkInWithSig(tampered, good);
    }

    function test_checkInWithSig_rejects_expired() public {
        (uint256 id, uint256 rid) = _sigFixture();
        SeatBack.CheckInAuthorization memory a = _auth(id, rid, signer, 1, block.timestamp, block.timestamp + 60);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);

        vm.warp(block.timestamp + 60); // validUntil is exclusive
        vm.prank(organizer);
        vm.expectRevert(SeatBack.QrExpired.selector);
        escrow.checkInWithSig(a, sig);
    }

    function test_checkInWithSig_rejects_notYetValid() public {
        (uint256 id, uint256 rid) = _sigFixture();
        SeatBack.CheckInAuthorization memory a =
            _auth(id, rid, signer, 1, block.timestamp + 60, block.timestamp + 120);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);

        vm.prank(organizer);
        vm.expectRevert(SeatBack.QrNotYetValid.selector);
        escrow.checkInWithSig(a, sig);

        // Becomes valid once validAfter is reached.
        vm.warp(block.timestamp + 60);
        vm.prank(organizer);
        escrow.checkInWithSig(a, sig);
        assertTrue(escrow.getReservation(rid).refundable);
    }

    function test_checkInWithSig_rejects_validityTooLong() public {
        (uint256 id, uint256 rid) = _sigFixture();
        uint256 maxV = escrow.MAX_QR_VALIDITY();

        SeatBack.CheckInAuthorization memory a =
            _auth(id, rid, signer, 1, block.timestamp, block.timestamp + maxV + 1);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.QrValidityTooLong.selector);
        escrow.checkInWithSig(a, sig);

        // Exactly MAX_QR_VALIDITY is accepted.
        SeatBack.CheckInAuthorization memory ok = _auth(id, rid, signer, 2, block.timestamp, block.timestamp + maxV);
        bytes memory okSig = _sign(escrow, SIGNER_PK, ok);
        vm.prank(organizer);
        escrow.checkInWithSig(ok, okSig);
        assertTrue(escrow.getReservation(rid).refundable);
    }

    function test_checkInWithSig_rejects_validUntilBeyondCheckInEnd() public {
        (uint256 id, uint256 rid) = _sigFixture();
        uint256 end = escrow.getEvent(id).checkInEnd;
        vm.warp(end - 60);
        SeatBack.CheckInAuthorization memory a = _auth(id, rid, signer, 1, block.timestamp, end + 1);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.QrValidityTooLong.selector);
        escrow.checkInWithSig(a, sig);
    }

    function test_checkInWithSig_rejects_replay() public {
        (uint256 id, uint256 rid) = _sigFixture();
        SeatBack.CheckInAuthorization memory a = _goodAuth(id, rid);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);

        vm.prank(organizer);
        escrow.checkInWithSig(a, sig);

        // Replay of the identical payload+signature: the reservation is already
        // inactive, so the contract reverts NotActive (that check runs before the
        // nonce check — NonceAlreadyUsed is not reachable via this path).
        vm.prank(organizer);
        vm.expectRevert(SeatBack.NotActive.selector);
        escrow.checkInWithSig(a, sig);

        // Same for a fresh nonce signed by the attendee.
        SeatBack.CheckInAuthorization memory a2 = _auth(id, rid, signer, 2, block.timestamp, block.timestamp + 5 minutes);
        bytes memory sig2 = _sign(escrow, SIGNER_PK, a2);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.NotActive.selector);
        escrow.checkInWithSig(a2, sig2);
    }

    function test_checkInWithSig_rejects_wrongEventId() public {
        // A second event (same organizer, same schedule) created at the same instant,
        // with check-in opened as well. Created BEFORE the fixture warps forward.
        uint256 id2 = _createEvent(escrow, 10);
        (uint256 id, uint256 rid) = _sigFixture();
        assertEq(id, id2 + 1);
        vm.prank(organizer);
        escrow.openCheckIn(id2);

        SeatBack.CheckInAuthorization memory a = _auth(id2, rid, signer, 1, block.timestamp, block.timestamp + 5 minutes);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.AttendeeWalletMismatch.selector);
        escrow.checkInWithSig(a, sig);

        // Nonexistent event id.
        SeatBack.CheckInAuthorization memory b = _auth(99, rid, signer, 1, block.timestamp, block.timestamp + 5 minutes);
        bytes memory sigB = _sign(escrow, SIGNER_PK, b);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.EventNotFound.selector);
        escrow.checkInWithSig(b, sigB);
    }

    function test_checkInWithSig_rejects_cancelledReservation() public {
        uint256 id = _createEvent(escrow, 10);
        uint256 rid = _reserveAs(escrow, id, signer);
        vm.prank(signer);
        escrow.cancelReservation(rid);
        _openCheckIn(escrow, id);

        SeatBack.CheckInAuthorization memory a = _goodAuth(id, rid);
        bytes memory sig = _sign(escrow, SIGNER_PK, a);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.NotActive.selector);
        escrow.checkInWithSig(a, sig);
    }

    function test_checkInWithSig_rejects_staleReservationAfterRebook() public {
        uint256 id = _createEvent(escrow, 10);
        uint256 oldRid = _reserveAs(escrow, id, signer);
        vm.prank(signer);
        escrow.cancelReservation(oldRid);
        usdc.mint(signer, DEPOSIT); // first deposit stays escrowed until claimed; fund the re-booking
        vm.prank(signer);
        escrow.reserve(id);
        uint256 newRid = escrow.getActiveReservation(id, signer);
        assertTrue(newRid != oldRid);
        _openCheckIn(escrow, id);

        // QR for the old reservation id is dead.
        SeatBack.CheckInAuthorization memory stale = _goodAuth(id, oldRid);
        bytes memory staleSig = _sign(escrow, SIGNER_PK, stale);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.NotActive.selector);
        escrow.checkInWithSig(stale, staleSig);

        // QR for the new one works.
        SeatBack.CheckInAuthorization memory fresh = _goodAuth(id, newRid);
        bytes memory freshSig = _sign(escrow, SIGNER_PK, fresh);
        vm.prank(organizer);
        escrow.checkInWithSig(fresh, freshSig);
        assertTrue(escrow.getReservation(newRid).refundable);
    }

    // ─── Cross-contract replay ────────────────────────────────────────────────

    function test_replayAcrossContracts() public {
        SeatBack escB = new SeatBack(address(usdc), admin);
        SeatBackStaking stB = new SeatBackStaking(address(sbk), address(usdc), address(escB), owner);
        vm.prank(admin);
        escB.setStakingPool(address(stB));

        // Identical event + reservation ids + attendee on both escrows.
        uint256 idA = _createEvent(escrow, 10);
        uint256 idB = _createEvent(escB, 10);
        uint256 ridA = _reserveAs(escrow, idA, signer);
        uint256 ridB = _reserveAs(escB, idB, signer);
        assertEq(idA, idB);
        assertEq(ridA, ridB);
        assertTrue(escrow.DOMAIN_SEPARATOR() != escB.DOMAIN_SEPARATOR(), "domain separators differ");

        _openCheckIn(escrow, idA);
        vm.prank(organizer);
        escB.openCheckIn(idB);

        SeatBack.CheckInAuthorization memory a = _goodAuth(idA, ridA);
        bytes memory sigForA = _sign(escrow, SIGNER_PK, a);
        bytes memory sigForB = _sign(escB, SIGNER_PK, a);
        assertTrue(keccak256(sigForA) != keccak256(sigForB), "digests differ per contract");

        // A's signature is rejected by B, and vice versa.
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidSignature.selector);
        escB.checkInWithSig(a, sigForA);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidSignature.selector);
        escrow.checkInWithSig(a, sigForB);

        // Failed replays changed nothing.
        assertTrue(escB.getReservation(ridB).active);
        assertTrue(escrow.getReservation(ridA).active);

        // Each signature is accepted only by the contract it was produced for.
        vm.prank(organizer);
        escrow.checkInWithSig(a, sigForA);
        vm.prank(organizer);
        escB.checkInWithSig(a, sigForB);
        assertTrue(escrow.getReservation(ridA).refundable);
        assertTrue(escB.getReservation(ridB).refundable);
    }

    // ─── Cancel & rebook ──────────────────────────────────────────────────────

    function test_cancelAndRebook() public {
        uint256 id = _createEvent(escrow, 2);
        address a0 = attendees[0];
        address a1 = attendees[1];
        address a2 = attendees[2];

        uint256 r0 = _reserveAs(escrow, id, a0);
        _reserveAs(escrow, id, a1);

        // At capacity: a third attendee is turned away.
        usdc.mint(a2, DEPOSIT);
        vm.startPrank(a2);
        usdc.approve(address(escrow), type(uint256).max);
        vm.expectRevert(SeatBack.CapacityFull.selector);
        escrow.reserve(id);
        vm.stopPrank();

        // a0 cancels before refundCutoff -> seat freed.
        vm.expectEmit(true, true, true, false, address(escrow));
        emit SeatBack.ReservationCancelled(id, r0, a0);
        vm.prank(a0);
        escrow.cancelReservation(r0);
        assertEq(escrow.reservedSeats(id), 1);
        assertEq(escrow.getActiveReservation(id, a0), 0);
        assertFalse(escrow.getReservation(r0).active);
        assertTrue(escrow.getReservation(r0).refundable);

        // a2 takes the freed seat.
        vm.prank(a2);
        escrow.reserve(id);
        uint256 r2 = escrow.getActiveReservation(id, a2);
        assertTrue(r2 != 0);
        assertEq(escrow.reservedSeats(id), 2);

        // Full again: a0 cannot rebook yet.
        vm.prank(a0);
        vm.expectRevert(SeatBack.CapacityFull.selector);
        escrow.reserve(id);

        // a2 backs out; a0 claims the first refund and rebooks into the freed seat.
        vm.prank(a2);
        escrow.cancelReservation(r2);

        vm.prank(a0);
        escrow.claimRefund(r0);
        assertEq(usdc.balanceOf(a0), DEPOSIT, "a0 refunded");

        vm.prank(a0);
        escrow.reserve(id);
        uint256 r3 = escrow.getActiveReservation(id, a0);
        assertTrue(r3 != 0 && r3 != r0, "new reservation id");
        assertEq(r3, escrow.reservationCount());
        assertTrue(escrow.getReservation(r3).active);
        assertEq(usdc.balanceOf(a0), 0, "rebooking took a fresh deposit");

        // The first reservation can never be claimed twice or cancelled again.
        vm.prank(a0);
        vm.expectRevert(SeatBack.AlreadyClaimed.selector);
        escrow.claimRefund(r0);
        vm.prank(a0);
        vm.expectRevert(SeatBack.NotActive.selector);
        escrow.cancelReservation(r0);
        assertEq(usdc.balanceOf(a0), 0, "no double refund");

        // The live rebooked reservation is not refundable yet.
        vm.prank(a0);
        vm.expectRevert(SeatBack.NotRefundable.selector);
        escrow.claimRefund(r3);

        // a2 gets exactly its deposit back; escrow keeps a1's + a0's new deposit.
        vm.prank(a2);
        escrow.claimRefund(r2);
        assertEq(usdc.balanceOf(a2), DEPOSIT);
        assertEq(usdc.balanceOf(address(escrow)), 2 * DEPOSIT);
        assertEq(escrow.getAccounting(id).activeDeposits, 2 * DEPOSIT);
        assertEq(escrow.getAccounting(id).outstandingRefunds, 0);
    }

    // ─── Refund timing ────────────────────────────────────────────────────────

    function test_checkedInAttendeeCanClaimBeforeFinalize() public {
        uint256 id = _createAndReserve(escrow);
        uint256 rid0 = escrow.reservationCount() - N_ATTENDEES + 1;
        _openCheckIn(escrow, id);

        vm.prank(organizer);
        escrow.checkIn(id, attendees[0]);

        // Not-yet-checked-in attendee cannot claim while check-in is running.
        vm.prank(attendees[1]);
        vm.expectRevert(SeatBack.NotRefundable.selector);
        escrow.claimRefund(rid0 + 1);

        assertFalse(escrow.getEvent(id).finalized);
        vm.prank(attendees[0]);
        escrow.claimRefund(rid0);
        assertEq(usdc.balanceOf(attendees[0]), DEPOSIT, "checked-in attendee refunded pre-finalize");
        assertFalse(escrow.getEvent(id).finalized, "still not finalized");
        assertEq(usdc.balanceOf(address(escrow)), (N_ATTENDEES - 1) * DEPOSIT);

        // No second claim.
        vm.prank(attendees[0]);
        vm.expectRevert(SeatBack.AlreadyClaimed.selector);
        escrow.claimRefund(rid0);
    }

    function test_noCheckInOpened_attendeeRefundAfterCheckInEnd() public {
        uint256 id = _createAndReserve(escrow);
        uint256 rid0 = escrow.reservationCount() - N_ATTENDEES + 1;

        // Organizer never opens check-in. Before checkInEnd nothing is refundable.
        vm.warp(escrow.getEvent(id).checkInEnd - 1);
        vm.prank(attendees[0]);
        vm.expectRevert(SeatBack.NotRefundable.selector);
        escrow.claimRefund(rid0);

        vm.warp(escrow.getEvent(id).checkInEnd);
        for (uint256 i = 0; i < N_ATTENDEES; i++) {
            vm.prank(attendees[i]);
            escrow.claimRefund(rid0 + i);
            assertEq(usdc.balanceOf(attendees[i]), DEPOSIT, "full deposit back");
        }

        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow ends at 0");
        assertTrue(escrow.getEvent(id).finalized);
        SeatBack.EventAccounting memory acc = escrow.getAccounting(id);
        assertEq(acc.refundsPaid, N_ATTENDEES * DEPOSIT);
        assertEq(acc.outstandingRefunds, 0);
        assertEq(acc.organizerCredit, 0);

        // No no-show proceeds exist, and nobody can double-claim.
        vm.expectRevert(SeatBack.NoProceeds.selector);
        escrow.withdrawNoShowProceeds(id);
        vm.prank(attendees[0]);
        vm.expectRevert(SeatBack.AlreadyClaimed.selector);
        escrow.claimRefund(rid0);
    }

    function test_organizerCancelAfterCheckInOpened() public {
        uint256 id = _createAndReserve(escrow);
        uint256 rid0 = escrow.reservationCount() - N_ATTENDEES + 1;
        _openCheckIn(escrow, id);

        vm.prank(organizer);
        escrow.checkIn(id, attendees[0]);

        vm.prank(organizer);
        escrow.cancelEvent(id);

        // Cancelled events can't be finalized / settled / checked into.
        vm.expectRevert(SeatBack.EventCancelled_.selector);
        escrow.finalizeEvent(id);
        vm.expectRevert(SeatBack.EventCancelled_.selector);
        escrow.withdrawNoShowProceeds(id);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.EventCancelled_.selector);
        escrow.checkIn(id, attendees[1]);

        SeatBack.EventAccounting memory acc = escrow.getAccounting(id);
        assertEq(acc.activeDeposits, 0);
        assertEq(acc.outstandingRefunds, N_ATTENDEES * DEPOSIT);
        assertEq(acc.organizerCredit, 0);

        for (uint256 i = 0; i < N_ATTENDEES; i++) {
            vm.prank(attendees[i]);
            escrow.claimRefund(rid0 + i);
            assertEq(usdc.balanceOf(attendees[i]), DEPOSIT, "exactly one deposit each");
        }
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow ends at 0");
        assertEq(escrow.getAccounting(id).outstandingRefunds, 0);
        assertEq(escrow.getAccounting(id).refundsPaid, N_ATTENDEES * DEPOSIT);

        // No double refund for checked-in or non-checked-in attendees.
        for (uint256 i = 0; i < N_ATTENDEES; i++) {
            vm.prank(attendees[i]);
            vm.expectRevert(SeatBack.AlreadyClaimed.selector);
            escrow.claimRefund(rid0 + i);
            assertEq(usdc.balanceOf(attendees[i]), DEPOSIT);
        }
        assertEq(usdc.balanceOf(organizer), 0);
        assertEq(usdc.balanceOf(payout), 0);
    }

    // ─── Fuzz: conservation of funds ──────────────────────────────────────────

    function _fzAttendee(uint256 i) internal pure returns (uint256 pk, address who) {
        pk = 0x1000 + i;
        who = vm.addr(pk);
    }

    function _fzCheckIn(uint256 id, uint256 i, address who, uint256 pk, uint256 rid) internal {
        if (i % 2 == 0) {
            vm.prank(organizer);
            escrow.checkIn(id, who);
        } else {
            SeatBack.CheckInAuthorization memory a = _auth(id, rid, who, i, block.timestamp, block.timestamp + 5 minutes);
            bytes memory sig = _sign(escrow, pk, a);
            vm.prank(organizer);
            escrow.checkInWithSig(a, sig);
        }
    }

    /// @dev Random mix of reserve / cancel / check-in (direct + signed) / no-show.
    ///      After settle + organizer withdraw + all refunds, escrow must hold exactly 0
    ///      and every USDC must be accounted for (attendees + pool + payout == deposited).
    function test_fuzz_escrowConservation(uint8 attendeesRaw, uint8 checkedInRaw, uint8 cancelledRaw) public {
        uint256 n = bound(uint256(attendeesRaw), 1, 8);
        uint256 c = bound(uint256(cancelledRaw), 0, n);
        uint256 k = bound(uint256(checkedInRaw), 0, n - c);
        // Check-in must be opened if anyone is checked in; otherwise toggle on parity.
        bool opened = k > 0 || (cancelledRaw % 2 == 1);

        uint256 poolBefore = usdc.balanceOf(address(staking));
        uint256 id = _createEvent(escrow, 10);
        uint256[] memory rids = new uint256[](n);
        address[] memory who = new address[](n);
        uint256[] memory pks = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            (pks[i], who[i]) = _fzAttendee(i);
            rids[i] = _reserveAs(escrow, id, who[i]);
        }
        assertEq(usdc.balanceOf(address(escrow)), n * DEPOSIT);

        // First c attendees cancel (before refundCutoff).
        for (uint256 i = 0; i < c; i++) {
            vm.prank(who[i]);
            escrow.cancelReservation(rids[i]);
        }

        // Next k attendees check in; the rest are no-shows.
        vm.warp(escrow.getEvent(id).checkInStart);
        if (opened) {
            vm.prank(organizer);
            escrow.openCheckIn(id);
            for (uint256 i = c; i < c + k; i++) {
                _fzCheckIn(id, i, who[i], pks[i], rids[i]);
            }
        }

        vm.warp(escrow.getEvent(id).checkInEnd);
        escrow.finalizeEvent(id);

        uint256 refundees = opened ? c + k : n;
        uint256 noShows = opened ? n - c - k : 0;

        // Non-refundable (no-show) attendees cannot pull a refund.
        for (uint256 i = refundees; i < n; i++) {
            vm.prank(who[i]);
            vm.expectRevert(SeatBack.NotRefundable.selector);
            escrow.claimRefund(rids[i]);
        }

        // Settle + organiser withdrawal.
        if (noShows > 0) {
            escrow.withdrawNoShowProceeds(id);
            vm.prank(payout);
            escrow.withdrawOrganizerCredit(id);
        } else {
            vm.expectRevert(SeatBack.NoProceeds.selector);
            escrow.withdrawNoShowProceeds(id);
        }

        // All refunds claimed exactly once.
        for (uint256 i = 0; i < refundees; i++) {
            vm.prank(who[i]);
            escrow.claimRefund(rids[i]);
            vm.prank(who[i]);
            vm.expectRevert(SeatBack.AlreadyClaimed.selector);
            escrow.claimRefund(rids[i]);
        }

        // ── Conservation ──
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained to 0");

        uint256 totalIn = n * DEPOSIT;
        uint256 forfeited = noShows * DEPOSIT;
        uint256 toPool = usdc.balanceOf(address(staking)) - poolBefore;
        assertEq(toPool, forfeited / 2, "pool got 50% of forfeits");
        assertEq(usdc.balanceOf(payout), forfeited - forfeited / 2, "payout got the other 50%");
        assertEq(usdc.balanceOf(organizer), 0);

        uint256 out = toPool + usdc.balanceOf(payout);
        for (uint256 i = 0; i < n; i++) {
            uint256 bal = usdc.balanceOf(who[i]);
            assertEq(bal, i < refundees ? DEPOSIT : 0, "attendee balance");
            out += bal;
        }
        assertEq(out, totalIn, "totals out == totals in");

        SeatBack.EventAccounting memory acc = escrow.getAccounting(id);
        assertEq(acc.activeDeposits, 0);
        assertEq(acc.outstandingRefunds, 0);
        assertEq(acc.organizerCredit, 0);
        assertEq(acc.refundsPaid, refundees * DEPOSIT);
        assertEq(acc.organizerPaid, forfeited - forfeited / 2);
        assertEq(acc.stakerPaid, forfeited / 2);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // updatePayoutWallet
    // ═════════════════════════════════════════════════════════════════════════

    function test_updatePayoutWallet_onlyOrganizer() public {
        uint256 id = _createEvent(escrow, 10);
        address newWallet = makeAddr("newWallet");

        // Non-organisers: old payout wallet and a random address.
        vm.prank(payout);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.updatePayoutWallet(id, newWallet);

        vm.prank(random);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.updatePayoutWallet(id, newWallet);
        assertEq(escrow.getEvent(id).payoutWallet, payout, "unchanged after rejected calls");

        // Invalid targets.
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidAddress.selector);
        escrow.updatePayoutWallet(id, address(0));

        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidAddress.selector);
        escrow.updatePayoutWallet(id, address(escrow));
        assertEq(escrow.getEvent(id).payoutWallet, payout, "unchanged after invalid targets");

        // Unknown event (checked before access control).
        vm.prank(organizer);
        vm.expectRevert(SeatBack.EventNotFound.selector);
        escrow.updatePayoutWallet(id + 1, newWallet);
        vm.prank(random);
        vm.expectRevert(SeatBack.EventNotFound.selector);
        escrow.updatePayoutWallet(999, newWallet);

        // Organiser succeeds and emits.
        vm.expectEmit(true, true, true, false, address(escrow));
        emit SeatBack.PayoutWalletUpdated(id, payout, newWallet);
        vm.prank(organizer);
        escrow.updatePayoutWallet(id, newWallet);
        assertEq(escrow.getEvent(id).payoutWallet, newWallet, "payout wallet updated");
        assertEq(escrow.getEvent(id).organizer, organizer, "organizer unchanged");

        // Update is repeatable and old = previous new.
        address third = makeAddr("third");
        vm.expectEmit(true, true, true, false, address(escrow));
        emit SeatBack.PayoutWalletUpdated(id, newWallet, third);
        vm.prank(organizer);
        escrow.updatePayoutWallet(id, third);
        assertEq(escrow.getEvent(id).payoutWallet, third);

        // The previous wallet no longer has any power over the event.
        vm.prank(newWallet);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.updatePayoutWallet(id, newWallet);
    }

    function test_updatePayoutWallet_rescuesBlockedWallet() public {
        uint256 id = _run(escrow);
        uint256 half = (DEPOSIT * (N_ATTENDEES - N_CHECKED_IN)) / 2;
        address goodWallet = makeAddr("goodWallet");

        // The original payout wallet cannot receive USDC (e.g. blocklisted).
        vm.mockCallRevert(
            address(usdc), abi.encodeWithSelector(usdc.transfer.selector, payout), bytes("blocked")
        );

        escrow.withdrawNoShowProceeds(id);
        assertEq(escrow.getAccounting(id).organizerCredit, half, "credit after settlement");

        // Withdrawal reverts for both authorised callers; credit stays intact.
        vm.prank(organizer);
        vm.expectRevert();
        escrow.withdrawOrganizerCredit(id);
        vm.prank(payout);
        vm.expectRevert();
        escrow.withdrawOrganizerCredit(id);

        SeatBack.EventAccounting memory accBefore = escrow.getAccounting(id);
        assertEq(accBefore.organizerCredit, half, "credit intact");
        assertEq(accBefore.organizerPaid, 0, "nothing paid");
        assertEq(usdc.balanceOf(payout), 0);

        // Organiser repoints the payout wallet.
        vm.prank(organizer);
        escrow.updatePayoutWallet(id, goodWallet);

        uint256 escrowBefore = usdc.balanceOf(address(escrow));

        // Old wallet can no longer withdraw; the organiser still can.
        vm.prank(payout);
        vm.expectRevert(SeatBack.NotOrganizer.selector);
        escrow.withdrawOrganizerCredit(id);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit SeatBack.ProceedsWithdrawn(id, goodWallet, half);
        vm.prank(organizer);
        escrow.withdrawOrganizerCredit(id);

        assertEq(usdc.balanceOf(goodWallet), half, "new wallet received exactly the organiser half");
        assertEq(usdc.balanceOf(payout), 0, "old wallet received nothing");
        assertEq(usdc.balanceOf(organizer), 0, "organizer EOA received nothing");
        assertEq(escrowBefore - usdc.balanceOf(address(escrow)), half, "escrow decreased by exactly the credit");

        SeatBack.EventAccounting memory acc = escrow.getAccounting(id);
        assertEq(acc.organizerCredit, 0);
        assertEq(acc.organizerPaid, half);
        assertEq(acc.stakerPaid, half);

        // Remaining escrow balance is exactly the checked-in attendees' refunds.
        assertEq(usdc.balanceOf(address(escrow)), N_CHECKED_IN * DEPOSIT, "only refunds remain");
        assertEq(acc.outstandingRefunds, N_CHECKED_IN * DEPOSIT);

        // Cannot double withdraw.
        vm.prank(organizer);
        vm.expectRevert(SeatBack.NoProceeds.selector);
        escrow.withdrawOrganizerCredit(id);

        // Refunds are still fully payable and drain the escrow.
        _claimCheckedInRefunds(escrow, id);
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained exactly");
    }

    function test_createEvent_rejectsEscrowAsPayout() public {
        SeatBack.CreateEventParams memory p = _params();
        p.payoutWallet = address(escrow);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidAddress.selector);
        escrow.createEvent(p);

        p.payoutWallet = address(0);
        vm.prank(organizer);
        vm.expectRevert(SeatBack.InvalidAddress.selector);
        escrow.createEvent(p);

        assertEq(escrow.eventCount(), 0, "no event created");
    }
}
