/**
 * @file transaction.types.ts
 * @description Canonical domain model for every blockchain transaction in the
 *              Intent-Centric Web3 Execution Platform.
 *
 * This file models the complete lifecycle of a transaction — from construction
 * and simulation, through wallet signing, mempool submission, on-chain
 * confirmation, and terminal states (confirmed, failed, reverted).
 *
 * Lifecycle:
 *
 *   ┌─────────┐   ┌───────────┐   ┌───────────────────┐   ┌────────┐
 *   │ CREATED │──▶│ SIMULATED │──▶│ SIGNATURE_PENDING  │──▶│ SIGNED │
 *   └─────────┘   └───────────┘   └───────────────────┘   └────────┘
 *                                                               │
 *                                                          ┌────▼──────┐
 *                                                          │ SUBMITTED │
 *                                                          └────┬──────┘
 *                                                               │
 *                                                         ┌─────▼──────┐
 *                                                         │ CONFIRMING │
 *                                                         └─────┬──────┘
 *                                                               │
 *                                          ┌────────────────────┼──────────────┐
 *                                          ▼                    ▼              ▼
 *                                      CONFIRMED             FAILED         REVERTED
 *
 * Compatibility:
 *   - intent.types.ts  : TransactionRecord references intentId → IntentRequest.id
 *   - agent.types.ts   : TransactionRecord references agentJobId → AgentJob.id
 *                                         taskId     → AgentTask.id
 *                                         correlationId (threaded through all layers)
 *
 * @module transaction.types
 */

// ─────────────────────────────────────────────────────────────────────────────
// TransactionStatus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every state a transaction can occupy from construction to finality.
 *
 * - CREATED           : Transaction object built; not yet simulated or submitted.
 * - SIMULATED         : Dry-run completed via eth_call; results are available.
 * - SIGNATURE_PENDING : Unsigned tx sent to user's wallet; awaiting signature.
 * - SIGNED            : User signed the transaction; ready to broadcast.
 * - SUBMITTED         : Raw transaction broadcast to the mempool via eth_sendRawTransaction.
 * - CONFIRMING        : Transaction included in a block; waiting for N confirmation blocks.
 * - CONFIRMED         : Sufficient confirmations reached; considered final.
 * - FAILED            : Transaction could not be submitted or was dropped from the mempool.
 * - REVERTED          : Transaction was included in a block but EVM execution reverted.
 */
export enum TransactionStatus {
  CREATED           = "CREATED",
  SIMULATED         = "SIMULATED",
  SIGNATURE_PENDING = "SIGNATURE_PENDING",
  SIGNED            = "SIGNED",
  SUBMITTED         = "SUBMITTED",
  CONFIRMING        = "CONFIRMING",
  CONFIRMED         = "CONFIRMED",
  FAILED            = "FAILED",
  REVERTED          = "REVERTED",
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic classification of what a transaction accomplishes.
 * Used for display, analytics filtering, and protocol-specific handling.
 *
 * - TOKEN_TRANSFER  : Native ETH or ERC-20 token transfer.
 * - ERC20_APPROVAL  : ERC-20 allowance grant (approve / increaseAllowance).
 * - CONTRACT_CALL   : Generic smart contract interaction not covered by other types.
 * - SWAP            : Token exchange via a DEX (e.g. Uniswap, Curve).
 * - BRIDGE          : Cross-chain asset transfer (e.g. Across, Stargate, Hop).
 * - STAKE           : Asset staking / liquidity provision (e.g. Lido, Aave supply).
 * - CUSTOM          : User-defined or agent-composed transaction with no standard type.
 */
export enum TransactionType {
  TOKEN_TRANSFER = "TOKEN_TRANSFER",
  ERC20_APPROVAL = "ERC20_APPROVAL",
  CONTRACT_CALL  = "CONTRACT_CALL",
  SWAP           = "SWAP",
  BRIDGE         = "BRIDGE",
  STAKE          = "STAKE",
  CUSTOM         = "CUSTOM",
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared identity fields (embedded in every transaction interface)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core identity and correlation fields present on every transaction record.
 * Extracted as a shared base to ensure consistency across all lifecycle stages.
 */
export interface TransactionIdentity {
  /** Unique transaction identifier. Format: "tx_<uuid>". */
  transactionId: string;

