// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title SeatBackStaking
 * @notice Stake SBK tokens to earn a proportional share of USDC no-show proceeds
 *         routed from the SeatBack escrow contract.
 *
 * Revenue model:
 *  - SeatBack routes 50% of every event's no-show USDC to this contract via
 *    `receiveProceeds()`, called internally by SeatBack.withdrawNoShowProceeds().
 *  - Stakers earn USDC proportional to their share of total staked SBK at the
 *    time each deposit arrives (reward-per-token accumulator pattern).
 *  - Stakers may claim rewards or unstake only after a 24-hour cooldown since
 *    their last stake/top-up.
 *
 * Security properties:
 *  - Uses a standard reward-per-token accumulator (like Synthetix StakingRewards)
 *    to avoid looping over stakers — O(1) per operation regardless of staker count.
 *  - ReentrancyGuard on all state-mutating external functions.
 *  - SafeERC20 for all token transfers.
 *  - Only the authorised SeatBack contract can call receiveProceeds().
 *  - seatBack is immutable after deployment.
 *
 * Precision:
 *  - SBK uses 18 decimals; USDC uses 6 decimals.
 *  - rewardPerTokenStored uses a PRECISION multiplier of 1e30 to preserve
 *    accuracy when dividing small USDC amounts across large SBK stakes.
 */
