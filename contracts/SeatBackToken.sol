// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SeatBackToken
 * @notice SEATBACK (SBK) — protocol utility token for the SeatBack event escrow system.
 *
 * Properties:
 *  - Fixed supply of 100,000,000 SBK minted in full to the deployer at construction.
 *  - No mint function after deployment — supply is immutable.
 *  - ERC-20Permit (EIP-2612) for gasless approvals.
 *  - 18 decimals (standard ERC-20).
 *
 * Allocation (off-chain distribution — deployer distributes):
 *  - 30% Airdrop (early users: reserve / check-in activity)
 *  - 25% Ecosystem / grants
 *  - 20% Team (vested off-chain)
 *  - 15% Treasury
 *  - 10% Staking bootstrap rewards
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
