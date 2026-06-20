// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";

/**
 * @title Deploy
 * @notice Foundry deploy script for ProvenanceRegistry on Monad Testnet.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $MONAD_TESTNET_RPC \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 *
 * After deployment, copy the contract address into:
 *   frontend/src/config/contracts.config.ts
 *   (PROVENANCE_REGISTRY_ADDRESS)
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("Deploying ProvenanceRegistry...");
        console.log("  Deployer:  ", deployer);
        console.log("  Chain ID:  ", block.chainid);

        vm.startBroadcast(deployerKey);

        ProvenanceRegistry registry = new ProvenanceRegistry();

        vm.stopBroadcast();

        console.log("ProvenanceRegistry deployed at:", address(registry));
        console.log("Total registered (should be 0):", registry.totalRegistered());
    }
}
