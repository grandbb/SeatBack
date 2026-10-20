// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/access/Ownable.sol";

/**
 * @title  SeatBackStaking
 * @notice Stake SBK to earn 50% of no-show USDC proceeds from SeatBack events.
 *
 * Constructor arguments (fill these in Remix before Deploy):
 *   _sbk      = SeatBackToken address   (from Step 1)
 *   _usdc     = 0x3600000000000000000000000000000000000000  (Arc Mainnet USDC)
 *   _seatBack = SeatBack escrow address  (from Step 3 — use 0x0000000000000000000000000000000000000001 as placeholder now, update later)
 *   _owner    = YOUR wallet address
 */
contract SeatBackStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant PRECISION = 1e30;

    IERC20 public immutable sbk;
    IERC20 public immutable usdc;
    address public seatBack;

    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public undistributedProceeds;

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public rewardPerTokenPaid;
    mapping(address => uint256) public pendingRewards;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event ProceedsReceived(uint256 amount, uint256 newRewardPerToken);
    event SeatBackUpdated(address indexed oldAddress, address indexed newAddress);

    error ZeroAmount();
    error InsufficientStake();
    error NoPendingReward();
    error Unauthorized();
    error InvalidAddress();

    constructor(address _sbk, address _usdc, address _seatBack, address _owner)
        Ownable(_owner)
    {
        require(_sbk != address(0) && _usdc != address(0), "invalid address");
        sbk      = IERC20(_sbk);
        usdc     = IERC20(_usdc);
        seatBack = _seatBack; // can be placeholder 0x000...001, update via setSeatBack()
    }

    function setSeatBack(address _seatBack) external onlyOwner {
        if (_seatBack == address(0)) revert InvalidAddress();
        emit SeatBackUpdated(seatBack, _seatBack);
        seatBack = _seatBack;
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _updateReward(msg.sender);
        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
        sbk.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert InsufficientStake();
        _updateReward(msg.sender);
        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        sbk.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant {
        _updateReward(msg.sender);
        uint256 reward = pendingRewards[msg.sender];
        if (reward == 0) revert NoPendingReward();
        pendingRewards[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

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

    function receiveProceeds(uint256 amount) external nonReentrant {
        if (msg.sender != seatBack) revert Unauthorized();
        if (amount == 0) revert ZeroAmount();
        uint256 bal = usdc.balanceOf(address(this));
        uint256 toDistribute = amount > bal ? bal : amount;
        if (totalStaked == 0) {
            undistributedProceeds += toDistribute;
            emit ProceedsReceived(toDistribute, rewardPerTokenStored);
            return;
        }
        uint256 total = toDistribute + undistributedProceeds;
        undistributedProceeds = 0;
        uint256 delta = (total * PRECISION) / totalStaked;
        rewardPerTokenStored += delta;
        emit ProceedsReceived(total, rewardPerTokenStored);
    }

    function pendingReward(address user) external view returns (uint256) {
        uint256 accrued = (stakedBalance[user] * (rewardPerTokenStored - rewardPerTokenPaid[user])) / PRECISION;
        return pendingRewards[user] + accrued;
    }

    function _updateReward(address user) internal {
        uint256 accrued = (stakedBalance[user] * (rewardPerTokenStored - rewardPerTokenPaid[user])) / PRECISION;
        pendingRewards[user] += accrued;
        rewardPerTokenPaid[user] = rewardPerTokenStored;
    }
}
