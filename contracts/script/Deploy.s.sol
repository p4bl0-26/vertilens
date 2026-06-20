// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/IntentExecutor.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the IntentExecutor contract
        IntentExecutor executor = new IntentExecutor(deployer);
        
        // Example: Granting an initial executor role to a backend service wallet
        // address backendServiceWallet = vm.envAddress("BACKEND_WALLET");
        // executor.grantExecutorRole(backendServiceWallet);

        vm.stopBroadcast();

        console.log("IntentExecutor deployed to:", address(executor));
        console.log("Deployed by:", deployer);
    }
}