  /**
   * Source intent identifier.
   * References IntentRequest.id in intent.types.ts.
   */
  intentId: string;

  /**
   * Parent agent job identifier.
   * References AgentJob.id in agent.types.ts.
   */
  agentJobId: string;

  /**
   * Parent agent task identifier.
   * References AgentTask.id in agent.types.ts.
   */
  taskId: string;

  /**
   * Distributed tracing correlation ID.
   * Matches AgentJob.correlationId — propagated across all services.
   */
  correlationId: string;

  /** EVM chain ID this transaction targets. */
  chainId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// EIP-1559 Gas Parameters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EIP-1559 fee market parameters.
 * All values are in wei, represented as strings to preserve bigint precision
 * across JSON serialization boundaries.
 *
 * @see https://eips.ethereum.org/EIPS/eip-1559
 */
export interface EIP1559GasParams {
  /**
   * Maximum total fee per gas unit the sender is willing to pay (wei).
   * Equivalent to legacy gasPrice ceiling.
   * Format: decimal string (e.g. "50000000000" for 50 gwei).
   */
  maxFeePerGas: string;

  /**
   * Maximum priority fee (tip) per gas unit paid to the validator (wei).
   * Must be ≤ maxFeePerGas.
   * Format: decimal string.
   */
  maxPriorityFeePerGas: string;

  /**
   * Gas limit for the transaction.
   * Should be set to at least 110% of the estimated gas to avoid out-of-gas reverts.
   * Format: decimal string.
   */
  gasLimit: string;
}

/**
 * Gas estimation result returned by eth_estimateGas.
 */
export interface GasEstimate {
  /** Estimated gas units required. Format: decimal string. */
  estimatedGas: string;

  /** Recommended gas limit (estimated + safety buffer). Format: decimal string. */
  gasLimit: string;

  /** Base fee per gas from the latest block (wei). Format: decimal string. */
  baseFeePerGas: string;

  /** Suggested maxFeePerGas = 2x baseFee + priorityFee (wei). Format: decimal string. */
  maxFeePerGas: string;

  /** Suggested maxPriorityFeePerGas (wei). Format: decimal string. */
  maxPriorityFeePerGas: string;

  /**
   * Estimated total cost in ETH (gasLimit × maxFeePerGas).
   * Represented as a string to preserve floating-point precision.
   */
  estimatedCostEth: string;

  /**
   * Estimated total cost in USD at time of estimation.
   * Null if price feed is unavailable.
   */
  estimatedCostUsd: string | null;

  /** ISO 8601 timestamp when this estimate was computed. */
  estimatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionRequest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The initial transaction object constructed by the agent before any
 * simulation or signing occurs.
 *
 * Created when an AgentTask of type ONCHAIN begins execution.
 * Status at creation: CREATED.
 */
export interface TransactionRequest extends TransactionIdentity {
  /** Always CREATED when first constructed. */
  status: TransactionStatus.CREATED;

  /** Semantic classification of this transaction. */
  type: TransactionType;

  // ── EVM fields ─────────────────────────────────────────────────────────────

  /** Sender wallet address. */
  from: `0x${string}`;

  /** Target contract or EOA address. */
  to: `0x${string}`;

  /**
   * ABI-encoded calldata.
   * "0x" for plain ETH transfers.
   */
  data: `0x${string}`;

  /**
   * Native token value to send with the transaction (wei).
   * "0" for non-payable contract calls.
   * Format: decimal string.
   */
  value: string;

  /** EIP-1559 gas parameters. Set by the gas estimator before signing. */
  gasParams: EIP1559GasParams;

  /** Gas estimation result used to populate gasParams. */
  gasEstimate: GasEstimate;

