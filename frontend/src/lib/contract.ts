/**
 * @file contract.ts
 * @description Canonical source for the deployed ProvenanceRegistry contract.
 *
 * Exports:
 *   - PROVENANCE_CONTRACT_ADDRESS  — checksummed contract address (0x...)
 *   - PROVENANCE_ABI               — inline ABI (as const, fully typed)
 *   - getPublicClient()            — read-only viem PublicClient for Monad Testnet
 *   - getWalletClient()            — server-side WalletClient backed by ANCHOR_WALLET_PRIVATE_KEY
 *
 * ⚠️  SERVER-ONLY — never import getWalletClient() from a React component.
 *     ANCHOR_WALLET_PRIVATE_KEY must never be exposed to the browser.
 *
 * Re-exports monadTestnet chain definition for use in wagmi / chains.config.ts.
 *
 * @see ProvenanceRegistry.sol  — contracts/src/ProvenanceRegistry.sol
 * @see viem.ts                 — lower-level utilities (anchorHashOnChain, etc.)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Environment Variables ────────────────────────────────────────────────────

const MONAD_RPC_URL             = process.env.MONAD_RPC_URL;
const CONTRACT_ADDRESS_RAW      = process.env.CONTRACT_ADDRESS;
const ANCHOR_WALLET_PRIVATE_KEY = process.env.ANCHOR_WALLET_PRIVATE_KEY;

// Validate at module load so misconfiguration surfaces immediately.
if (!MONAD_RPC_URL) {
  throw new Error(
    "[contract] Missing env var: MONAD_RPC_URL. " +
    "Set it to the Monad Testnet JSON-RPC URL in .env.local."
  );
}

if (!CONTRACT_ADDRESS_RAW) {
  throw new Error(
    "[contract] Missing env var: CONTRACT_ADDRESS. " +
    "Set it to the deployed ProvenanceRegistry address (0x...) in .env.local."
  );
}

if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS_RAW)) {
  throw new Error(
    `[contract] CONTRACT_ADDRESS is not a valid Ethereum address: "${CONTRACT_ADDRESS_RAW}". ` +
    "Must be a 0x-prefixed 40-hex-character string."
  );
}

// ─── Contract Address ─────────────────────────────────────────────────────────

/**
 * Deployed ProvenanceRegistry address on Monad Testnet.
 * Value: 0x3da524a7becd8323dde9b4bf766be71a991dfaa0
 */
export const PROVENANCE_CONTRACT_ADDRESS: Address =
  CONTRACT_ADDRESS_RAW as Address;

// ─── Monad Testnet Chain ──────────────────────────────────────────────────────

/**
 * Viem chain definition for Monad Testnet.
 * Chain ID: 10143 | Native token: MON
 *
 * @see https://docs.monad.xyz/getting-started/network-information
 */
