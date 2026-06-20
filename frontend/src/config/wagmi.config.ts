/**
 * @file wagmi.config.ts
 * @description Wagmi v2 client configuration.
 *
 * Configures:
 *  - Supported chains (from chains.config.ts)
 *  - Wallet connectors (injected, WalletConnect, Coinbase)
 *  - Per-chain HTTP + WebSocket transports via Alchemy / public RPC
 *  - SSR-safe storage
 */

import { createConfig, http, webSocket, fallback } from "wagmi";

import { SUPPORTED_CHAINS } from "./chains.config";

// ─────────────────────────────────────────────────────────────────────────────
// Environment-driven RPC URLs
// ─────────────────────────────────────────────────────────────────────────────

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

if (!WALLETCONNECT_PROJECT_ID && typeof window !== "undefined") {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. " +
    "WalletConnect will not function correctly.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-chain transport builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a viem transport for a given chain ID.
 * Falls back to the public RPC if Alchemy is not configured.
 *
 * Priority: Alchemy HTTP → Alchemy WS → public RPC fallback
 */
function buildTransport(chainId: number) {
  const alchemySubdomains: Record<number, string> = {
    1:        "eth-mainnet",
    11155111: "eth-sepolia",
    8453:     "base-mainnet",
    84532:    "base-sepolia",
    10:       "opt-mainnet",
    11155420: "opt-sepolia",
    42161:    "arb-mainnet",
    421614:   "arb-sepolia",
  };

  const subdomain = alchemySubdomains[chainId];

  if (ALCHEMY_API_KEY && subdomain) {
    return fallback([
      http(`https://${subdomain}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      webSocket(`wss://${subdomain}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
    ]);
  }

  // Public RPC fallback (rate-limited — replace with a paid RPC for production)
  return http();
}

// ─────────────────────────────────────────────────────────────────────────────
// Connectors
// ─────────────────────────────────────────────────────────────────────────────

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { RAINBOWKIT_WALLETS } from "./rainbowkit.config";

const connectors = connectorsForWallets(
  RAINBOWKIT_WALLETS,
  {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Veritas",
    projectId: WALLETCONNECT_PROJECT_ID,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Transport map
// ─────────────────────────────────────────────────────────────────────────────

const transports = Object.fromEntries(
  SUPPORTED_CHAINS.map((chain) => [chain.id, buildTransport(chain.id)]),
) as Record<(typeof SUPPORTED_CHAINS)[number]["id"], ReturnType<typeof buildTransport>>;

// ─────────────────────────────────────────────────────────────────────────────
// Wagmi config
// ─────────────────────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains:     SUPPORTED_CHAINS,
  connectors,
  transports,
  ssr:        false, // Disabled to prevent hydration mismatch
  batch: {
    multicall: {
      batchSize: 1_024,  // Max bytes per multicall batch
      wait:      16,     // ms to wait before flushing batch
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Type augmentation — ensures useChainId(), useChains() etc. are strongly typed
// ─────────────────────────────────────────────────────────────────────────────

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
