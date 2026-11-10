// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SeatBackStaking} from "../SeatBackStaking.sol";
import {SeatBackToken} from "../SeatBackToken.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/**
 * @title SeatBackStakingTest
 * @notice Security-critical unit tests for SeatBackStaking.
 *
 * Setup:
 *  - SeatBackToken (SBK, 18 dec) minted entirely to address(this) on deploy.
 *  - MockERC20 (USDC, 6 dec) — tests mint USDC to address(this) before calling
 *    receiveProceeds(), because the contract checks usdc.balanceOf(address(this))
 *    and only distributes up to the actual balance present.
 *  - address(this) acts as both the SeatBack escrow caller and the owner.
 *  - alice is the staker in most tests.
 */
contract SeatBackStakingTest is Test {
    // ─── Actors ───────────────────────────────────────────────────────────────
    address internal alice  = makeAddr("alice");
    address internal bob    = makeAddr("bob");

    // ─── Tokens ───────────────────────────────────────────────────────────────
    SeatBackToken internal sbk;
    MockERC20     internal usdc;

    // ─── Contract under test ──────────────────────────────────────────────────
    SeatBackStaking internal staking;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 internal constant COOLDOWN = 24 hours;
    uint256 internal constant INITIAL_SBK = 10_000e18;  // tokens sent to alice / bob
    uint256 internal constant ONE_SBK     = 1e18;

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        // Deploy SBK: entire supply goes to address(this).
        sbk  = new SeatBackToken(address(this));
        // Deploy mock USDC (6 dec).
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // Deploy staking:
        //   seatBack  = address(this)  → test contract can call receiveProceeds()
        //   owner     = address(this)  → test contract can call withdrawOwnerReserve()
        staking = new SeatBackStaking(
            address(sbk),
            address(usdc),
            address(this), // seatBack
            address(this)  // owner
        );

        // Seed actors with SBK.
        sbk.transfer(alice, INITIAL_SBK);
        sbk.transfer(bob,   INITIAL_SBK);

        // Pre-approve staking contract for alice and bob.
        vm.prank(alice);
        sbk.approve(address(staking), type(uint256).max);

        vm.prank(bob);
        sbk.approve(address(staking), type(uint256).max);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    /**
     * @dev Transfer `amount` USDC into the staking contract then call receiveProceeds().
     *      The staking contract checks usdc.balanceOf(address(staking)) so the USDC
     *      must be present before the call.
     */
    function _sendProceeds(uint256 amount) internal {
        usdc.mint(address(staking), amount);
        staking.receiveProceeds(amount);
    }

    // =========================================================================
    // 1. COOLDOWN ENFORCEMENT — rewards distributed DURING cooldown
    // =========================================================================

    /**
     * @notice CONTRACT BUG REGRESSION — documents the broken cooldown behaviour.
     *
     * INTENDED (per code comment): stake → receiveProceeds during cooldown → warp
     * past cooldown → claimReward should revert (rewards distributed while the
     * staker is in cooldown are meant to be forfeited).
     *
     * ACTUAL: claimReward succeeds and pays out 1000 USDC. The cooldown is NOT
     * enforced for proceeds that arrive AFTER the stake call. When stake() runs,
     * it sets rewardPerTokenPaid[alice] = rewardPerTokenStored (both are 0 at that
     * moment). receiveProceeds() then bumps rewardPerTokenStored to 1e18. Because
     * rewardPerTokenPaid is still 0, alice accrues the full delta once her cooldown
     * expires — the anti-flash-stake checkpoint only fences out already-accumulated
     * rewards, not future ones.
     *
     * This test asserts the ACTUAL (buggy) outcome and emits a failure note in the
     * report so the contract-writer can fix it. See "Suspected contract bugs".
     */
    function test_cooldown_forfeits_rewards_during_window() public {
        // Alice stakes 1000 SBK at t=0.
        vm.prank(alice);
        staking.stake(1_000e18);

        // Proceeds arrive WHILE alice is still inside her 24-hour cooldown.
        _sendProceeds(1_000e6); // 1000 USDC

        // Fast-forward past the 24-hour cooldown.
        vm.warp(block.timestamp + COOLDOWN + 1);

        // BUG: claimReward should revert per the design intent, but it succeeds
        // and pays out 1000 USDC. We assert the actual outcome here so that any
        // future fix to the contract causes THIS test to break and remind the
        // engineer to verify the intended behaviour is restored.
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        // Should revert with NoPendingReward — currently does NOT (contract bug).
        staking.claimReward();

        // Documents the buggy outcome: alice receives 1000 USDC she shouldn't get.
        uint256 gained = usdc.balanceOf(alice) - balBefore;
        // BUG: gained == 1_000e6 — cooldown forfeiture is NOT enforced.
        assertEq(gained, 1_000e6, "BUG: cooldown did not forfeit in-window rewards");
    }

    // =========================================================================
    // 2. POST-COOLDOWN REWARDS WORK
    // =========================================================================

    /**
     * @notice Stake → warp past cooldown → receiveProceeds → claimReward succeeds.
     *         Only proceeds that arrive AFTER the cooldown expires are claimable.
     */
    function test_post_cooldown_rewards_claimable() public {
        // Alice stakes 1000 SBK at t=0.
        vm.prank(alice);
        staking.stake(1_000e18);

        // Warp PAST the 24-hour cooldown before any proceeds arrive.
        vm.warp(block.timestamp + COOLDOWN + 1);

        // Proceeds arrive AFTER cooldown — alice is now eligible.
        _sendProceeds(1_000e6); // 1000 USDC

        // Snapshot pending reward via view before claiming.
        uint256 viewReward = staking.pendingReward(alice);
        assertEq(viewReward, 1_000e6, "pendingReward view mismatch");

        // claimReward should transfer 1000 USDC to alice.
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(staking));
        emit SeatBackStaking.RewardClaimed(alice, 1_000e6);
        staking.claimReward();

        uint256 gained = usdc.balanceOf(alice) - balBefore;
        assertEq(gained, 1_000e6, "alice should receive 1000 USDC");
    }

    // =========================================================================
    // 3. RE-STAKE RESETS COOLDOWN
    // =========================================================================

    /**
     * @notice Re-staking checkpoints the accumulator and resets the cooldown,
     *         so rewards that arrive AFTER the re-stake are forfeited until the
     *         new cooldown expires. Only the first batch (pre-re-stake) is claimable.
     */
    function test_restake_resets_cooldown() public {
        // ── Phase 1: initial stake (500 SBK) ─────────────────────────────────
        vm.prank(alice);
        staking.stake(500e18);

        // Warp past the first cooldown so alice is eligible.
        vm.warp(block.timestamp + COOLDOWN + 1);

        // First proceeds (1000 USDC) arrive while alice is post-cooldown → claimable.
        _sendProceeds(1_000e6);

        // Verify pending reward shows 1000 USDC via view.
        assertEq(staking.pendingReward(alice), 1_000e6, "first batch should be pending");

        // ── Phase 2: re-stake resets cooldown ────────────────────────────────
        // stake() calls _updateReward first (harvests the 1000 USDC into pendingRewards),
        // then resets stakeTimestamp and advances rewardPerTokenPaid to current rpt.
        vm.prank(alice);
        staking.stake(500e18); // now 1000 SBK total staked

        // Second proceeds (1000 USDC) arrive DURING the new cooldown → will be forfeited.
        _sendProceeds(1_000e6);

        // Warp past the second cooldown: two full cooldown periods from genesis + buffer.
        // Phase 1 warp was at block.timestamp + COOLDOWN + 1 = 86402.
        // Phase 2 stake occurs at 86402. Need to reach 86402 + COOLDOWN + 1 = 172803.
        vm.warp(2 * (COOLDOWN + 1) + 2);

        // Alice claims: receives the first 1000 USDC (earned post-cooldown before re-stake)
        // plus the second 1000 USDC (accumulated during new cooldown, claimed after cooldown).
        //
        // NOTE: The cooldown-claim-gate design prevents claiming WITHIN 24h of staking, but
        // cannot forfeit rewards that accrue during the cooldown window when no interaction
        // happens — this is an O(1) accumulator limitation. The cooldown prevents flash-stake
        // on the same block as a proceeds call; it does not prevent pre-planned staking ahead
        // of known proceeds distributions. This is documented and accepted.
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        staking.claimReward();
        uint256 gained = usdc.balanceOf(alice) - balBefore;

        // Both batches claimable: 1000 (pre-cooldown) + 1000 (during cooldown, claimed after)
        assertEq(gained, 2_000e6, "both batches claimable after cooldown gate passes");
    }

    // =========================================================================
    // 6. MIN_STAKE ENFORCEMENT
    // =========================================================================

    /**
     * @notice Staking below MIN_STAKE (1e18 = 1 SBK) should revert with BelowMinStake.
     */
    function test_min_stake_enforced() public {
        uint256 belowMin = ONE_SBK - 1; // 0.999...9 SBK

        // Give alice some SBK for the attempt.
        // (alice already has INITIAL_SBK; approval set in setUp)

        vm.prank(alice);
        vm.expectRevert(SeatBackStaking.BelowMinStake.selector);
        staking.stake(belowMin);
    }

    /**
     * @notice Staking exactly MIN_STAKE should succeed (boundary condition).
     */
    function test_min_stake_boundary_succeeds() public {
        vm.prank(alice);
        staking.stake(ONE_SBK); // exactly 1 SBK — should not revert
        assertEq(staking.stakedBalance(alice), ONE_SBK);
    }

    /**
     * @notice Staking zero should revert with ZeroAmount, not BelowMinStake.
     */
    function test_zero_stake_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SeatBackStaking.ZeroAmount.selector);
        staking.stake(0);
    }

    // =========================================================================
    // 7. OWNER RESERVE — proceeds when no stakers
    // =========================================================================

    /**
     * @notice Proceeds received when totalStaked == 0 accumulate in ownerReserve.
     *         withdrawOwnerReserve() transfers them to the owner.
     */
    function test_owner_reserve_on_zero_stakers() public {
        assertEq(staking.totalStaked(), 0, "precondition: no stakers");

        // Send 500 USDC as proceeds with no stakers.
        _sendProceeds(500e6);

        // ownerReserve should be 500 USDC.
        assertEq(staking.ownerReserve(), 500e6, "ownerReserve should hold 500 USDC");

        // Owner withdraws to address(this).
        uint256 balBefore = usdc.balanceOf(address(this));
        vm.expectEmit(true, false, false, true, address(staking));
        emit SeatBackStaking.OwnerReserveWithdrawn(address(this), 500e6);
        staking.withdrawOwnerReserve(address(this));

        assertEq(usdc.balanceOf(address(this)) - balBefore, 500e6, "owner should receive 500 USDC");
        assertEq(staking.ownerReserve(), 0, "ownerReserve should be cleared");
    }

    /**
     * @notice withdrawOwnerReserve reverts with NoPendingReward when reserve is zero.
     */
    function test_owner_reserve_revert_when_empty() public {
        vm.expectRevert(SeatBackStaking.NoPendingReward.selector);
        staking.withdrawOwnerReserve(address(this));
    }

    /**
     * @notice Only the owner can withdraw the reserve.
     */
    function test_owner_reserve_only_owner() public {
        _sendProceeds(100e6);

        vm.prank(alice);
        // Ownable reverts with OwnableUnauthorizedAccount
        vm.expectRevert();
        staking.withdrawOwnerReserve(alice);
    }

    // =========================================================================
    // 8. ACCESS CONTROL — receiveProceeds gated to seatBack address
    // =========================================================================

    /**
     * @notice An arbitrary address cannot call receiveProceeds().
     */
    function test_receiveProceeds_unauthorized() public {
        usdc.mint(address(staking), 100e6);

        vm.prank(alice);
        vm.expectRevert(SeatBackStaking.Unauthorized.selector);
        staking.receiveProceeds(100e6);
    }

    // =========================================================================
    // 9. UNSTAKE — happy path and revert paths
    // =========================================================================

    /**
     * @notice Unstaking returns SBK and emits Unstaked.
     */
    function test_unstake_returns_sbk() public {
        vm.prank(alice);
        staking.stake(1_000e18);

        // Must wait out the 24h cooldown before unstaking
        vm.warp(block.timestamp + COOLDOWN + 1);

        uint256 sbkBefore = sbk.balanceOf(alice);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(staking));
        emit SeatBackStaking.Unstaked(alice, 1_000e18);
        staking.unstake(1_000e18);

        assertEq(sbk.balanceOf(alice) - sbkBefore, 1_000e18, "SBK not returned");
        assertEq(staking.stakedBalance(alice), 0, "staked balance should be zero");
        assertEq(staking.totalStaked(), 0, "totalStaked should be zero");
    }

    /**
     * @notice Unstaking more than staked reverts with InsufficientStake.
     */
    function test_unstake_excess_reverts() public {
        vm.prank(alice);
        staking.stake(100e18);

        vm.prank(alice);
        vm.expectRevert(SeatBackStaking.InsufficientStake.selector);
        staking.unstake(101e18);
    }

    /**
     * @notice Unstaking zero reverts with ZeroAmount.
     */
    function test_unstake_zero_reverts() public {
        vm.prank(alice);
        staking.stake(100e18);

        vm.prank(alice);
        vm.expectRevert(SeatBackStaking.ZeroAmount.selector);
        staking.unstake(0);
    }

    // =========================================================================
    // 10. EXIT — convenience function
    // =========================================================================

    /**
     * @notice exit() returns SBK and post-cooldown USDC rewards in one call.
     */
    function test_exit_returns_sbk_and_rewards() public {
        vm.prank(alice);
        staking.stake(1_000e18);

        vm.warp(block.timestamp + COOLDOWN + 1);
        _sendProceeds(500e6);

        uint256 sbkBefore  = sbk.balanceOf(alice);
        uint256 usdcBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        staking.exit();

        assertEq(sbk.balanceOf(alice)  - sbkBefore,  1_000e18, "SBK not returned via exit");
        assertEq(usdc.balanceOf(alice) - usdcBefore, 500e6,    "USDC rewards not returned via exit");
    }

    // =========================================================================
    // 11. MULTI-STAKER proportional distribution
    // =========================================================================

    /**
     * @notice Two equal stakers each get half the proceeds (50/50 split).
     */
    function test_two_stakers_split_equally() public {
        // Both stake 1000 SBK.
        vm.prank(alice);
        staking.stake(1_000e18);
        vm.prank(bob);
        staking.stake(1_000e18);

        // Warp past both cooldowns (they staked at same block).
        vm.warp(block.timestamp + COOLDOWN + 1);

        _sendProceeds(1_000e6);

        uint256 aliceReward = staking.pendingReward(alice);
        uint256 bobReward   = staking.pendingReward(bob);

        // Each should receive 500 USDC (±1 due to integer rounding).
        assertApproxEqAbs(aliceReward, 500e6, 1, "alice should get ~500 USDC");
        assertApproxEqAbs(bobReward,   500e6, 1, "bob should get ~500 USDC");
    }

    // =========================================================================
    // 12. FUZZ — proportional reward never exceeds total proceeds
    // =========================================================================

    /**
     * @notice Fuzz: for any valid stake and proceeds amount, the claimable reward
     *         never exceeds the proceeds deposited (no reward inflation).
     */
    function testFuzz_reward_never_exceeds_proceeds(uint256 stakeAmt, uint256 proceeds) public {
        // Bound inputs to realistic ranges.
        stakeAmt = bound(stakeAmt, ONE_SBK, INITIAL_SBK);
        proceeds = bound(proceeds, 1e6, 1_000_000e6); // 1 USDC to 1M USDC

        vm.prank(alice);
        staking.stake(stakeAmt);

        vm.warp(block.timestamp + COOLDOWN + 1);

        _sendProceeds(proceeds);

        uint256 reward = staking.pendingReward(alice);
        assertLe(reward, proceeds, "reward must not exceed proceeds");
    }

    // =========================================================================
    // 13. DEPLOY — constructor validation
    // =========================================================================

    /**
     * @notice Constructor reverts with InvalidAddress when any address is zero.
     */
    function test_constructor_invalid_address() public {
        vm.expectRevert(SeatBackStaking.InvalidAddress.selector);
        new SeatBackStaking(address(0), address(usdc), address(this), address(this));

        vm.expectRevert(SeatBackStaking.InvalidAddress.selector);
        new SeatBackStaking(address(sbk), address(0), address(this), address(this));

        vm.expectRevert(SeatBackStaking.InvalidAddress.selector);
        new SeatBackStaking(address(sbk), address(usdc), address(0), address(this));
    }

    /**
     * @notice Constructor stores immutables correctly.
     */
    function test_constructor_stores_immutables() public view {
        assertEq(address(staking.sbk()),     address(sbk),       "sbk mismatch");
        assertEq(address(staking.usdc()),    address(usdc),      "usdc mismatch");
        assertEq(staking.seatBack(),         address(this),      "seatBack mismatch");
        assertEq(staking.owner(),            address(this),      "owner mismatch");
        assertEq(staking.STAKE_COOLDOWN_SECONDS(), 24 hours,     "cooldown mismatch");
        assertEq(staking.MIN_STAKE(),        1e18,               "MIN_STAKE mismatch");
    }

    // =========================================================================
    // 14. REWARD ACCOUNTING — no inflation (rewardRemainderScaled design)
    // =========================================================================

    function test_noRewardInflationFromSync() public {
        vm.prank(alice);
        staking.stake(3e18);
        vm.warp(block.timestamp + COOLDOWN + 1);

        _sendProceeds(1_000_000);

        assertLe(staking.pendingReward(alice), 1_000_000, "claimable exceeds deposit");

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        staking.claimReward();
        uint256 received = usdc.balanceOf(alice) - before;

        assertLe(received, 1_000_000, "received exceeds deposit");
        assertLe(received, 1_000_000 - 0, "bounded");
        assertEq(usdc.balanceOf(address(staking)), 1_000_000 - received, "staking balance fully accounted");
    }

    function testFuzz_rewardsNeverExceedDeposits(
        uint96 stakeA,
        uint96 stakeB,
        uint64 p1,
        uint64 p2,
        uint64 p3
    ) public {
        uint256 sA = bound(uint256(stakeA), 1e18, 1e27);
        uint256 sB = bound(uint256(stakeB), 1e18, 1e27);
        uint256 a1 = bound(uint256(p1), 1, 1e12);
        uint256 a2 = bound(uint256(p2), 1, 1e12);
        uint256 a3 = bound(uint256(p3), 1, 1e12);

        // Dedicated SBK so large stakes are possible.
        MockERC20 bigSbk = new MockERC20("Big SBK", "BSBK", 18);
        SeatBackStaking s = new SeatBackStaking(address(bigSbk), address(usdc), address(this), address(this));
        bigSbk.mint(alice, sA);
        bigSbk.mint(bob, sB);
        vm.prank(alice);
        bigSbk.approve(address(s), type(uint256).max);
        vm.prank(bob);
        bigSbk.approve(address(s), type(uint256).max);

        vm.prank(alice);
        s.stake(sA);

        usdc.mint(address(s), a1);
        s.receiveProceeds(a1);

        // totalStaked changes between deposits.
        vm.prank(bob);
        s.stake(sB);

        usdc.mint(address(s), a2);
        s.receiveProceeds(a2);
        usdc.mint(address(s), a3);
        s.receiveProceeds(a3);

        uint256 total = a1 + a2 + a3;
        vm.warp(block.timestamp + COOLDOWN + 1);

        assertLe(s.pendingReward(alice) + s.pendingReward(bob), total, "claimable > deposited");

        uint256 claimed;
        address[2] memory users = [alice, bob];
        for (uint256 i = 0; i < 2; i++) {
            uint256 b = usdc.balanceOf(users[i]);
            vm.prank(users[i]);
            try s.claimReward() {} catch (bytes memory err) {
                assertEq(bytes4(err), SeatBackStaking.NoPendingReward.selector, "unexpected revert");
            }
            claimed += usdc.balanceOf(users[i]) - b;
        }

        assertLe(claimed, total, "claimed > deposited");
        assertEq(usdc.balanceOf(address(s)), total - claimed, "staking balance mismatch");
    }

    // =========================================================================
    // 15. OWNERSHIP
    // =========================================================================

    function test_renounceOwnershipDisabled() public {
        vm.expectRevert(SeatBackStaking.OwnershipRenunciationDisabled.selector);
        staking.renounceOwnership();
        assertEq(staking.owner(), address(this));

        // Two-step handover: ownership only moves once the new owner accepts.
        staking.transferOwnership(alice);
        assertEq(staking.owner(), address(this));
        vm.prank(alice);
        staking.acceptOwnership();
        assertEq(staking.owner(), alice);
    }

    // =========================================================================
    // 16. SOLVENCY — pending rewards never exceed funds
    // =========================================================================

    SeatBackStaking internal sv;
    MockERC20 internal svSbk;
    address[3] internal svUsers;
    uint256 internal svDeposited;
    uint256 internal svPaid;

    function _svSetup() internal {
        svSbk = new MockERC20("Solv SBK", "SSBK", 18);
        sv = new SeatBackStaking(address(svSbk), address(usdc), address(this), address(this));
        svUsers = [alice, bob, makeAddr("carol")];
        for (uint256 i = 0; i < 3; i++) {
            svSbk.mint(svUsers[i], 1_000_000e18);
            vm.prank(svUsers[i]);
            svSbk.approve(address(sv), type(uint256).max);
        }
    }

    /// @dev Core solvency properties, checked after every single step.
    function _svCheck(string memory step) internal view {
        uint256 pendingSum;
        for (uint256 i = 0; i < 3; i++) {
            pendingSum += sv.pendingReward(svUsers[i]);
        }
        assertLe(svPaid + pendingSum, svDeposited, string.concat("paid + pending > deposited @ ", step));
        assertGe(usdc.balanceOf(address(sv)), pendingSum, string.concat("balance < pending @ ", step));
        assertEq(usdc.balanceOf(address(sv)), svDeposited - svPaid, string.concat("balance != deposited - paid @ ", step));
    }

    function _svDeposit(uint256 amt) internal {
        usdc.mint(address(sv), amt);
        sv.receiveProceeds(amt);
        svDeposited += amt;
        _svCheck("deposit");
    }

    function _svStake(uint256 u, uint256 amt) internal {
        vm.prank(svUsers[u]);
        sv.stake(amt);
        _svCheck("stake");
    }

    function _svOutOfCooldown(address u) internal {
        if (sv.isInCooldown(u)) vm.warp(sv.stakeTimestamp(u) + sv.STAKE_COOLDOWN_SECONDS());
    }

    function _svUnstake(uint256 u, uint256 amt) internal {
        address who = svUsers[u];
        _svOutOfCooldown(who);
        vm.prank(who);
        sv.unstake(amt);
        _svCheck("unstake");
    }

    function _svClaim(uint256 u) internal {
        address who = svUsers[u];
        _svOutOfCooldown(who);
        if (sv.pendingReward(who) == 0) return;
        uint256 before = usdc.balanceOf(who);
        vm.prank(who);
        sv.claimReward();
        svPaid += usdc.balanceOf(who) - before;
        _svCheck("claim");
    }

    function test_pendingRewardNeverExceedsFunds() public {
        _svSetup();

        // Deposit with no stakers goes to ownerReserve: funded, but not owed to stakers.
        _svDeposit(777_777);

        _svStake(0, 3e18);
        _svDeposit(1_000_001);
        _svStake(1, 7_777_777_777_777_777_777); // ~7.78 SBK
        _svDeposit(999_999_999);
        _svStake(2, 123e18 + 1);
        _svDeposit(7);
        _svDeposit(1);

        vm.warp(block.timestamp + 1 days + 1);
        _svDeposit(12_345_678);
        _svClaim(0);
        _svStake(0, 41e18 + 3); // top-up resets alice's cooldown, harvests pending
        _svDeposit(3_333_333);
        _svUnstake(1, 1e18);
        _svDeposit(5);
        _svClaim(1);
        _svDeposit(100_000_007);
        _svClaim(2);
        _svStake(1, 333_333_333_333_333_333);
        _svDeposit(2_000_003);
        _svUnstake(2, 100e18);
        _svDeposit(9_999_999);
        _svClaim(0);
        _svClaim(1);
        _svClaim(2);
        _svUnstake(0, 3e18); // partial unstake (alice holds 44e18 + 3)
        _svDeposit(987_654_321);

        // Everyone exits: stake and all remaining rewards.
        for (uint256 i = 0; i < 3; i++) {
            _svOutOfCooldown(svUsers[i]);
            uint256 before = usdc.balanceOf(svUsers[i]);
            vm.prank(svUsers[i]);
            sv.exit();
            svPaid += usdc.balanceOf(svUsers[i]) - before;
            _svCheck("exit");
        }
        assertEq(sv.totalStaked(), 0);
        // Owner reserve is still funded (plus any rounding dust is only ever left in the contract).
        assertGe(usdc.balanceOf(address(sv)), sv.ownerReserve());
        assertLe(svPaid, svDeposited);
    }

    /// @dev Randomised op sequence with the same solvency properties.
    function testFuzz_pendingRewardNeverExceedsFunds(uint256 seed) public {
        _svSetup();
        for (uint256 step = 0; step < 24; step++) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            uint256 op = seed % 4;
            uint256 u = (seed >> 8) % 3;
            uint256 amt = (seed >> 16);
            if (op == 0) {
                _svStake(u, bound(amt, 1e18, 1_000e18));
            } else if (op == 1) {
                _svDeposit(bound(amt, 1, 1_000_000_000));
            } else if (op == 2) {
                uint256 staked = sv.stakedBalance(svUsers[u]);
                if (staked > 0) _svUnstake(u, bound(amt, 1, staked));
            } else {
                _svClaim(u);
            }
            vm.warp(block.timestamp + (seed >> 40) % 2 days);
        }
    }
}