  /**
   * EVM transaction nonce.
   * Assigned just before signing to avoid nonce collisions in multi-tx flows.
   * Undefined until nonce is reserved.
   */
  nonce?: number;

  // ── Human-readable context ─────────────────────────────────────────────────

  /** Human-readable description shown in the signing prompt. */
  description: string;

  /** Protocol this transaction targets (e.g. "Uniswap V3", "Lido"). */
  protocol: string;

  /**
   * ABI function signature for display purposes.
   * @example "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)"
   */
  functionSignature?: string;

  /**
   * Decoded function parameters for the signing prompt UI.
   * @example { amountIn: "100000000", amountOutMin: "42000000000000000" }
   */
  decodedParams?: Record<string, string>;

  // ── Timestamp ──────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when this transaction request was constructed. */
  createdAt: string;

  /** Optional metadata for analytics or debugging. */
  metadata?: TransactionMetadata;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionSimulation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of a dry-run simulation (eth_call) performed before presenting
 * the transaction to the user for signing.
 *
 * Simulation allows early detection of reverts, unexpected return values,
 * or insufficient gas — before any gas is spent.
 *
 * Status after simulation: SIMULATED.
 */
export interface TransactionSimulation extends TransactionIdentity {
  /** Always SIMULATED. */
  status: TransactionStatus.SIMULATED;

  /** Whether the simulation completed without reverting. */
  success: boolean;

  /**
   * Simulated gas used (not the limit — the actual simulated consumption).
   * Format: decimal string.
   */
  gasUsed: string;

  /**
   * Raw return data from the simulated call (hex-encoded).
   * "0x" if the function returns nothing.
   */
  returnData: `0x${string}`;

  /**
   * Decoded return value from the simulated call.
   * Null if decoding failed or returnData is empty.
   * @example { amountOut: "42000000000000000" }
   */
  decodedReturn: Record<string, unknown> | null;

  /**
   * Revert reason string if success is false.
   * Extracted from the ABI-encoded error or custom error selector.
   * Null if simulation succeeded.
   */
  revertReason: string | null;

  /**
   * Structured revert error if the contract uses custom errors.
   * @example { errorName: "InsufficientLiquidity", params: { required: "1000", available: "500" } }
   */
  revertError: {
    errorName: string;
    params: Record<string, unknown>;
  } | null;

  /**
   * State diff preview — which storage slots will change.
   * Produced by Tenderly/Alchemy simulation APIs.
   * Null if not available.
   */
  stateDiff: Record<string, unknown> | null;

  /**
   * Expected token balance changes for the sender.
   * Useful for displaying "you will receive" previews.
   */
  balanceChanges: BalanceChange[];

  /**
   * Provider used for simulation.
   * @example "TENDERLY" | "ALCHEMY" | "LOCAL_FORK" | "ETH_CALL"
   */
  simulationProvider: "TENDERLY" | "ALCHEMY" | "LOCAL_FORK" | "ETH_CALL";

  /** ISO 8601 timestamp when the simulation was run. */
  simulatedAt: string;

  /** Raw simulation API response for debugging. */
  rawSimulationResponse?: Record<string, unknown>;
}

/**
 * Represents a predicted change to a token balance resulting from the transaction.
 */
export interface BalanceChange {
  /** Token contract address. "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" for native ETH. */
  tokenAddress: `0x${string}`;

  /** Token symbol. @example "USDC", "ETH" */
  symbol: string;

  /** Token decimal places. */
  decimals: number;

  /**
   * Signed balance delta in the token's smallest unit (as string).
   * Negative = outflow, positive = inflow.
   * @example "-100000000" (for -100 USDC with 6 decimals)
   */
  delta: string;

