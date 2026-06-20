/**
 * @file provenance.ts
 * @description High-level provenance operations for the ProvenanceRegistry
 *              contract on Monad Testnet.
 *
 * This module provides the canonical public API for blockchain provenance
 * operations used by both API Route Handlers and (read-only) client code.
 *
 * Exported functions:
 *   anchorHash(sha256Hex)      → Submit anchorHash() tx and wait for receipt.
 *   verifyOnChain(sha256Hex)   → Read-only: check registration status + metadata.
 *   getRecord(sha256Hex)       → Read-only: return full ProvenanceRecord (throws if missing).
 *
 * Internal helpers (not exported):
 *   sha256ToBytes32(sha256Hex) → Convert 64-char SHA-256 hex → 0x-prefixed bytes32.
 *
 * ⚠️  anchorHash() uses ANCHOR_WALLET_PRIVATE_KEY — SERVER-ONLY.
 *     verifyOnChain() and getRecord() are read-only and safe everywhere.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   MONAD_RPC_URL             — Monad Testnet JSON-RPC endpoint
 *   CONTRACT_ADDRESS          — Deployed ProvenanceRegistry address (0x...)
 *   ANCHOR_WALLET_PRIVATE_KEY — Server-side signing wallet (anchorHash only)
 */

import { type Hash, type Address, type Hex } from "viem";
import {
  PROVENANCE_ABI,
  PROVENANCE_CONTRACT_ADDRESS,
  getPublicClient,
  getWalletClient,
  monadTestnet,
} from "@/lib/contract";

// ─── Internal Utilities ───────────────────────────────────────────────────────

/**
 * Converts a 64-character SHA-256 hex string to a 0x-prefixed bytes32 value
 * suitable for Solidity `bytes32` parameters.
 *
 * SHA-256 produces exactly 32 bytes = 256 bits, which maps directly to bytes32.
 * No padding is required.
 *
 * @param sha256Hex - 64-char lowercase hex string (with or without 0x prefix).
 * @returns          0x-prefixed 66-char hex string.
 * @throws           {Error} If input is not a valid 64-char hex string.
 *
 * @example
 * sha256ToBytes32("a665a45920422f9d417e4867efdc4fb8...") // → "0xa665a459..."
 */
