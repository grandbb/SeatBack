// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SeatBack} from "../SeatBack.sol";

/**
 * @title DeploySeatBack
 * @notice Deploys SeatBack to the network supplied via `--rpc-url`.
 *
 * Required env vars:
 *   PRIVATE_KEY          — deployer private key (never commit; use hardware wallet for mainnet)
 *   USDC_ADDRESS         — USDC ERC-20 address on the target network
 *                          Arc Mainnet: 0x3600000000000000000000000000000000000000
 *                          Arc Testnet: 0x3600000000000000000000000000000000000000
 *
 * Optional env vars:
 *   SALT                 — bytes32 Create2 salt for a deterministic address (default: 0)
 *
 * Run (dry run, no broadcast):
 *   forge script contracts/script/DeploySeatBack.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     -vvv
 *
 * Run (broadcast — MAINNET, requires confirmed approval):
 *   forge script contracts/script/DeploySeatBack.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --broadcast \
 *     --private-key $PRIVATE_KEY \
 *     -vvv
 *
 * IMPORTANT: Verify the deployed address on the explorer before setting
 *            VITE_MAINNET_SEATBACK_ADDRESS in Vercel.
 *
 * IMPORTANT: Never pass --private-key on mainnet. Use a hardware wallet:
 *   forge script ... --ledger --hd-paths "m/44'/60'/0'/0/0"
 */
contract DeploySeatBack is Script {
    function run() external returns (address seatback) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        require(usdc != address(0), "DeploySeatBack: USDC_ADDRESS not set");

        console.log("Deploying SeatBack on chain %s", block.chainid);
        console.log("  USDC address: %s", usdc);
        console.log("  Deployer:     %s", msg.sender);

        vm.startBroadcast();
        seatback = address(new SeatBack(usdc));
        vm.stopBroadcast();

        console.log("SeatBack deployed at: %s", seatback);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Verify on explorer: https://explorer.arc.io/address/%s", seatback);
        console.log("  2. Set VITE_MAINNET_SEATBACK_ADDRESS=%s in Vercel environment variables", seatback);
        console.log("  3. Confirm bytecode matches: forge verify-contract %s contracts/SeatBack.sol:SeatBack", seatback);
    }
}
