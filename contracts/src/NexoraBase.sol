// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NexoraBase
 * @dev Base contract with standard access control for Nexora Web3 platform
 */
contract NexoraBase is AccessControl, Ownable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    constructor(address initialOwner) Ownable(initialOwner) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ADMIN_ROLE, initialOwner);
    }

    /**
     * @dev Restricts access to accounts with the EXECUTOR_ROLE
     */
    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "NexoraBase: must have executor role");
        _;
    }

    /**
     * @dev Grant executor role to an address
     */
    function grantExecutorRole(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(EXECUTOR_ROLE, account);
    }

    /**
     * @dev Revoke executor role from an address
     */
    function revokeExecutorRole(address account) external onlyRole(ADMIN_ROLE) {
        revokeRole(EXECUTOR_ROLE, account);
    }
}
