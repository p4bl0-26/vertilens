# Veritas (Nexora-web3)

**Live App:** [https://veritas-beta-green.vercel.app/](https://veritas-beta-green.vercel.app/)

![Banner Placeholder](https://via.placeholder.com/1200x300?text=Veritas+Web3+Monorepo)

**Veritas** (also referred to as *nexora-web3*) is a full-stack Web3 application designed to anchor and verify the provenance of digital content on the **Monad Testnet**. It allows users to register digital assets, securely hash their contents, and store an immutable record on-chain.

## 🚀 Key Features

- **Decentralized Provenance**: Securely anchor SHA-256 hashes of digital files on-chain.
- **Monad Testnet Integration**: Fast and gas-efficient smart contract interactions.
- **Modern Web3 Frontend**: Built with Next.js, Wagmi, viem, and RainbowKit.
- **AI Integration**: Powered by OpenAI and Anthropic SDKs.
- **Robust Smart Contracts**: Developed and tested using Foundry.

## 🏗️ Architecture & Monorepo Structure

This project uses **npm workspaces** to manage a monorepo setup:

- **[`/frontend`](./frontend/)**: The Next.js web application. Handles the user interface, wallet connections, Supabase backend integration, and interacting with the smart contracts.
- **[`/contracts`](./contracts/)**: The Solidity smart contracts. Uses the **Foundry** toolchain for compiling, testing, and deploying the `ProvenanceRegistry` contract.
- **[`/packages`](./packages/)**: Shared internal dependencies (e.g., `shared-types`) used across workspaces.

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for smart contract development)

## 📦 Getting Started

### 1. Clone & Install Dependencies
From the root of the project, install all dependencies across the workspaces:
```bash
npm install
```

### 2. Configure Environment Variables
You need to set up environment variables for the frontend. Navigate to the `frontend` directory and copy the example file:
```bash
cd frontend
cp .env.example .env.local
```
*(Fill in the required Supabase and WalletConnect keys inside the `.env.local` file).*

### 3. Run the Development Server
You can start the frontend development server from the root directory using the workspace script:
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

### 4. Smart Contract Development
To compile or test the smart contracts, navigate to the `contracts` directory:
```bash
cd contracts
forge build
forge test
```

## 🧪 Testing

This project uses **Playwright** for End-to-End (E2E) testing on the frontend.
To run the E2E tests:
```bash
npx playwright test
```

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to structure your PRs and follow our conventions.
