/**
 * @file viem.ts
 * @description Viem client factory and blockchain interaction utilities for
 *              the Veritas ProvenanceRegistry contract on Monad Testnet.
 *
 * RESPONSIBILITIES:
 *   - Define the Monad Testnet chain configuration for viem.
 *   - Expose the ProvenanceRegistry ABI (inline — no compile step needed).
 *   - Provide a `createWalletClientForAnchor()` factory for server-side signing.
 *   - Provide a `createPublicClientForMonad()` factory for read-only calls.
 *   - Implement `anchorHashOnChain()` — the core write operation.
 *   - Implement `checkIsRegistered()` — a read-only lookup helper.
 *
 * ENVIRONMENT VARIABLES REQUIRED (.env.local):
 *   MONAD_RPC_URL             — Monad Testnet JSON-RPC endpoint
 *   CONTRACT_ADDRESS          — Deployed ProvenanceRegistry address (0x...)
 *   ANCHOR_WALLET_PRIVATE_KEY — Private key of the server-side anchoring wallet
 *
 * ⚠️  SECURITY: ANCHOR_WALLET_PRIVATE_KEY is a server-side secret.
 *     NEVER prefix it with NEXT_PUBLIC_. It must never reach the browser.
 *     This module should only be imported in Next.js Route Handlers (server),
 *     never in React components or client-side hooks.
 *
 * ARCHITECTURE NOTE — SERVER-SIDE SIGNING:
 *   Rather than requiring the end-user to sign the anchorHash() transaction
 *   in their wallet (which adds friction), we use a dedicated server-side
 *   "anchoring wallet" funded with Monad Testnet tokens. The user's wallet
 *   address is recorded separately as the content owner in Supabase.
 *   This is a deliberate product decision for hackathon UX. In production,
 *   you would prompt the user to sign via their connected wallet instead.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Environment Validation ───────────────────────────────────────────────────

const MONAD_RPC_URL             = process.env.MONAD_RPC_URL;
const CONTRACT_ADDRESS_RAW      = process.env.CONTRACT_ADDRESS;
const ANCHOR_WALLET_PRIVATE_KEY = process.env.ANCHOR_WALLET_PRIVATE_KEY;

if (!MONAD_RPC_URL) {
  throw new Error(
    "[viem] Missing env var: MONAD_RPC_URL. " +
    "Set it to the Monad Testnet JSON-RPC URL in .env.local."
  );
}
if (!CONTRACT_ADDRESS_RAW) {
  throw new Error(
    "[viem] Missing env var: CONTRACT_ADDRESS. " +
    "Set it to the deployed ProvenanceRegistry address (0x...) in .env.local."
  );
}

// Validate contract address format eagerly at module load time.
if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS_RAW)) {
  throw new Error(
    `[viem] CONTRACT_ADDRESS is not a valid Ethereum address: "${CONTRACT_ADDRESS_RAW}". ` +
    "Must be a 0x-prefixed 40-hex-character address."
  );
}

/** The deployed ProvenanceRegistry contract address on Monad Testnet. */
export const CONTRACT_ADDRESS: Address = CONTRACT_ADDRESS_RAW as Address;

// ─── Monad Testnet Chain Definition ──────────────────────────────────────────

/**
 * Monad Testnet chain configuration for viem's `defineChain()`.
 *
 * Chain ID: 10143 (Monad Testnet as of 2026 — verify at chainlist.org if changed).
 * Native token: MON
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

// ─── ProvenanceRegistry ABI ───────────────────────────────────────────────────

/**
 * Inline ABI for the ProvenanceRegistry contract.
 *
 * Derived from contracts/src/ProvenanceRegistry.sol.
 * Using `as const` ensures viem infers exact function/event types for
 * type-safe `readContract()` and `writeContract()` calls.
 *
 * Functions included:
 *   - anchorHash(bytes32)    → write — anchor a SHA-256 hash on-chain
 *   - registerAsset(bytes32) → write — alias for anchorHash
 *   - verifyAsset(bytes32)   → view  — returns (bool, ProvenanceRecord)
 *   - isRegistered(bytes32)  → view  — returns bool
 *   - getRecord(bytes32)     → view  — returns ProvenanceRecord (reverts if missing)
 *   - totalRegistered()      → view  → returns uint256
 *
 * Events included:
 *   - AssetRegistered(bytes32 indexed, address indexed, uint256)
 *   - AssetVerified(bytes32 indexed, bool, address indexed)
 *
 * Custom errors included:
 *   - HashAlreadyRegistered(bytes32)
 *   - InvalidContentHash()
 */
