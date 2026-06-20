# Veritas Frontend

This directory contains the Next.js web application for the Veritas platform.

## 🚀 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Web3 Integration**: 
  - [Wagmi](https://wagmi.sh/)
  - [viem](https://viem.sh/)
  - [RainbowKit](https://www.rainbowkit.com/)
- **Backend/Database**: [Supabase](https://supabase.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **AI Integrations**: OpenAI & Anthropic SDKs

## 📦 Installation

This workspace is managed by the root `package.json`. To install dependencies, run the following from the **root** of the monorepo:

```bash
npm install
```

## ⚙️ Environment Setup

Create a `.env.local` file in this `frontend` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Web3 / WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# AI Keys (If running server-side actions)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 💻 Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🏗️ Build & Production

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

## 🧩 Structure & Workflows

1. **Wallet Connection**: Users connect their Web3 wallets via RainbowKit.
2. **Registration**: 
   - A digital asset is uploaded or specified.
   - The file is hashed (SHA-256) locally or via the backend.
   - The hash is saved in the Supabase database along with off-chain metadata.
   - A transaction is requested via Wagmi to call `anchorHash(bytes32)` on the Monad Testnet smart contract.
3. **Verification**: 
   - Users can verify assets by checking the hash against the `ProvenanceRegistry` contract using `viem` to ensure data integrity and track origin timestamps.