function sha256ToBytes32(sha256Hex: string): Hex {
  const normalized = sha256Hex.startsWith("0x")
    ? sha256Hex.slice(2)
    : sha256Hex;

  if (normalized.length !== 64) {
    throw new Error(
      `[provenance] sha256ToBytes32: expected 64-char hex, got ${normalized.length} chars. ` +
      `Input: "${sha256Hex.slice(0, 20)}..."`
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      `[provenance] sha256ToBytes32: non-hex characters in input. ` +
      `Input: "${sha256Hex.slice(0, 20)}..."`
    );
  }

  return `0x${normalized}` as Hex;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * Returned by anchorHash() after successful on-chain registration.
 */
export interface AnchorHashResult {
  /** 0x-prefixed transaction hash of the anchorHash() call. */
  txHash: Hash;
  /** Block number in which the transaction was mined. */
  blockNumber: bigint;
  /** Wallet address that signed and submitted the transaction. */
  anchoredBy: Address;
  /** Monad Testnet chain ID (10143). */
  chainId: number;
  /** The bytes32 value that was passed to the contract. */
  contentHashBytes32: Hex;
}

/**
 * Returned by verifyOnChain() for a registered asset.
 */
export interface OnChainVerifyResult {
  /** True if the hash is registered in the ProvenanceRegistry. */
  found: boolean;
  /** The on-chain record, if found. Null when found is false. */
  record: {
    contentHash: Hex;
    registeredBy: Address;
    /** Unix timestamp (seconds) when the asset was anchored. */
    timestamp: bigint;
    exists: boolean;
  } | null;
}

/**
 * Full ProvenanceRecord returned by getRecord().
 * Mirrors the Solidity `ProvenanceRecord` struct.
 */
export interface ProvenanceRecord {
  contentHash: Hex;
  registeredBy: Address;
  /** Unix timestamp (seconds) when the asset was anchored on-chain. */
  timestamp: bigint;
  exists: boolean;
}

// ─── anchorHash ───────────────────────────────────────────────────────────────

/**
 * Anchors a SHA-256 content hash on-chain via the ProvenanceRegistry contract.
 *
 * Pipeline:
 *   1. Convert sha256Hex → bytes32 (validate input format).
 *   2. Pre-flight isRegistered() check — avoids spending gas on a revert.
 *   3. Submit anchorHash(bytes32) via the server-side wallet client.
 *   4. Wait for 1-block confirmation via waitForTransactionReceipt.
 *   5. Validate receipt.status === "success".
 *   6. Return txHash, blockNumber, anchoredBy, chainId, contentHashBytes32.
 *
 * ⚠️  SERVER-ONLY. Requires ANCHOR_WALLET_PRIVATE_KEY in the environment.
 *     Never call this from a React component or client-side code.
 *
 * @param sha256Hex - The 64-char SHA-256 hex string of the digital asset.
 * @returns          {AnchorHashResult} Confirmed transaction details.
 * @throws           {Error} If the hash is already registered, or if any
 *                   RPC/signing/receipt step fails.
 *
 * @example
 * const result = await anchorHash("a665a45920422f9d417e4867efdc4fb8...");
 * console.log(result.txHash);      // "0xabc123..."
 * console.log(result.blockNumber); // 12345678n
 */
export async function anchorHash(sha256Hex: string): Promise<AnchorHashResult> {
  const tag = "[provenance:anchorHash]";
  console.log(`${tag} Starting. sha256=${sha256Hex.slice(0, 16)}...`);

  // ── Step 1: Convert hex → bytes32 ─────────────────────────────────────────
  const contentHashBytes32 = sha256ToBytes32(sha256Hex);
  console.log(`${tag} ✓ bytes32: ${contentHashBytes32.slice(0, 18)}...`);

  // ── Step 2: Instantiate clients ───────────────────────────────────────────
  const publicClient              = getPublicClient();
  const { walletClient, account } = getWalletClient();
  console.log(`${tag} ✓ Clients ready. Anchoring wallet: ${account.address}`);

  // ── Step 3: Idempotency pre-flight ────────────────────────────────────────
  // Checking before writing avoids wasting gas on a HashAlreadyRegistered revert.
  try {
    const alreadyRegistered = await publicClient.readContract({
      address:      PROVENANCE_CONTRACT_ADDRESS,
      abi:          PROVENANCE_ABI,
      functionName: "isRegistered",
      args:         [contentHashBytes32],
    });

    if (alreadyRegistered) {
      throw new Error(
        `[provenance] Hash ${sha256Hex.slice(0, 16)}... is already registered ` +
        `in ProvenanceRegistry. No transaction submitted.`
      );
    }

    console.log(`${tag} ✓ Pre-flight: hash not yet registered.`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[provenance]")) throw err;
    // RPC read failed — log and continue; the write will determine the outcome.
    console.warn(
      `${tag} ⚠ isRegistered() pre-flight failed (RPC issue?): ` +
      `${err instanceof Error ? err.message : String(err)}. Proceeding.`
    );
  }

  // ── Step 4: Submit anchorHash() transaction ───────────────────────────────
  console.log(`${tag} Submitting anchorHash(${contentHashBytes32.slice(0, 18)}...)...`);

  let txHash: Hash;
  try {
    txHash = await walletClient.writeContract({
      address:      PROVENANCE_CONTRACT_ADDRESS,
      abi:          PROVENANCE_ABI,
      functionName: "anchorHash",
      args:         [contentHashBytes32],
      chain:        monadTestnet,
      account,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ writeContract failed: ${message}`);
    throw new Error(`[provenance] anchorHash() transaction failed: ${message}`);
  }

  console.log(`${tag} ✓ Transaction submitted. txHash: ${txHash}`);

  // ── Step 5: Wait for receipt ──────────────────────────────────────────────
  console.log(`${tag} Waiting for transaction receipt...`);

  type Receipt = Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>;
  let receipt: Receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash:            txHash,
      confirmations:   1,
      timeout:         60_000,  // 60s — Monad is fast; allows headroom
      pollingInterval: 1_000,   // poll every 1 second
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ waitForTransactionReceipt timed out: ${message}`);
    throw new Error(
      `[provenance] Transaction ${txHash} submitted but receipt timed out: ${message}. ` +
      `Check explorer: https://testnet.monadexplorer.com/tx/${txHash}`
    );
  }

  // ── Step 6: Validate receipt ──────────────────────────────────────────────
  if (receipt.status === "reverted") {
    console.error(`${tag} ✗ Transaction ${txHash} mined but REVERTED.`);
    throw new Error(
      `[provenance] anchorHash() transaction reverted. ` +
      `txHash: ${txHash}, blockNumber: ${receipt.blockNumber}. ` +
      `Possible cause: hash already registered (race condition) or contract error.`
    );
  }

  console.log(
    `${tag} ✅ Confirmed! txHash: ${txHash}, ` +
    `blockNumber: ${receipt.blockNumber}, status: ${receipt.status}`
  );

  return {
    txHash,
    blockNumber:        receipt.blockNumber,
    anchoredBy:         account.address,
    chainId:            monadTestnet.id,
    contentHashBytes32,
  };
}

// ─── verifyOnChain ────────────────────────────────────────────────────────────

/**
 * Checks whether a SHA-256 hash is registered in the ProvenanceRegistry
 * and returns its full on-chain metadata if found.
 *
 * Uses verifyAsset() which returns both the boolean and the struct in a
 * single RPC call — more efficient than two separate calls.
 *
 * Read-only — no gas required, no private key needed.
 * Safe to use in both server Route Handlers and client-side hooks.
 *
 * @param sha256Hex - The 64-char SHA-256 hex string to look up.
 * @returns          {OnChainVerifyResult} found flag + record (or null).
 *
 * @example
 * const { found, record } = await verifyOnChain("a665a459...");
 * if (found) {
 *   console.log(record?.registeredBy); // "0xABC..."
 *   console.log(record?.timestamp);    // 1718000000n
 * }
 */
export async function verifyOnChain(
  sha256Hex: string
): Promise<OnChainVerifyResult> {
  const contentHashBytes32 = sha256ToBytes32(sha256Hex);
  const publicClient       = getPublicClient();

  const [found, record] = await publicClient.readContract({
    address:      PROVENANCE_CONTRACT_ADDRESS,
    abi:          PROVENANCE_ABI,
    functionName: "verifyAsset",
    args:         [contentHashBytes32],
  }) as [boolean, { contentHash: Hex; registeredBy: Address; timestamp: bigint; exists: boolean }];

  return {
    found,
    record: found
      ? {
          contentHash:  record.contentHash,
          registeredBy: record.registeredBy,
          timestamp:    record.timestamp,
          exists:       record.exists,
        }
      : null,
  };
}

// ─── getRecord ────────────────────────────────────────────────────────────────

/**
 * Returns the full ProvenanceRecord for a registered SHA-256 hash.
 *
 * Calls getRecord(bytes32) on the contract, which reverts if the hash is
 * not registered. Use verifyOnChain() first if you need a non-throwing check.
 *
 * Read-only — no gas required, no private key needed.
 *
 * @param sha256Hex - The 64-char SHA-256 hex string to look up.
 * @returns          {ProvenanceRecord} The on-chain record.
 * @throws           {Error} If the hash is not registered (contract reverts).
 *
 * @example
 * const record = await getRecord("a665a459...");
 * console.log(record.registeredBy); // "0xABC..."
 * console.log(record.timestamp);    // 1718000000n
 */
export async function getRecord(sha256Hex: string): Promise<ProvenanceRecord> {
  const contentHashBytes32 = sha256ToBytes32(sha256Hex);
  const publicClient       = getPublicClient();

  const record = await publicClient.readContract({
    address:      PROVENANCE_CONTRACT_ADDRESS,
    abi:          PROVENANCE_ABI,
    functionName: "getRecord",
    args:         [contentHashBytes32],
  }) as { contentHash: Hex; registeredBy: Address; timestamp: bigint; exists: boolean };

  return {
    contentHash:  record.contentHash,
    registeredBy: record.registeredBy,
    timestamp:    record.timestamp,
    exists:       record.exists,
  };
}
