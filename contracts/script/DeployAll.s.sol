// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SeatBackToken} from "../SeatBackToken.sol";
import {SeatBackStaking} from "../SeatBackStaking.sol";
import {SeatBack} from "../SeatBack.sol";

/**
 * @title DeployAll
 * @notice Deploys the full SeatBack v2 system:
 *   1. SeatBackToken  (SBK ERC-20, 100M supply → deployer)
 *   2. SeatBackStaking (receives 50% of no-show USDC → distributes to SBK stakers)
 *   3. SeatBack        (escrow + EIP-712 check-in, routes no-show proceeds 50/50)
 *   4. Wires them together: SeatBack.setStakingPool(stakingAddress)
 *
 * Usage (Arc Mainnet):
 *   USDC_ADDRESS=0x3600000000000000000000000000000000000000 \
 *   ADMIN_ADDRESS=<your_wallet> \
 *   forge script contracts/script/DeployAll.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --broadcast \
 *     --interactive \
 *     -vvv
 *
 * Usage (Arc Testnet):
 *   USDC_ADDRESS=0x3600000000000000000000000000000000000000 \
 *   ADMIN_ADDRESS=<your_wallet> \
 *   forge script contracts/script/DeployAll.s.sol \
 *     --rpc-url https://rpc.testnet.arc.io \
 *     --broadcast \
 *     --interactive \
 *     -vvv
 *
 * After deploy:
 *   Copy the three addresses printed below into .env:
 *     VITE_MAINNET_SEATBACK_ADDRESS=<SeatBack address>
 *     VITE_MAINNET_SBK_ADDRESS=<SeatBackToken address>
 *     VITE_MAINNET_STAKING_ADDRESS=<SeatBackStaking address>
 */
contract DeployAll is Script {
    function run() external {
        address usdc    = vm.envAddress("USDC_ADDRESS");
        address adminWallet = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast();

        // 1. Deploy SBK token — full supply minted to deployer/admin
        SeatBackToken token = new SeatBackToken(adminWallet);
        console.log("SeatBackToken (SBK):", address(token));

        // 2. Deploy staking pool — SBK + USDC + placeholder SeatBack (updated below)
        //    We deploy SeatBack next, so we pass address(0) temporarily and update via setSeatBack.
        //    Actually: deploy SeatBack first with admin, then create staking referencing SeatBack.
        //    Order: Token → SeatBack → Staking → SeatBack.setStakingPool(staking)

        SeatBack seatback = new SeatBack(usdc, adminWallet);
        console.log("SeatBack:           ", address(seatback));

        SeatBackStaking staking = new SeatBackStaking(
            address(token),
            usdc,
            address(seatback),
            adminWallet
        );
        console.log("SeatBackStaking:     ", address(staking));

        // 3. Wire: tell SeatBack where to route 50% of no-show proceeds
        seatback.setStakingPool(address(staking));
        console.log("setStakingPool done: ", address(staking));

        vm.stopBroadcast();

        console.log("\n=== COPY THESE INTO .env ===");
        console.log("VITE_MAINNET_SEATBACK_ADDRESS=", address(seatback));
        console.log("VITE_MAINNET_SBK_ADDRESS=", address(token));
        console.log("VITE_MAINNET_STAKING_ADDRESS=", address(staking));
    }
}