  /**
   * Human-readable delta.
   * @example "-100.00 USDC"
   */
  deltaFormatted: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionSignatureRequest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload sent to the frontend when the agent requires the user to sign
 * a transaction using their connected wallet (e.g. via Wagmi / RainbowKit).
 *
 * Status at this stage: SIGNATURE_PENDING.
 *
 * The frontend renders a signing prompt from this payload.
 * On user approval, the signed transaction is returned as TransactionSigned.
 */
export interface TransactionSignatureRequest extends TransactionIdentity {
  /** Always SIGNATURE_PENDING. */
  status: TransactionStatus.SIGNATURE_PENDING;

  // ── Unsigned transaction fields ────────────────────────────────────────────

  /** Sender wallet address. */
  from: `0x${string}`;

  /** Target address. */
  to: `0x${string}`;

  /** ABI-encoded calldata. */
  data: `0x${string}`;

  /** Native value in wei (decimal string). */
  value: string;

  /** Reserved nonce for this transaction. */
  nonce: number;

  /** EIP-1559 gas parameters (final, post-estimation values). */
  gasParams: EIP1559GasParams;

  // ── Signing context for UI ─────────────────────────────────────────────────

  /** Transaction type for UI header. */
  type: TransactionType;

  /** Protocol name for the signing prompt. */
  protocol: string;

  /**
   * Human-readable summary for the user.
   * @example "Swap 100 USDC for ETH on Uniswap V3"
   */
  prompt: string;

  /** Simulation result to show balance changes in the signing UI. */
  simulation: TransactionSimulation | null;

  /** Gas estimate shown in the signing UI. */
  gasEstimate: GasEstimate;

  /**
   * URL to the target protocol's UI page.
   * Shown as "View on [Protocol]" in the signing modal.
   */
  protocolUrl?: string;

  /**
   * Warning messages to surface in the signing UI.
   * @example ["High slippage detected (5.2%)", "Price impact > 1%"]
   */
  warnings?: string[];

  // ── Expiry ─────────────────────────────────────────────────────────────────

  /**
   * ISO 8601 deadline — if the user does not sign before this time,
   * the agent will time out and fail the task.
   */
  expiresAt: string;

  /** ISO 8601 timestamp when the signature request was sent. */
  requestedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionSubmission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records the act of broadcasting a signed transaction to the network.
 * Created when eth_sendRawTransaction returns a transaction hash.
 *
 * Status lifecycle within this object:
 *   SIGNED → SUBMITTED → CONFIRMING
 */
export interface TransactionSubmission extends TransactionIdentity {
  /** SUBMITTED after broadcast; CONFIRMING after first block inclusion. */
  status: TransactionStatus.SIGNED | TransactionStatus.SUBMITTED | TransactionStatus.CONFIRMING;

  /** The raw signed transaction (RLP-encoded, hex). */
  signedRawTx: `0x${string}`;

  /**
   * Wallet signature over the transaction hash (v, r, s components as hex).
   * Format: "0x<r><s><v>" (65 bytes, EIP-155 encoded).
   */
  signature: `0x${string}`;

  /**
   * Transaction hash assigned by the network on broadcast.
   * Undefined while status is SIGNED (before broadcast).
   */
  txHash?: `0x${string}`;

  /** The nonce used in this transaction. */
  nonce: number;

  /** Final EIP-1559 gas params used in the submitted transaction. */
  gasParams: EIP1559GasParams;

  /**
   * RPC endpoint used to broadcast the transaction.
   * @example "https://mainnet.infura.io/v3/..."
   */
  rpcEndpoint: string;

  /**
   * Number of EVM confirmations received so far.
   * 0 until the transaction appears in a block.
   */
  confirmations: number;

  /**
   * Number of confirmations required to consider this transaction final.
   * Depends on the chain and protocol risk tolerance (e.g. 1 for L2s, 12 for L1).
   */
  requiredConfirmations: number;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the user signed the transaction. */
  signedAt: string;

  /** ISO 8601 timestamp when the transaction was broadcast to the mempool. */
  submittedAt?: string;

