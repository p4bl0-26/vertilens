// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NexoraEvents
 * @dev Centralized event library for the Nexora execution platform
 */
library NexoraEvents {
    /**
     * @dev Emitted when an intent execution starts
     */
    event IntentExecutionStarted(
        string indexed intentId,
        address indexed user,
        uint256 timestamp
    );

    /**
     * @dev Emitted when a specific task/step is executed on-chain
     */
    event TaskExecuted(
        string indexed intentId,
        string taskId,
        address target,
        uint256 value,
        bytes data,
        bool success
    );

    /**
     * @dev Emitted when an intent execution fully completes
     */
    event IntentExecutionCompleted(
        string indexed intentId,
        address indexed user,
        uint256 timestamp
    );

    /**
     * @dev Emitted when an intent execution fails
     */
    event IntentExecutionFailed(
        string indexed intentId,
        string reason
    );
}