export const monadTestnet = defineChain({
  id:   10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name:     "Monad",
    symbol:   "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http:      [MONAD_RPC_URL],
      webSocket: [],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url:  "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

// ─── ABI ──────────────────────────────────────────────────────────────────────

/**
 * Inline ABI for the ProvenanceRegistry contract.
 *
 * Using `as const` ensures viem infers exact function/event types for
 * type-safe `readContract()` and `writeContract()` calls.
 *
 * Functions:
 *   anchorHash(bytes32)    → nonpayable — anchor a SHA-256 hash on-chain
 *   registerAsset(bytes32) → nonpayable — semantic alias for anchorHash
 *   verifyAsset(bytes32)   → view       — returns (bool found, ProvenanceRecord)
 *   isRegistered(bytes32)  → view       — returns bool
 *   getRecord(bytes32)     → view       — returns ProvenanceRecord (reverts if missing)
 *   totalRegistered()      → view       — returns uint256
 *
 * Events:
 *   AssetRegistered(bytes32 indexed, address indexed, uint256)
 *   AssetVerified(bytes32 indexed, bool, address indexed)
 *
 * Custom errors:
 *   HashAlreadyRegistered(bytes32)
 *   InvalidContentHash()
 */
export const PROVENANCE_ABI = [
  // ── Write functions ──────────────────────────────────────────────────────────
  {
    type:            "function",
    name:            "anchorHash",
    stateMutability: "nonpayable",
    inputs:          [{ name: "contentHash", type: "bytes32" }],
    outputs:         [],
  },
  {
    type:            "function",
    name:            "registerAsset",
    stateMutability: "nonpayable",
    inputs:          [{ name: "contentHash", type: "bytes32" }],
    outputs:         [],
  },
  // ── View functions ───────────────────────────────────────────────────────────
  {
    type:            "function",
    name:            "verifyAsset",
    stateMutability: "view",
    inputs:          [{ name: "contentHash", type: "bytes32" }],
    outputs: [
      { name: "found",  type: "bool" },
      {
        name: "record",
        type: "tuple",
        components: [
          { name: "contentHash",  type: "bytes32" },
          { name: "registeredBy", type: "address" },
          { name: "timestamp",    type: "uint256" },
          { name: "exists",       type: "bool"    },
        ],
      },
    ],
  },
  {
    type:            "function",
    name:            "isRegistered",
    stateMutability: "view",
    inputs:          [{ name: "contentHash", type: "bytes32" }],
    outputs:         [{ name: "", type: "bool" }],
  },
  {
    type:            "function",
    name:            "getRecord",
    stateMutability: "view",
    inputs:          [{ name: "contentHash", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "contentHash",  type: "bytes32" },
          { name: "registeredBy", type: "address" },
          { name: "timestamp",    type: "uint256" },
          { name: "exists",       type: "bool"    },
        ],
      },
    ],
  },
  {
    type:            "function",
    name:            "totalRegistered",
    stateMutability: "view",
    inputs:          [],
    outputs:         [{ name: "", type: "uint256" }],
  },
  // ── Events ───────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "AssetRegistered",
    inputs: [
      { name: "contentHash",  type: "bytes32", indexed: true  },
      { name: "registeredBy", type: "address", indexed: true  },
      { name: "timestamp",    type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AssetVerified",
    inputs: [
      { name: "contentHash", type: "bytes32", indexed: true  },
      { name: "found",       type: "bool",    indexed: false },
      { name: "queriedBy",   type: "address", indexed: true  },
    ],
  },
  // ── Custom errors ────────────────────────────────────────────────────────────
  {
    type:   "error",
    name:   "HashAlreadyRegistered",
    inputs: [{ name: "contentHash", type: "bytes32" }],
  },
  {
    type:   "error",
    name:   "InvalidContentHash",
    inputs: [],
  },
] as const;

/** TypeScript type inferred from the ABI for generic viem calls. */
export type ProvenanceAbi = typeof PROVENANCE_ABI;

// ─── Client Factories ─────────────────────────────────────────────────────────

/**
 * Returns a viem PublicClient connected to Monad Testnet.
 *
 * Use for read-only calls: `isRegistered`, `verifyAsset`, `getRecord`.
 * Does NOT require a private key — safe to call per-request.
 *
 * @example
 * const client = getPublicClient();
 * const found = await client.readContract({
 *   address: PROVENANCE_CONTRACT_ADDRESS,
 *   abi:     PROVENANCE_ABI,
 *   functionName: "isRegistered",
 *   args:    [bytes32hash],
 * });
 */
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain:     monadTestnet,
    transport: http(MONAD_RPC_URL, {
      timeout:    15_000,
      retryCount: 2,
      retryDelay: 500,
    }),
  });
}

/**
 * Returns a viem WalletClient backed by the server-side ANCHOR_WALLET_PRIVATE_KEY.
 *
 * ⚠️  SERVER-ONLY. Never call this from React components or client-side hooks.
 *     The private key is a server secret and must never reach the browser.
 *
 * @returns {{ walletClient: WalletClient, account }} Signing client and account.
 * @throws  {Error} If ANCHOR_WALLET_PRIVATE_KEY is not set.
 *
 * @example
 * const { walletClient, account } = getWalletClient();
 * const txHash = await walletClient.writeContract({ ... });
 */
export function getWalletClient(): {
  walletClient: WalletClient;
  account:      ReturnType<typeof privateKeyToAccount>;
} {
  if (!ANCHOR_WALLET_PRIVATE_KEY) {
    throw new Error(
      "[contract] Missing env var: ANCHOR_WALLET_PRIVATE_KEY. " +
      "Required for server-side transaction signing. " +
      "Add it to .env.local — NEVER prefix with NEXT_PUBLIC_."
    );
  }

  const privateKey: Hex = ANCHOR_WALLET_PRIVATE_KEY.startsWith("0x")
    ? (ANCHOR_WALLET_PRIVATE_KEY as Hex)
    : (`0x${ANCHOR_WALLET_PRIVATE_KEY}` as Hex);

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain:     monadTestnet,
    transport: http(MONAD_RPC_URL, {
      timeout:    30_000,
      retryCount: 1,
      retryDelay: 1_000,
    }),
  });

  return { walletClient, account };
}