export const PROVENANCE_REGISTRY_ABI = [
  // ── Write functions ──────────────────────────────────────────────────────
  {
    type:             "function",
    name:             "anchorHash",
    stateMutability:  "nonpayable",
    inputs:  [{ name: "contentHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type:             "function",
    name:             "registerAsset",
    stateMutability:  "nonpayable",
    inputs:  [{ name: "contentHash", type: "bytes32" }],
    outputs: [],
  },
  // ── View functions ───────────────────────────────────────────────────────
  {
    type:             "function",
    name:             "verifyAsset",
    stateMutability:  "view",
    inputs:  [{ name: "contentHash", type: "bytes32" }],
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
    type:             "function",
    name:             "isRegistered",
    stateMutability:  "view",
    inputs:  [{ name: "contentHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type:             "function",
    name:             "getRecord",
    stateMutability:  "view",
    inputs:  [{ name: "contentHash", type: "bytes32" }],
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
    type:             "function",
    name:             "totalRegistered",
    stateMutability:  "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ── Events ───────────────────────────────────────────────────────────────
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
  // ── Custom errors ────────────────────────────────────────────────────────
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

// ─── Type inferred from ABI ───────────────────────────────────────────────────

/** TypeScript type for the ABI, used in generic viem client calls. */
export type ProvenanceRegistryAbi = typeof PROVENANCE_REGISTRY_ABI;

// ─── Client Factories ─────────────────────────────────────────────────────────

/**
 * Creates a viem PublicClient connected to Monad Testnet.
 *
 * Use for read-only calls: `isRegistered()`, `verifyAsset()`, `getRecord()`.
 * Does NOT require a private key — safe to create on any request.
 *
 * @returns {PublicClient} A viem public client for Monad Testnet.
 *
 * @example
 * const client = createPublicClientForMonad();
 * const isAnchored = await client.readContract({
 *   address: CONTRACT_ADDRESS,
 *   abi: PROVENANCE_REGISTRY_ABI,
 *   functionName: "isRegistered",
 *   args: [contentHashBytes32],
 * });
 */
export function createPublicClientForMonad(): PublicClient {
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
 * Creates a viem WalletClient using the server-side ANCHOR_WALLET_PRIVATE_KEY.
 *
 * ⚠️  Only call this in server-side Route Handlers. The private key must
 *     never be exposed to the browser. Never import this factory from a
 *     React component or client-side hook.
 *
 * @returns {{ walletClient: WalletClient, account: ReturnType<typeof privateKeyToAccount> }}
 * @throws {Error} If ANCHOR_WALLET_PRIVATE_KEY is not set.
 *
 * @example
 * const { walletClient, account } = createWalletClientForAnchor();
 * const txHash = await walletClient.writeContract({ ... });
 */
export function createWalletClientForAnchor(): {
  walletClient: WalletClient;
  account:      ReturnType<typeof privateKeyToAccount>;
} {
  if (!ANCHOR_WALLET_PRIVATE_KEY) {
    throw new Error(
      "[viem] Missing env var: ANCHOR_WALLET_PRIVATE_KEY. " +
      "Required for server-side transaction signing. " +
      "Add it to .env.local — NEVER expose it to the browser."
    );
  }

  // Normalise to 0x-prefixed hex. privateKeyToAccount requires this format.
  const privateKey: Hex = ANCHOR_WALLET_PRIVATE_KEY.startsWith("0x")
    ? (ANCHOR_WALLET_PRIVATE_KEY as Hex)
    : (`0x${ANCHOR_WALLET_PRIVATE_KEY}` as Hex);

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain:     monadTestnet,
    transport: http(MONAD_RPC_URL, {
      timeout:    30_000, // 30s — write calls need more time for mempool inclusion
      retryCount: 1,
      retryDelay: 1_000,
    }),
  });

  return { walletClient, account };
}

// ─── SHA-256 Hex → bytes32 Conversion ────────────────────────────────────────

/**
 * Converts a 64-character SHA-256 hex string into a viem-compatible bytes32
 * value (a 0x-prefixed 66-character hex string) suitable for passing to
 * Solidity `bytes32` parameters.
 *
 * SHA-256 produces exactly 32 bytes = 256 bits, which fits perfectly into
 * a Solidity `bytes32`. No padding is needed.
 *
 * @param sha256Hex - A 64-character lowercase hex string (WITHOUT 0x prefix).
 * @returns A 66-character 0x-prefixed hex string (`0x${sha256Hex}`).
 * @throws {Error} If the input is not a 64-character hex string.
 *
 * @example
 * const bytes32 = sha256HexToBytes32("a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");
 * // => "0xa665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
 */
export function sha256HexToBytes32(sha256Hex: string): Hex {
  const normalized = sha256Hex.startsWith("0x")
    ? sha256Hex.slice(2)
    : sha256Hex;

  if (normalized.length !== 64) {
    throw new Error(
      `[viem] sha256HexToBytes32: expected a 64-char hex string, got ${normalized.length} chars. ` +
      `Input: "${sha256Hex.slice(0, 20)}..."`
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      `[viem] sha256HexToBytes32: input contains non-hex characters. ` +
      `Input: "${sha256Hex.slice(0, 20)}..."`
    );
  }

  return `0x${normalized}` as Hex;
}

// ─── Core Write Operation ─────────────────────────────────────────────────────

/**
 * The result of a successful anchorHashOnChain() call.
 */
export interface AnchorOnChainResult {
  /** The 0x-prefixed transaction hash of the anchorHash() call. */
  txHash: Hash;

  /** The block number in which the transaction was mined. */
  blockNumber: bigint;

  /** The wallet address that signed and submitted the transaction. */
  anchoredBy: Address;

  /** The Monad Testnet chain ID (10143). */
  chainId: number;

  /** The bytes32 value that was passed to the contract. */
  contentHashBytes32: Hex;
}

/**
 * Converts a SHA-256 hex string to bytes32, calls `anchorHash()` on the
 * ProvenanceRegistry contract, and waits for the transaction receipt.
 *
 * Steps:
 *   1. Validate and convert sha256Hex → bytes32.
 *   2. Instantiate the wallet client and public client.
 *   3. Check if the hash is already registered (idempotency guard — avoids
 *      wasting gas on a transaction that will revert).
 *   4. Submit the `anchorHash(bytes32)` transaction via the wallet client.
 *   5. Wait for the receipt with 1 block confirmation.
 *   6. Return the txHash, blockNumber, anchoredBy, chainId, and contentHashBytes32.
 *
 * @param sha256Hex - The 64-char SHA-256 hex from the registered asset.
 * @returns {Promise<AnchorOnChainResult>} The mined transaction details.
 * @throws {Error} If conversion, submission, or receipt waiting fails.
 *
 * @example
 * const result = await anchorHashOnChain("a665a459...");
 * console.log(result.txHash);     // => "0xabc123..."
 * console.log(result.blockNumber); // => 12345678n
 */
export async function anchorHashOnChain(
  sha256Hex: string
): Promise<AnchorOnChainResult> {
  const tag = "[viem:anchorHashOnChain]";

  console.log(`${tag} Starting. sha256=${sha256Hex.slice(0, 16)}...`);

  // ── Step 1: Convert hex → bytes32 ──────────────────────────────────────
  const contentHashBytes32 = sha256HexToBytes32(sha256Hex);
  console.log(`${tag} ✓ Converted to bytes32: ${contentHashBytes32.slice(0, 18)}...`);

  // ── Step 2: Instantiate clients ────────────────────────────────────────
  const publicClient               = createPublicClientForMonad();
  const { walletClient, account }  = createWalletClientForAnchor();

  console.log(`${tag} ✓ Clients ready. Anchoring wallet: ${account.address}`);

  // ── Step 3: Idempotency check — skip if already on-chain ───────────────
  // Calling a function that will revert wastes gas. Check first.
  try {
    const alreadyRegistered = await publicClient.readContract({
      address:      CONTRACT_ADDRESS,
      abi:          PROVENANCE_REGISTRY_ABI,
      functionName: "isRegistered",
      args:         [contentHashBytes32],
    });

    if (alreadyRegistered) {
      console.warn(
        `${tag} ⚠ Hash already registered on-chain. ` +
        `This asset was previously anchored. Aborting to avoid revert.`
      );
      throw new Error(
        `[viem] Hash ${sha256Hex.slice(0, 16)}... is already registered in ProvenanceRegistry. ` +
        `No new transaction submitted.`
      );
    }

    console.log(`${tag} ✓ Hash not yet registered. Proceeding with anchorHash() call.`);
  } catch (err) {
    // Re-throw our own "already registered" error.
    if (err instanceof Error && err.message.startsWith("[viem]")) throw err;
    // For RPC errors during the read, log and proceed — let the write attempt
    // determine the outcome rather than blocking on a failed read check.
    console.warn(
      `${tag} ⚠ isRegistered() read failed (RPC issue?): ` +
      `${err instanceof Error ? err.message : String(err)}. Proceeding with write.`
    );
  }

  // ── Step 4: Submit anchorHash() transaction ─────────────────────────────
  console.log(`${tag} Submitting anchorHash(${contentHashBytes32.slice(0, 18)}...) to Monad Testnet...`);

  let txHash: Hash;
  try {
    txHash = await walletClient.writeContract({
      address:      CONTRACT_ADDRESS,
      abi:          PROVENANCE_REGISTRY_ABI,
      functionName: "anchorHash",
      args:         [contentHashBytes32],
      chain:        monadTestnet,
      account,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ writeContract failed: ${message}`);
    throw new Error(`[viem] anchorHash() transaction failed: ${message}`);
  }

  console.log(`${tag} ✓ Transaction submitted. txHash: ${txHash}`);

  // ── Step 5: Wait for the transaction receipt ────────────────────────────
  // waitForTransactionReceipt polls the RPC until the tx is mined.
  console.log(`${tag} Waiting for transaction receipt...`);

  let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash:                txHash,
      confirmations:       1,
      timeout:             60_000, // 60s — Monad is fast but allow headroom
      pollingInterval:     1_000,  // Poll every 1 second
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ waitForTransactionReceipt failed: ${message}`);
    throw new Error(
      `[viem] Transaction ${txHash} was submitted but receipt timed out: ${message}. ` +
      `Check the explorer: https://testnet.monadexplorer.com/tx/${txHash}`
    );
  }

  // Guard: check the transaction did not revert.
  if (receipt.status === "reverted") {
    console.error(`${tag} ✗ Transaction ${txHash} was mined but REVERTED.`);
    throw new Error(
      `[viem] anchorHash() transaction was mined but reverted. ` +
      `txHash: ${txHash}, blockNumber: ${receipt.blockNumber}. ` +
      `Possible cause: hash was already registered (race condition) or contract error.`
    );
  }

  console.log(
    `${tag} ✅ Transaction confirmed! ` +
    `txHash: ${txHash}, ` +
    `blockNumber: ${receipt.blockNumber}, ` +
    `status: ${receipt.status}`
  );

  return {
    txHash,
    blockNumber:        receipt.blockNumber,
    anchoredBy:         account.address,
    chainId:            monadTestnet.id,
    contentHashBytes32,
  };
}

// ─── Read Helper ──────────────────────────────────────────────────────────────

/**
 * Checks whether a SHA-256 hash is already registered in the ProvenanceRegistry.
 *
 * Uses the PublicClient (no private key required).
 * Useful for preflight checks in the anchor route before spending gas.
 *
 * @param sha256Hex - The 64-char SHA-256 hex string to look up.
 * @returns {Promise<boolean>} True if the hash is registered on-chain.
 *
 * @example
 * const isAnchored = await checkIsRegistered("a665a459...");
 * if (isAnchored) console.log("Already on chain!");
 */
export async function checkIsRegistered(sha256Hex: string): Promise<boolean> {
  const contentHashBytes32 = sha256HexToBytes32(sha256Hex);
  const publicClient       = createPublicClientForMonad();

  const result = await publicClient.readContract({
    address:      CONTRACT_ADDRESS,
    abi:          PROVENANCE_REGISTRY_ABI,
    functionName: "isRegistered",
    args:         [contentHashBytes32],
  });

  return result as boolean;
}