  /** ISO 8601 timestamp when the transaction first appeared in a block. */
  firstSeenInBlockAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionReceipt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On-chain receipt produced after a transaction is confirmed.
 * This is the primary success record — maps directly to the eth_getTransactionReceipt
 * JSON-RPC response, enriched with platform-specific fields.
 *
 * Status at this stage: CONFIRMED.
 */
export interface TransactionReceipt extends TransactionIdentity {
  /** Always CONFIRMED. */
  status: TransactionStatus.CONFIRMED;

  /** Transaction hash. */
  txHash: `0x${string}`;

  /** Block hash of the confirming block. */
  blockHash: `0x${string}`;

  /** Block number in which the transaction was included (decimal string). */
  blockNumber: string;

  /** Index of this transaction within its block. */
  transactionIndex: number;

  /** EVM execution status. 1 = success, 0 = reverted (guarded by status enum). */
  evmStatus: 1;

  /** Actual gas units consumed by the transaction (decimal string). */
  gasUsed: string;

  /** Cumulative gas used in the block up to and including this transaction (decimal string). */
  cumulativeGasUsed: string;

  /**
   * Effective gas price paid per unit (wei, decimal string).
   * For EIP-1559 txs: min(maxFeePerGas, baseFeePerGas + maxPriorityFeePerGas).
   */
  effectiveGasPrice: string;

  /**
   * Total gas cost paid (gasUsed × effectiveGasPrice) in ETH.
   * Represented as a string (18-decimal precision).
   */
  gasCostEth: string;

  /**
   * Gas cost in USD at confirmation time.
   * Null if price feed unavailable.
   */
  gasCostUsd: string | null;

  /**
   * EVM logs emitted by the transaction.
   * Parsed into a structured format where ABI is available.
   */
  logs: TransactionLog[];

  // ── Confirmation tracking ──────────────────────────────────────────────────

  /** Number of blocks confirmed since this transaction was included. */
  confirmations: number;

  /** ISO 8601 timestamp of the confirming block. */
  blockTimestamp: string;

  // ── Explorer links ─────────────────────────────────────────────────────────

  /**
   * Block explorer URL for this transaction.
   * @example "https://sepolia.etherscan.io/tx/0x..."
   */
  explorerUrl: string;

  /**
   * Block explorer URL for the confirming block.
   * @example "https://sepolia.etherscan.io/block/12345678"
   */
  blockExplorerUrl: string;

  // ── Output extraction ──────────────────────────────────────────────────────

  /**
   * Decoded output values extracted from the transaction logs.
   * @example { amountOut: "42000000000000000", tokenOut: "0x..." }
   */
  decodedOutput: Record<string, unknown> | null;

  /** ISO 8601 timestamp when the platform confirmed this receipt. */
  confirmedAt: string;
}

/**
 * A single EVM log entry from the transaction receipt.
 */
export interface TransactionLog {
  /** Log index within the transaction. */
  logIndex: number;

  /** Contract address that emitted the log. */
  address: `0x${string}`;

  /** Array of indexed topic hashes. topics[0] is the event signature hash. */
  topics: `0x${string}`[];

  /** Non-indexed ABI-encoded log data (hex). */
  data: `0x${string}`;

  /**
   * Decoded event name if ABI is available.
   * @example "Transfer", "Swap", "Approval"
   */
  eventName?: string;

  /**
   * Decoded event arguments.
   * @example { from: "0x...", to: "0x...", value: "100000000" }
   */
  decodedArgs?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionFailure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records the reason and context of a transaction failure.
 *
 * Two distinct failure modes:
 *
 * - FAILED   : The transaction never reached the chain (submission error,
 *              mempool drop, nonce conflict, gas price too low).
 *
 * - REVERTED : The transaction was included in a block but the EVM reverted
 *              during execution (insufficient balance, slippage exceeded,
 *              access control violation, etc.).
 */
export interface TransactionFailure extends TransactionIdentity {
  /** FAILED for pre-chain errors; REVERTED for on-chain execution errors. */
  status: TransactionStatus.FAILED | TransactionStatus.REVERTED;

  // ── Classification ─────────────────────────────────────────────────────────