contract SeatBackStaking is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev Scaling factor to preserve precision: USDC(6 dec) / SBK(18 dec)
    uint256 private constant PRECISION = 1e30;

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable sbk;
    IERC20 public immutable usdc;

    /// @notice Address of the SeatBack escrow contract authorised to push proceeds.
    address public immutable seatBack;

    /// @notice Total SBK currently staked across all stakers.
    uint256 public totalStaked;

    /// @notice Accumulated USDC reward per SBK token staked (scaled by PRECISION).
    uint256 public rewardPerTokenStored;

    /// @notice Rounding remainder carried to the next distribution, in USDC units
    ///         scaled by PRECISION (always < totalStaked at the time it was left).
    ///         Never exceeds what has actually been deposited, so rewards stay fully backed.
    uint256 public rewardRemainderScaled;

    /// @notice USDC proceeds received while no stakers exist; claimable only by owner.
    uint256 public ownerReserve;

    /// @notice SBK balance staked by each address.
    mapping(address => uint256) public stakedBalance;

    /// @notice Snapshot of rewardPerTokenStored at the last update for each staker.
    mapping(address => uint256) public rewardPerTokenPaid;

    /// @notice Accumulated but unclaimed USDC rewards for each staker.
    mapping(address => uint256) public pendingRewards;

    /// @notice Timestamp when each staker last staked. Used for MEV cooldown.
    mapping(address => uint256) public stakeTimestamp;

    /// @notice Seconds a staker must wait before claiming rewards or unstaking after stake.
    ///         24 hours. Prevents same-block flash-stake-and-claim attacks.
    ///         Note: rewards distributed during the cooldown window accrue normally
    ///         and are claimable once the 24h gate passes. Truly forfeiting mid-cooldown
    ///         rewards would require O(n) per-staker updates on every receiveProceeds(),
    ///         which is not feasible at scale. The protection is: no staker can claim
    ///         within 24h of their last stake, blocking atomic/near-atomic sniping.
    uint256 public constant STAKE_COOLDOWN_SECONDS = 24 hours;

    /// @notice Minimum SBK that must be staked to participate in distributions.
    ///         Prevents dust-stake attacks on undistributedProceeds.
    uint256 public constant MIN_STAKE = 1e18; // 1 SBK

    // ─── Events ───────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event ProceedsReceived(uint256 amount, uint256 newRewardPerToken);
    event OwnerReserveWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAmount();
    error BelowMinStake();
    error InsufficientStake();
    error NoPendingReward();
    error Unauthorized();
    error InvalidAddress();
    error NoStakers();
    error StillInCooldown();
    error OwnershipRenunciationDisabled();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _sbk, address _usdc, address _seatBack, address _owner)
        Ownable(_owner)
    {
        if (_sbk == address(0) || _usdc == address(0) || _seatBack == address(0)) {
            revert InvalidAddress();
        }
        sbk = IERC20(_sbk);
        usdc = IERC20(_usdc);
        seatBack = _seatBack;
    }

    // ─── Owner functions ──────────────────────────────────────────────────────

    /// @dev Renouncing would permanently strand ownerReserve (present and future).
    ///      Ownership can still be handed over, with a two-step accept to avoid typos.
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    /**
     * @notice Withdraw proceeds that arrived while no stakers were present.
     */
    function withdrawOwnerReserve(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 amount = ownerReserve;
        if (amount == 0) revert NoPendingReward();
        ownerReserve = 0;
        usdc.safeTransfer(to, amount);
        emit OwnerReserveWithdrawn(to, amount);
    }

    // ─── Core functions ───────────────────────────────────────────────────────

    /**
     * @notice Stake SBK to begin earning USDC rewards.
     * @param amount Amount of SBK to stake (18 decimals).
     */
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        // Enforce minimum stake to prevent dust-stake attacks on undistributedProceeds
        if (stakedBalance[msg.sender] + amount < MIN_STAKE) revert BelowMinStake();

        // Harvest rewards earned up to the current accumulator before mutating stake.
        _updateReward(msg.sender);

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;

        // Reset cooldown on every stake / top-up.
        stakeTimestamp[msg.sender] = block.timestamp;

        sbk.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake SBK. Pending USDC rewards are harvested automatically.
     * @param amount Amount of SBK to withdraw.
     */
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert InsufficientStake();
        if (isInCooldown(msg.sender)) revert StillInCooldown();

        _updateReward(msg.sender);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        sbk.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim all accumulated USDC rewards without changing stake.
     */
    function claimReward() external nonReentrant {
        if (isInCooldown(msg.sender)) revert StillInCooldown();

        _updateReward(msg.sender);

        uint256 reward = pendingRewards[msg.sender];
        if (reward == 0) revert NoPendingReward();

        pendingRewards[msg.sender] = 0;

        usdc.safeTransfer(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Convenience: unstake all SBK and claim all USDC in one transaction.
     */
    function exit() external nonReentrant {
        if (isInCooldown(msg.sender)) revert StillInCooldown();

        _updateReward(msg.sender);

        uint256 staked = stakedBalance[msg.sender];
        uint256 reward = pendingRewards[msg.sender];

        if (staked > 0) {
            stakedBalance[msg.sender] = 0;
            totalStaked -= staked;
            sbk.safeTransfer(msg.sender, staked);
            emit Unstaked(msg.sender, staked);
        }

        if (reward > 0) {
            pendingRewards[msg.sender] = 0;
            usdc.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    /**
     * @notice Receive 50% of an event's no-show USDC proceeds from SeatBack.
     * @dev Called by SeatBack.withdrawNoShowProceeds(). Updates rewardPerToken
     *      immediately — any staker who calls after this sees the new rewards.
     *      If no one is staking, proceeds are held in ownerReserve and are not
     *      distributable to future stakers.
     * @param amount USDC amount (6 decimals) to distribute to stakers.
     */
    function receiveProceeds(uint256 amount) external nonReentrant {
        if (msg.sender != seatBack) revert Unauthorized();
        if (amount == 0) revert ZeroAmount();

        // USDC must already be in this contract (transferred by SeatBack before this call).
        // Verify actual balance to guard against reward inflation attacks.
        uint256 bal = usdc.balanceOf(address(this));
        // bal must be >= amount (sanity; SeatBack transfers first, then calls us).
        // We do not revert here to avoid blocking SeatBack — just distribute what arrived.
        uint256 toDistribute = amount > bal ? bal : amount;

        if (totalStaked == 0) {
            // No stakers yet — reserve these proceeds for owner withdrawal.
            ownerReserve += toDistribute;
            emit ProceedsReceived(toDistribute, rewardPerTokenStored);
            return;
        }

        _distribute(toDistribute);

        emit ProceedsReceived(toDistribute, rewardPerTokenStored);
    }

    /**
     * @dev Add `amount` USDC to the reward accumulator without ever allocating more
     *      than was deposited. The division remainder is carried in scaled units, so
     *      it is added once and cannot be counted twice.
     */
    function _distribute(uint256 amount) internal {
        uint256 numerator = amount * PRECISION + rewardRemainderScaled;
        rewardPerTokenStored += numerator / totalStaked;
        rewardRemainderScaled = numerator % totalStaked;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Current pending USDC reward for a staker (including unaccrued).
     */
    function pendingReward(address user) external view returns (uint256) {
        uint256 accrued = (stakedBalance[user] * (rewardPerTokenStored - rewardPerTokenPaid[user]))
            / PRECISION;
        return pendingRewards[user] + accrued;
    }

    /**
     * @notice Whether a staker is still within cooldown after their last stake/top-up.
     */
    function isInCooldown(address user) public view returns (bool) {
        return block.timestamp < stakeTimestamp[user] + STAKE_COOLDOWN_SECONDS;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @dev Snapshot the staker's reward debt before any state change.
     *      Must be called at the start of stake(), unstake(), claimReward(), exit().
     */
    function _updateReward(address user) internal {
        if (user == address(0)) {
            return;
        }

        uint256 rpt = rewardPerTokenStored;
        uint256 accrued = (stakedBalance[user] * (rpt - rewardPerTokenPaid[user])) / PRECISION;
        pendingRewards[user] += accrued;
        rewardPerTokenPaid[user] = rpt;
    }
}
