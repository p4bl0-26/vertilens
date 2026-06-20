/**
 * @file intent.types.ts
 * @description Canonical type definitions for the Intent lifecycle.
 *
 * Flow:
 *   IntentRequest → IntentPlan → IntentExecution → IntentResult
 *
 *   Status progression:
 *   CREATED → PARSED → APPROVED → EXECUTING → SUCCESS | FAILED
 */

// ─────────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents every possible lifecycle state an intent can occupy.
 *
 * - CREATED   : Raw user input received, not yet parsed.
 * - PARSED    : NLP/LLM has produced a structured plan; awaiting approval.
 * - APPROVED  : User (or auto-policy) has confirmed the plan.
 * - EXECUTING : Agent is actively processing on-chain / off-chain steps.
 * - SUCCESS   : All steps completed and confirmed on-chain.
 * - FAILED    : One or more steps failed; execution halted.
 */
export enum IntentStatus {
  CREATED   = "CREATED",
  PARSED    = "PARSED",
  APPROVED  = "APPROVED",
  EXECUTING = "EXECUTING",
  SUCCESS   = "SUCCESS",
  FAILED    = "FAILED",
}

// ─────────────────────────────────────────────────────────────────────────────
// Step-level types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported action categories the agent can perform. */
export type IntentActionType =
  | "SWAP"
  | "BRIDGE"
  | "STAKE"
  | "UNSTAKE"
  | "CLAIM"
  | "TRANSFER"
  | "APPROVE"
  | "CUSTOM";

/**
 * A single discrete step within a plan.
 * Steps are ordered and may carry on-chain calldata.
 */
export interface IntentStep {
  /** Zero-based index within the plan's step array. */
  stepIndex: number;

  /** Human-readable description of what this step does. */
  description: string;

  /** What kind of action this step performs. */
  actionType: IntentActionType;

  /** Target protocol or contract label (e.g. "Uniswap V3", "Aave"). */
  protocol: string;

  /** EVM chain ID where this step executes. */
  chainId: number;

  /**
   * Target contract address.
   * Undefined if resolved at execution time (e.g. depends on prior step output).
   */
  contractAddress?: `0x${string}`;

  /**
   * ABI-encoded calldata for the transaction.
   * Undefined for off-chain or Playwright-based steps.
   */
  calldata?: `0x${string}`;

  /** Native or ERC-20 token value to send with the call (in wei). */
  value?: string;

  /** Estimated gas limit for this step. */
  estimatedGas?: bigint;

  /** Whether this step can be skipped if it fails (e.g. an approval that's already granted). */
  optional?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentRequest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The raw input payload submitted by the user or calling system.
 * Created when the user submits a natural-language command.
 */
export interface IntentRequest {
  /** Server-assigned unique identifier (UUID v4). */
  id: string;

  /** EVM wallet address of the user initiating the intent. */
  userAddress: `0x${string}`;

  /**
   * Raw, unstructured text expressing the user's desired outcome.
   * @example "Swap 100 USDC to ETH and stake it"
   */
  rawInput: string;

  /** EVM chain ID the user is currently connected to. */
  sourceChainId: number;

  /** ISO 8601 timestamp of when the request was received. */
  createdAt: string;

  /** Always CREATED on construction. Updated as lifecycle progresses. */
  status: IntentStatus.CREATED;

  /** Optional metadata for client-side tracking (e.g. session ID). */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentPlan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A structured, agent-generated execution plan derived from an IntentRequest.
 * Produced by the intent parser service; shown to the user before approval.
 * Status transitions: CREATED → PARSED (on creation) → APPROVED (after user confirms).
 */
export interface IntentPlan {
  /** Mirrors the originating IntentRequest.id. */
  intentId: string;

  /** Current status; will be PARSED or APPROVED. */
  status: IntentStatus.PARSED | IntentStatus.APPROVED;

  /** Human-readable summary of what the plan will do. */
  summary: string;

  /** Ordered list of steps to be executed. */
  steps: IntentStep[];

  /**
   * Chain IDs involved across all steps.
   * Derived field — useful for UI chain-switch prompts.
   */
  chainIds: number[];

  /**
   * Aggregate estimated USD cost of all steps (gas + protocol fees).
   * Null if estimation is unavailable.
   */
  estimatedCostUsd: string | null;

  /**
   * Estimated wall-clock time to complete all steps (seconds).
   * Includes bridge finality times where applicable.
   */
  estimatedDurationSeconds: number | null;

  /** ISO 8601 timestamp of when the plan was generated. */
  parsedAt: string;