  /**
   * High-level failure category.
   *
   * - SIMULATION_FAILED     : Pre-flight simulation predicted a revert.
   * - SIGNATURE_REJECTED    : User rejected the signing request in their wallet.
   * - SIGNATURE_TIMEOUT     : User did not sign before the request expired.
   * - SUBMISSION_ERROR      : RPC error during eth_sendRawTransaction.
   * - MEMPOOL_DROPPED       : Transaction was ejected from the mempool (underpriced, replaced).
   * - NONCE_CONFLICT        : Nonce already used by another transaction.
   * - OUT_OF_GAS            : Transaction reverted due to insufficient gas.
   * - EVM_REVERT            : Contract logic reverted (require / revert / custom error).
   * - CONFIRMATION_TIMEOUT  : Expected confirmations not received within the timeout window.
   * - UNKNOWN               : Unclassified failure.
   */
  failureCategory:
    | "SIMULATION_FAILED"
    | "SIGNATURE_REJECTED"
    | "SIGNATURE_TIMEOUT"
    | "SUBMISSION_ERROR"
    | "MEMPOOL_DROPPED"
    | "NONCE_CONFLICT"
    | "OUT_OF_GAS"
    | "EVM_REVERT"
    | "CONFIRMATION_TIMEOUT"
    | "UNKNOWN";

  /** Human-readable failure message. */
  message: string;

  /**
   * Technical error details (RPC error message, ABI-decoded revert reason, etc.).
   */
  technicalDetail?: string;

  // ── On-chain revert context (only populated for REVERTED status) ────────────

  /**
   * Transaction hash of the reverted transaction.
   * Undefined if the transaction never reached the chain (FAILED).
   */
  txHash?: `0x${string}`;

  /** Block number of the reverted transaction. Undefined for FAILED. */
  blockNumber?: string;

  /**
   * EVM revert reason string.
   * @example "TRANSFER_AMOUNT_EXCEEDS_BALANCE"
   */
  revertReason?: string;

  /**
   * Custom error details if the contract uses Solidity custom errors.
   */
  revertError?: {
    errorName: string;
    params: Record<string, unknown>;
  };

  /** Gas used before reverting. Undefined for FAILED. Decimal string. */
  gasUsedBeforeRevert?: string;

  /**
   * Block explorer URL for the reverted transaction.
   * Undefined if transaction never reached the chain.
   */
  explorerUrl?: string;

  // ── Retry eligibility ──────────────────────────────────────────────────────

  /**
   * Whether the platform considers this failure retryable.
   * - MEMPOOL_DROPPED: retryable (bump gas).
   * - EVM_REVERT: typically not retryable.
   * - OUT_OF_GAS: retryable (increase gas limit).
   */
  isRetryable: boolean;

  /**
   * Suggested action for the agent or user.
   * @example "Increase maxFeePerGas and resubmit."
   */
  retryHint?: string;

  // ── Timestamp ──────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the failure was detected. */
  failedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionMetadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional structured metadata attached to a transaction for analytics,
 * debugging, and protocol-specific enrichment.
 */
export interface TransactionMetadata {
  /**
   * Protocol-specific metadata.
   * @example { poolAddress: "0x...", fee: 3000, slippageBps: 50 }
   */
  protocolParams?: Record<string, unknown>;

  /**
   * Slippage tolerance in basis points (1 bps = 0.01%).
   * @example 50 = 0.5%
   */
  slippageBps?: number;

  /**
   * Deadline timestamp for the transaction (Unix seconds).
   * Used by DEX routers to reject stale transactions.
   */
  deadline?: number;

  /**
   * Source chain ID for bridge transactions.
   * Undefined for single-chain transactions.
   */
  sourceChainId?: number;

  /**
   * Destination chain ID for bridge transactions.
   * Undefined for single-chain transactions.
   */
  destinationChainId?: number;

  /**
   * Input token address.
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" (USDC)
   */
  tokenIn?: `0x${string}`;

