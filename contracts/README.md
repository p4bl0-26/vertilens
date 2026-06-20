# Veritas Smart Contracts

This directory contains the smart contracts for the Veritas (nexora-web3) project, built and tested using **Foundry**.

## 📖 Overview

The core contract is **`ProvenanceRegistry.sol`**. It acts as an on-chain registry for digital content provenance, specifically targeted for the **Monad Testnet**.

### How It Works
1. **Hashing**: The backend or frontend computes a SHA-256 hash of the raw file bytes of a digital asset.
2. **Anchoring**: The `anchorHash(bytes32)` function is called to write an immutable, timestamped record of that hash on-chain, mapped to the caller's wallet address.
3. **Verification**: The `verifyAsset(bytes32)` or `isRegistered(bytes32)` functions are used to check if an asset is authentic and to retrieve its origin timestamp.

## 🛠️ Prerequisites

You must have [Foundry](https://book.getfoundry.sh/getting-started/installation) installed.
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 💻 Commands

### Build
Compile the smart contracts:
```bash
forge build
```

### Test
Run the test suite:
```bash
forge test
```

### Format
Format the Solidity code:
```bash
forge fmt
```

### Gas Snapshots
Generate gas snapshots for the contract functions:
```bash
forge snapshot
```

## 🚀 Deployment

Deployment scripts are located in the `script/` directory.

To deploy to the **Monad Testnet**, you will need a funded wallet and the Monad RPC URL.

1. Create a `.env` file in this directory:
```bash
MONAD_TESTNET_RPC_URL="https://testnet-rpc.monad.xyz"
PRIVATE_KEY="your_private_key_here"
```

2. Run the deployment script using `forge script` (example command, adjust script name as needed):
```bash
forge script script/DeployProvenance.s.sol --rpc-url $MONAD_TESTNET_RPC_URL --broadcast
```

## 📐 Design Principles
- **Simplicity first**: No access control beyond ownership of the anchor.
- **Immutable**: Anchors cannot be modified or deleted after registration.
- **Gas-efficient**: Uses a mapping for O(1) lookup.
- **Event-driven**: All writes emit `AssetRegistered` and `AssetVerified` events for off-chain indexing.
