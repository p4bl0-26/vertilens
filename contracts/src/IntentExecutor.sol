// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NexoraBase.sol";
import "./NexoraEvents.sol";

/**
 * @title IntentExecutor
 * @dev Example contract for executing arbitrary on-chain intents
 */
contract IntentExecutor is NexoraBase {
    constructor(address initialOwner) NexoraBase(initialOwner) {}

    /**
     * @dev Execute an arbitrary call to a target contract
     * Only accounts with EXECUTOR_ROLE can call this function
     */
    function executeTask(
        string calldata intentId,
        string calldata taskId,
        address target,
        uint256 value,
        bytes calldata data
    ) external payable onlyExecutor returns (bool success, bytes memory returnData) {
        require(target != address(0), "IntentExecutor: target cannot be zero address");

        // Forward the value if provided
        (success, returnData) = target.call{value: value}(data);

        // Emit the execution event
        emit NexoraEvents.TaskExecuted(
            intentId,
            taskId,
            target,
            value,
            data,
            success
        );

        return (success, returnData);
    }

    /**
     * @dev Allow the contract to receive ETH
     */
    receive() external payable {}
}