  /**
   * Output token address.
   */
  tokenOut?: `0x${string}`;

  /**
   * Human-readable input amount.
   * @example "100.00 USDC"
   */
  amountIn?: string;

  /**
   * Minimum acceptable output amount (after slippage).
   * @example "0.04 ETH"
   */
  amountOutMin?: string;

  /**
   * Audit trail tags for filtering.
   * @example ["swap", "uniswap-v3", "intent-driven"]
   */
  tags?: string[];

  /** Any additional key-value pairs. */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionRecord
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The unified, append-only record that aggregates all lifecycle stages
 * of a single transaction in one document.
 *
 * This is the primary persistence and query model.
 * Every stage (request → simulation → signature → submission → receipt/failure)
 * is nested within this record and populated progressively as the lifecycle advances.
 *
 * Usage:
 *   - Stored in the backend DB (one row per transaction).
 *   - Returned by GET /transaction/:id.
 *   - Projected to the frontend for status display.
 */
export interface TransactionRecord extends TransactionIdentity {
  // ── Classification ─────────────────────────────────────────────────────────

  /** Current lifecycle status. Source of truth for the UI. */
  status: TransactionStatus;

  /** Semantic classification of the transaction. */
  type: TransactionType;

  // ── Lifecycle stages (populated progressively) ─────────────────────────────

  /** Initial transaction object. Always present. */
  request: TransactionRequest;

  /**
   * Simulation result.
   * Null if simulation was skipped (e.g. MOCK tasks).
   */
  simulation: TransactionSimulation | null;

  /**
   * Signature request sent to the frontend.
   * Null until status reaches SIGNATURE_PENDING.
   */
  signatureRequest: TransactionSignatureRequest | null;

  /**
   * Submission record.
   * Null until the user has signed.
   */
  submission: TransactionSubmission | null;

  /**
   * On-chain receipt.
   * Null until status reaches CONFIRMED.
   */
  receipt: TransactionReceipt | null;

  /**
   * Failure record.
   * Null unless status is FAILED or REVERTED.
   */
  failure: TransactionFailure | null;

  // ── Quick-access fields (denormalized for query performance) ───────────────

  /**
   * Transaction hash.
   * Populated when status reaches SUBMITTED.
   * Null before submission.
   */
  txHash: `0x${string}` | null;

  /**
   * Block explorer URL.
   * Populated once txHash is available.
   * Null before submission.
   */
  explorerUrl: string | null;

  /**
   * Final gas cost in ETH.
   * Populated on CONFIRMED.
   * Null until confirmed.
   */
  gasCostEth: string | null;

  /**
   * Final gas cost in USD.
   * Populated on CONFIRMED.
   * Null until confirmed or if price feed unavailable.
   */
  gasCostUsd: string | null;

  // ── Optional enrichment ────────────────────────────────────────────────────

  /** Structured metadata for analytics and protocol-specific context. */
  metadata: TransactionMetadata;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the record was created. */
  createdAt: string;

  /** ISO 8601 timestamp of the most recent status update. */
  updatedAt: string;

  /**
   * ISO 8601 timestamp when the record reached a terminal state.
   * Null while still in progress.
   */
  finalizedAt: string | null;