  /** ISO 8601 timestamp of when the user approved the plan. Null until approved. */
  approvedAt: string | null;

  /**
   * Confidence score from the intent parser (0.0 – 1.0).
   * Low scores should surface a disambiguation prompt.
   */
  parserConfidence: number;

  /** Raw structured output from the LLM/parser for debugging. */
  rawParserOutput?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentExecution
// ─────────────────────────────────────────────────────────────────────────────

/** Status of an individual step during execution. */
export type StepExecutionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "CONFIRMED"
  | "SKIPPED"
  | "FAILED";

/** Execution record for a single step. */
export interface StepExecution {
  /** Matches IntentStep.stepIndex. */
  stepIndex: number;

  /** Current execution status of this step. */
  status: StepExecutionStatus;

  /**
   * On-chain transaction hash if the step submitted a transaction.
   * Undefined for off-chain or Playwright steps.
   */
  txHash?: `0x${string}`;

  /** Block number in which the transaction was confirmed. */
  blockNumber?: bigint;

  /**
   * Actual gas used (post-confirmation).
   * Undefined until confirmed.
   */
  gasUsed?: bigint;

  /** ISO 8601 start timestamp. */
  startedAt?: string;

  /** ISO 8601 completion timestamp. */
  completedAt?: string;

  /** Error message if status is FAILED. */
  error?: string;

  /** Arbitrary key-value output from this step (e.g. amount received). */
  output?: Record<string, unknown>;
}

/**
 * Tracks real-time execution state for an approved intent plan.
 * Created when the plan transitions from APPROVED → EXECUTING.
 */
export interface IntentExecution {
  /** Mirrors the originating IntentRequest.id. */
  intentId: string;

  /** Always EXECUTING while in progress. */
  status: IntentStatus.EXECUTING;

  /** Step-level execution records, indexed by stepIndex. */
  steps: StepExecution[];

  /** Index of the step currently being processed. */
  currentStepIndex: number;

  /** Total number of steps in the plan. */
  totalSteps: number;

  /** ISO 8601 timestamp when execution started. */
  startedAt: string;

  /**
   * Agent job ID for correlating with backend logs and Playwright sessions.
   */
  agentJobId: string;

  /** Optional human-readable status message for the UI (e.g. "Waiting for bridge..."). */
  statusMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentResult
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Final outcome record produced after execution completes (success or failure).
 * This is the terminal state object — immutable once written.
 */
export interface IntentResult {
  /** Mirrors the originating IntentRequest.id. */
  intentId: string;

  /** Terminal status: SUCCESS or FAILED. */
  status: IntentStatus.SUCCESS | IntentStatus.FAILED;

  /** All step-level execution records at completion. */
  steps: StepExecution[];

  /** Number of steps that completed successfully. */
  stepsSucceeded: number;

  /** Number of steps that failed. */
  stepsFailed: number;

  /**
   * The hash of the last confirmed transaction.
   * Null on pure failure with no on-chain activity.
   */
  finalTxHash: `0x${string}` | null;

  /** ISO 8601 timestamp when execution started. */
  startedAt: string;

  /** ISO 8601 timestamp when execution completed. */
  completedAt: string;

  /** Wall-clock duration in milliseconds. */
  durationMs: number;

  /**
   * Human-readable summary of what was accomplished.
   * @example "Swapped 100 USDC → 0.042 ETH and staked to Lido."
   */
  summary: string;

  /**
   * Top-level error message if status is FAILED.
   * Null on SUCCESS.
   */
  error: string | null;

  /**
   * Aggregate actual gas cost in ETH (as string to preserve precision).
   * Null if no on-chain steps were executed.
   */
  totalGasCostEth: string | null;

  /** Arbitrary structured output for downstream consumers. */
  output?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite: full intent record (all stages merged)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience union for passing the full intent state in API responses.
 * All fields after `request` are optional — only populated as lifecycle progresses.
 */
export interface IntentRecord {
  request:   IntentRequest;
  plan?:     IntentPlan;
  execution?: IntentExecution;
  result?:   IntentResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

export const isIntentSuccess = (result: IntentResult): boolean =>
  result.status === IntentStatus.SUCCESS;

export const isIntentFailed = (result: IntentResult): boolean =>
  result.status === IntentStatus.FAILED;

export const isIntentTerminal = (status: IntentStatus): boolean =>
  status === IntentStatus.SUCCESS || status === IntentStatus.FAILED;

export const isIntentActive = (status: IntentStatus): boolean =>
  status === IntentStatus.EXECUTING;
