// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// @openzeppelin/contracts v5
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/ERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/access/Ownable.sol";

/**
 * @title  SeatBackToken
 * @notice SEATBACK (SBK) — 100,000,000 fixed supply. No mint after deploy.
 *         ERC-20 + ERC-20Permit (gasless approvals).
 *
 * Constructor argument:
 *   initialOwner — receives all 100M SBK. Use YOUR wallet address.
 */
contract SeatBackToken is ERC20, ERC20Permit, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 1e18;

    constructor(address initialOwner)
        ERC20("SeatBack", "SBK")
        ERC20Permit("SeatBack")
        Ownable(initialOwner)
    {
        _mint(initialOwner, TOTAL_SUPPLY);
    }
}