  /**
   * Wall-clock duration in milliseconds from CREATED to terminal state.
   * Null while still in progress.
   */
  durationMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Explorer URL builder utility type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known block explorer base URLs indexed by EVM chain ID.
 * Extend this map as new chains are added.
 */
export const EXPLORER_BASE_URLS: Record<number, string> = {
  1:        "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
  8453:     "https://basescan.org",
  84532:    "https://sepolia.basescan.org",
  10:       "https://optimistic.etherscan.io",
  11155420: "https://sepolia-optimism.etherscan.io",
  42161:    "https://arbiscan.io",
  421614:   "https://sepolia.arbiscan.io",
  137:      "https://polygonscan.com",
  80001:    "https://mumbai.polygonscan.com",
} as const;

/**
 * Builds a block explorer transaction URL for a given chain.
 * Returns null if the chain ID is not in EXPLORER_BASE_URLS.
 *
 * @param chainId - EVM chain ID.
 * @param txHash  - Transaction hash.
 */
export const buildExplorerTxUrl = (
  chainId: number,
  txHash: `0x${string}`,
): string | null => {
  const base = EXPLORER_BASE_URLS[chainId];
  return base ? `${base}/tx/${txHash}` : null;
};

/**
 * Builds a block explorer block URL for a given chain.
 * Returns null if the chain ID is not in EXPLORER_BASE_URLS.
 *
 * @param chainId     - EVM chain ID.
 * @param blockNumber - Block number (decimal string or number).
 */
export const buildExplorerBlockUrl = (
  chainId: number,
  blockNumber: string | number,
): string | null => {
  const base = EXPLORER_BASE_URLS[chainId];
  return base ? `${base}/block/${blockNumber}` : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────────────────────

// ── Status guards ─────────────────────────────────────────────────────────────

/** Returns true if the transaction has been broadcast to the mempool. */
export const isTxSubmitted = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.SUBMITTED  ||
  tx.status === TransactionStatus.CONFIRMING ||
  tx.status === TransactionStatus.CONFIRMED;

/** Returns true if the transaction is awaiting on-chain confirmation. */
export const isTxConfirming = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.CONFIRMING;

/** Returns true if the transaction has been fully confirmed on-chain. */
export const isTxConfirmed = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.CONFIRMED;

/** Returns true if the transaction failed before or during on-chain execution. */
export const isTxFailed = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.FAILED;

/** Returns true if the transaction was included in a block but the EVM reverted. */
export const isTxReverted = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.REVERTED;

/** Returns true if the transaction is in any terminal state. */
export const isTxTerminal = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.CONFIRMED ||
  tx.status === TransactionStatus.FAILED    ||
  tx.status === TransactionStatus.REVERTED;

/** Returns true if the transaction is in any active (non-terminal) state. */
export const isTxActive = (tx: TransactionRecord): boolean =>
  !isTxTerminal(tx);

/** Returns true if the transaction is currently waiting for the user to sign. */
export const isTxAwaitingSignature = (tx: TransactionRecord): boolean =>
  tx.status === TransactionStatus.SIGNATURE_PENDING;

// ── Type guards ───────────────────────────────────────────────────────────────

/** Returns true if the transaction is a DEX swap. */
export const isSwapTx = (tx: TransactionRecord): boolean =>
  tx.type === TransactionType.SWAP;

/** Returns true if the transaction is a cross-chain bridge. */
export const isBridgeTx = (tx: TransactionRecord): boolean =>
  tx.type === TransactionType.BRIDGE;

/** Returns true if the transaction is an ERC-20 approval. */
export const isApprovalTx = (tx: TransactionRecord): boolean =>
  tx.type === TransactionType.ERC20_APPROVAL;

/** Returns true if the transaction is a staking action. */
export const isStakeTx = (tx: TransactionRecord): boolean =>
  tx.type === TransactionType.STAKE;

// ── Receipt / Failure narrowing ────────────────────────────────────────────────

/** Narrows a record to one with a confirmed receipt. Asserts receipt is non-null. */
export const hasReceipt = (
  tx: TransactionRecord,
): tx is TransactionRecord & { receipt: TransactionReceipt } =>
  tx.receipt !== null && tx.status === TransactionStatus.CONFIRMED;

/** Narrows a record to one with a failure report. Asserts failure is non-null. */
export const hasFailure = (
  tx: TransactionRecord,
): tx is TransactionRecord & { failure: TransactionFailure } =>
  tx.failure !== null &&
  (tx.status === TransactionStatus.FAILED || tx.status === TransactionStatus.REVERTED);

/** Returns true if the failed transaction is retryable. */
export const isRetryable = (tx: TransactionRecord): boolean =>
  hasFailure(tx) && tx.failure.isRetryable;
