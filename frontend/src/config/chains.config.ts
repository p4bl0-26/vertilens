/**
 * @file chains.config.ts
 * @description Supported EVM chain definitions for the platform.
 *
 * Add or remove chains here to control multi-chain support globally.
 * All chain objects are viem-compatible and consumed by wagmi.config.ts.
 */

import {
  mainnet,
  sepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  polygon,
  polygonMumbai,
} from "viem/chains";
import type { Chain } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// Supported chains
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ordered list of chains supported by this deployment.
 * The first entry is treated as the default chain.
 *
 * For hackathon / testnet builds, reorder so testnets come first.
 */
export const SUPPORTED_CHAINS = [
  sepolia,
  baseSepolia,
  optimismSepolia,
  arbitrumSepolia,
  polygonMumbai,
  // ── Mainnets (comment out for testnet-only builds) ─────────────────────────
  // mainnet,
  // base,
  // optimism,
  // arbitrum,
  // polygon,
] as const satisfies readonly [Chain, ...Chain[]];

/** Type-safe tuple of all supported chains. */
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

/** Type-safe union of all supported chain IDs. */
export type SupportedChainId = SupportedChain["id"];

/** The default chain used when no chain preference is set. */
export const DEFAULT_CHAIN = SUPPORTED_CHAINS[0] satisfies Chain;

/** Set of all supported chain IDs for O(1) lookup. */
export const SUPPORTED_CHAIN_IDS = new Set<number>(
  SUPPORTED_CHAINS.map((c) => c.id),
);

// ─────────────────────────────────────────────────────────────────────────────
// Chain metadata (display labels, explorer URLs, native currency)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainMeta {
  /** Short display name. */
  label: string;
  /** Whether this is a testnet. */
  isTestnet: boolean;
  /** Block explorer base URL (no trailing slash). */
  explorerUrl: string;
  /** Native token symbol. */
  nativeCurrency: string;
  /** Hex color for UI badge. */
  color: string;
  /** Logo filename (resolved from /public/chains/). */
  logoFile: string;
}

export const CHAIN_META: Record<number, ChainMeta> = {
  // ── Testnets ────────────────────────────────────────────────────────────────
  [sepolia.id]: {
    label:          "Sepolia",
    isTestnet:      true,
    explorerUrl:    "https://sepolia.etherscan.io",
    nativeCurrency: "ETH",
    color:          "#627EEA",
    logoFile:       "ethereum.svg",
  },
  [baseSepolia.id]: {
    label:          "Base Sepolia",
    isTestnet:      true,
    explorerUrl:    "https://sepolia.basescan.org",
    nativeCurrency: "ETH",
    color:          "#0052FF",
    logoFile:       "base.svg",
  },
  [optimismSepolia.id]: {
    label:          "OP Sepolia",
    isTestnet:      true,
    explorerUrl:    "https://sepolia-optimism.etherscan.io",
    nativeCurrency: "ETH",
    color:          "#FF0420",
    logoFile:       "optimism.svg",
  },
  [arbitrumSepolia.id]: {
    label:          "Arb Sepolia",
    isTestnet:      true,
    explorerUrl:    "https://sepolia.arbiscan.io",
    nativeCurrency: "ETH",
    color:          "#12AAFF",
    logoFile:       "arbitrum.svg",
  },
  [polygonMumbai.id]: {
    label:          "Mumbai",
    isTestnet:      true,
    explorerUrl:    "https://mumbai.polygonscan.com",
    nativeCurrency: "MATIC",
    color:          "#8247E5",
    logoFile:       "polygon.svg",
  },
  // ── Mainnets ────────────────────────────────────────────────────────────────
  [mainnet.id]: {
    label:          "Ethereum",
    isTestnet:      false,
    explorerUrl:    "https://etherscan.io",
    nativeCurrency: "ETH",
    color:          "#627EEA",
    logoFile:       "ethereum.svg",
  },
  [base.id]: {
    label:          "Base",
    isTestnet:      false,
    explorerUrl:    "https://basescan.org",
    nativeCurrency: "ETH",
    color:          "#0052FF",
    logoFile:       "base.svg",
  },
  [optimism.id]: {
    label:          "Optimism",
    isTestnet:      false,
    explorerUrl:    "https://optimistic.etherscan.io",
    nativeCurrency: "ETH",
    color:          "#FF0420",
    logoFile:       "optimism.svg",
  },
  [arbitrum.id]: {
    label:          "Arbitrum",
    isTestnet:      false,
    explorerUrl:    "https://arbiscan.io",
    nativeCurrency: "ETH",
    color:          "#12AAFF",
    logoFile:       "arbitrum.svg",
  },
  [polygon.id]: {
    label:          "Polygon",
    isTestnet:      false,
    explorerUrl:    "https://polygonscan.com",
    nativeCurrency: "MATIC",
    color:          "#8247E5",
    logoFile:       "polygon.svg",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the given chain ID is supported by this platform. */
export const isSupportedChain = (chainId: number): chainId is SupportedChainId =>
  SUPPORTED_CHAIN_IDS.has(chainId);

/** Returns the ChainMeta for a chain ID, or undefined if unsupported. */
export const getChainMeta = (chainId: number): ChainMeta | undefined =>
  CHAIN_META[chainId];

/** Returns the block explorer transaction URL for a given chain + tx hash. */
export const getExplorerTxUrl = (chainId: number, txHash: string): string | null => {
  const meta = CHAIN_META[chainId];
  return meta ? `${meta.explorerUrl}/tx/${txHash}` : null;
};

/** Returns the block explorer address URL for a given chain + address. */
export const getExplorerAddressUrl = (chainId: number, address: string): string | null => {
  const meta = CHAIN_META[chainId];
  return meta ? `${meta.explorerUrl}/address/${address}` : null;
};
