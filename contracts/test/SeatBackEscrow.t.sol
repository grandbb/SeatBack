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
        assertEq(usdc.balanceOf(organizer), noShow / 2, "organizer received 50%");
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

        uint256 out = usdc.balanceOf(address(staking)) + usdc.balanceOf(organizer);
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
        assertEq(usdc.balanceOf(organizer), half);

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
}
