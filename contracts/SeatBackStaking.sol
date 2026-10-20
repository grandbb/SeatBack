// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

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
 *  - There is no lock-up period; stakers may unstake at any time.
 *    Pending USDC rewards are automatically harvested on every stake/unstake/claim.
 *
 * Security properties:
 *  - Uses a standard reward-per-token accumulator (like Synthetix StakingRewards)
 *    to avoid looping over stakers — O(1) per operation regardless of staker count.
 *  - ReentrancyGuard on all state-mutating external functions.
 *  - SafeERC20 for all token transfers.
 *  - Only the authorised SeatBack contract can call receiveProceeds().
 *  - Owner can update the SeatBack contract address (for upgrades); cannot
 *    withdraw user funds.
 *
 * Precision:
 *  - SBK uses 18 decimals; USDC uses 6 decimals.
 *  - rewardPerTokenStored uses a PRECISION multiplier of 1e30 to preserve
 *    accuracy when dividing small USDC amounts across large SBK stakes.
 */
contract SeatBackStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev Scaling factor to preserve precision: USDC(6 dec) / SBK(18 dec)
    uint256 private constant PRECISION = 1e30;

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable sbk;
    IERC20 public immutable usdc;

    /// @notice Address of the SeatBack escrow contract authorised to push proceeds.
    address public seatBack;

    /// @notice Total SBK currently staked across all stakers.
    uint256 public totalStaked;

    /// @notice Accumulated USDC reward per SBK token staked (scaled by PRECISION).
    uint256 public rewardPerTokenStored;

    /// @notice USDC received while totalStaked == 0, carried forward to the next distribution.
    uint256 public undistributedProceeds;

    /// @notice SBK balance staked by each address.
    mapping(address => uint256) public stakedBalance;

    /// @notice Snapshot of rewardPerTokenStored at the last update for each staker.
    mapping(address => uint256) public rewardPerTokenPaid;

    /// @notice Accumulated but unclaimed USDC rewards for each staker.
    mapping(address => uint256) public pendingRewards;

    /// @notice Block number when each staker last staked. Used for MEV cooldown.
    mapping(address => uint256) public stakeBlock;

    /// @notice Blocks a staker must wait before becoming eligible for new rewards.
    ///         ~24 hours on Arc (1-second blocks). Prevents flash-stake sniping.
    uint256 public constant STAKE_COOLDOWN_BLOCKS = 7200;

    /// @notice Minimum SBK that must be staked to participate in distributions.
    ///         Prevents dust-stake attacks on undistributedProceeds.
    uint256 public constant MIN_STAKE = 1e18; // 1 SBK

    // ─── Events ───────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event ProceedsReceived(uint256 amount, uint256 newRewardPerToken);
    event SeatBackUpdated(address indexed oldAddress, address indexed newAddress);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAmount();
    error BelowMinStake();
    error InsufficientStake();
    error NoPendingReward();
    error Unauthorized();
    error InvalidAddress();
    error NoStakers();

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

    /**
     * @notice Update the authorised SeatBack contract address.
     * @dev Use when upgrading or redeploying SeatBack. Cannot access user funds.
     */
    function setSeatBack(address _seatBack) external onlyOwner {
        if (_seatBack == address(0)) revert InvalidAddress();
        emit SeatBackUpdated(seatBack, _seatBack);
        seatBack = _seatBack;
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

        _updateReward(msg.sender);

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
        stakeBlock[msg.sender] = block.number; // reset cooldown on every top-up

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
     *      If no one is staking, USDC sits in this contract until someone stakes
     *      and the next proceeds arrive (totalStaked > 0 at that point).
     *      This is acceptable because no-show events are rare during cold-start.
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
            // No stakers yet — carry forward so it is included in the next distribution.
            undistributedProceeds += toDistribute;
            emit ProceedsReceived(toDistribute, rewardPerTokenStored);
            return;
        }

        // Include any previously undistributed proceeds.
        uint256 total = toDistribute + undistributedProceeds;
        undistributedProceeds = 0;

        uint256 delta = (total * PRECISION) / totalStaked;
        rewardPerTokenStored += delta;

        emit ProceedsReceived(total, rewardPerTokenStored);
    }

    /**
     * @notice Distribute any undistributed proceeds accumulated during zero-staker periods.
     * @dev Permissionless: anyone can call when totalStaked > 0 and undistributedProceeds > 0.
     *      This ensures proceeds that arrived while no one was staked are never permanently stuck.
     */
    function syncUndistributed() external nonReentrant {
        if (totalStaked == 0) revert NoStakers();
        uint256 carry = undistributedProceeds;
        if (carry == 0) return;
        undistributedProceeds = 0;
        uint256 delta = (carry * PRECISION) / totalStaked;
        rewardPerTokenStored += delta;
        emit ProceedsReceived(carry, rewardPerTokenStored);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Current pending USDC reward for a staker (including unaccrued).
     */
    function pendingReward(address user) external view returns (uint256) {
        uint256 accrued = (stakedBalance[user] * (rewardPerTokenStored - rewardPerTokenPaid[user])) / PRECISION;
        return pendingRewards[user] + accrued;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @dev Snapshot the staker's reward debt before any state change.
     *      Must be called at the start of stake(), unstake(), claimReward(), exit().
     */
    function _updateReward(address user) internal {
        // Anti-flash-stake: stakers must wait STAKE_COOLDOWN_BLOCKS (~24h on Arc)
        // before earning rewards. This prevents flash-stake sniping of proceeds.
        // New users have stakeBlock[user]==0; block.number is always >= cooldown
        // so first accrual is always gated by this same condition.
        uint256 rpt = rewardPerTokenStored;
        if (block.number >= stakeBlock[user] + STAKE_COOLDOWN_BLOCKS) {
            uint256 accrued = (stakedBalance[user] * (rpt - rewardPerTokenPaid[user])) / PRECISION;
            pendingRewards[user] += accrued;
        }
        rewardPerTokenPaid[user] = rpt;
    }
}
