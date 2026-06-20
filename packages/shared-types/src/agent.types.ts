/**
 * @file agent.types.ts
 * @description Canonical domain model for the Intent-Centric Web3 Execution Agent.
 *
 * This file defines the full lifecycle of an execution agent — from job creation
 * through task dispatch, on-chain confirmation, and terminal result.
 *
 * Lifecycle:
 *
 *   ┌─────────┐   ┌─────────┐   ┌──────────────────────┐   ┌─────────────────────────┐
 *   │  QUEUED │──▶│ RUNNING │──▶│  WAITING_SIGNATURE   │──▶│  WAITING_CONFIRMATION   │
 *   └─────────┘   └─────────┘   └──────────────────────┘   └─────────────────────────┘
 *                                                                          │
 *                                                            ┌─────────────┴──────────┐
 *                                                            ▼                        ▼
 *                                                       COMPLETED                  FAILED
 *
 * Relation to intent.types.ts:
 *   IntentRequest ──creates──▶ AgentJob ──spawns──▶ AgentTask[] ──produces──▶ AgentResult
 *
 * @module agent.types
 */

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import type { IntentStatus, IntentStep } from "./intent.types";

// ─────────────────────────────────────────────────────────────────────────────
// AgentJobStatus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents every state an AgentJob can occupy during its lifecycle.
 *
 * - QUEUED               : Job is enqueued; no agent worker has picked it up yet.
 * - RUNNING              : An agent worker is actively executing tasks.
 * - WAITING_SIGNATURE    : Execution is paused; awaiting a user wallet signature.
 * - WAITING_CONFIRMATION : A transaction has been submitted and is pending block confirmation.
 * - COMPLETED            : All tasks finished successfully; intent is fulfilled.
 * - FAILED               : Execution halted due to an unrecoverable error.
 */
export enum AgentJobStatus {
  QUEUED               = "QUEUED",
  RUNNING              = "RUNNING",
  WAITING_SIGNATURE    = "WAITING_SIGNATURE",
  WAITING_CONFIRMATION = "WAITING_CONFIRMATION",
  COMPLETED            = "COMPLETED",
  FAILED               = "FAILED",
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentTaskStatus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Granular status for an individual AgentTask within a job.
 *
 * - PENDING     : Task is registered but execution has not started.
 * - RUNNING     : Task is actively being processed by the agent worker.
 * - COMPLETED   : Task finished without error; output is available.
 * - SKIPPED     : Task was intentionally bypassed (e.g. approval already granted).
 * - FAILED      : Task encountered an error and did not complete.
 * - RETRYING    : Task failed but is being retried within the retry budget.
 */
export enum AgentTaskStatus {
  PENDING   = "PENDING",
  RUNNING   = "RUNNING",
  COMPLETED = "COMPLETED",
  SKIPPED   = "SKIPPED",
  FAILED    = "FAILED",
  RETRYING  = "RETRYING",
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentTaskType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defines the execution backend a task will use.
 *
 * - ONCHAIN    : Direct EVM transaction via Viem/Wagmi (requires wallet signature).
 * - PLAYWRIGHT : Browser automation via Playwright (interacts with dApp UI).
 * - API        : Off-chain HTTP call to an external service or protocol API.
 * - MOCK       : Simulated execution for demos, testing, and dry runs.
 */
export enum AgentTaskType {
  ONCHAIN    = "ONCHAIN",
  PLAYWRIGHT = "PLAYWRIGHT",
  API        = "API",
  MOCK       = "MOCK",
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentEventType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enumeration of all discrete events that can occur in the agent lifecycle.
 * Events are emitted to the frontend via WebSocket or SSE for real-time updates.
 *
 * - JOB_CREATED         : A new AgentJob was registered from an approved intent.
 * - TASK_STARTED        : An individual AgentTask has begun execution.
 * - TASK_COMPLETED      : An AgentTask finished successfully.
 * - TX_SUBMITTED        : An on-chain transaction was broadcast to the mempool.
 * - TX_CONFIRMED        : An on-chain transaction was included in a confirmed block.
 * - SIGNATURE_REQUESTED : Agent is paused and requires a user wallet signature.
 * - SIGNATURE_RECEIVED  : User signed the payload; agent will resume.
 * - ERROR               : A non-fatal or fatal error occurred; includes error context.
 */
export enum AgentEventType {
  JOB_CREATED         = "JOB_CREATED",
  TASK_STARTED        = "TASK_STARTED",
  TASK_COMPLETED      = "TASK_COMPLETED",
  TX_SUBMITTED        = "TX_SUBMITTED",
  TX_CONFIRMED        = "TX_CONFIRMED",
  SIGNATURE_REQUESTED = "SIGNATURE_REQUESTED",
  SIGNATURE_RECEIVED  = "SIGNATURE_RECEIVED",
  ERROR               = "ERROR",
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentLogLevel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log severity levels for AgentExecutionLog entries.
 */
export enum AgentLogLevel {
  DEBUG   = "DEBUG",
  INFO    = "INFO",
  WARN    = "WARN",
  ERROR   = "ERROR",
}

// ─────────────────────────────────────────────────────────────────────────────
// Supporting value types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Immutable retry policy attached to a task.
 * Agent workers respect this policy before escalating a task to FAILED.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (0 = no retries). */
  maxAttempts: number;

  /** Current retry attempt count (0 on first attempt). */
  currentAttempt: number;

  /** Delay in milliseconds between attempts (exponential backoff applied server-side). */
  delayMs: number;

  /**
   * If true, apply exponential backoff: delayMs * 2^(currentAttempt - 1).
   * Defaults to true.
   */
  exponentialBackoff: boolean;
}

/**
 * Payload required for an ONCHAIN task.
 */
export interface OnchainTaskPayload {
  /** EVM chain ID where the transaction will be submitted. */
  chainId: number;

  /** Target contract address. */
  to: `0x${string}`;

  /** ABI-encoded calldata. */
  data: `0x${string}`;

  /** Native value in wei (as string to preserve precision). */
  value: string;

  /** Gas limit override. Undefined = use estimateGas. */
  gasLimit?: string;

  /** Max fee per gas in wei (EIP-1559). */
  maxFeePerGas?: string;

  /** Max priority fee per gas in wei (EIP-1559). */
  maxPriorityFeePerGas?: string;
}

/**
 * Payload for a PLAYWRIGHT browser automation task.
 */
export interface PlaywrightTaskPayload {
  /** Target URL to navigate to. */
  url: string;

  /** Playwright adapter identifier (maps to a registered adapter class). */
  adapterId: string;

  /** Adapter-specific action to invoke (e.g. "executeSwap", "claimRewards"). */
  action: string;

  /** Arbitrary parameters passed to the adapter action. */
  params: Record<string, unknown>;

  /** Maximum time in milliseconds to wait for page actions. Defaults to 30_000. */
  timeoutMs?: number;

  /** Whether to capture a screenshot on failure. Defaults to true. */
  screenshotOnFailure?: boolean;
}

/**
 * Payload for an API (off-chain HTTP) task.
 */
export interface ApiTaskPayload {
  /** Full URL of the external endpoint. */
  url: string;

  /** HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  /** Request headers. */
  headers?: Record<string, string>;

  /** Request body (JSON serializable). */
  body?: unknown;

  /** Timeout in milliseconds. Defaults to 10_000. */
  timeoutMs?: number;
}

/**
 * Payload for a MOCK task.
 * Used in demos and dry-run flows to simulate execution without real side effects.
 */
export interface MockTaskPayload {
  /** Simulated latency in milliseconds before the task "completes". */
  simulatedDelayMs: number;

  /** If true, the mock task will resolve as failed. Used to test error flows. */
  shouldFail: boolean;

  /** Simulated output returned when the task "completes". */
  mockOutput: Record<string, unknown>;
}

/**
 * Discriminated union of all possible task payloads.
 * The `type` field on AgentTask determines which payload shape is valid.
 */
export type AgentTaskPayload =
  | { type: AgentTaskType.ONCHAIN;    payload: OnchainTaskPayload    }
  | { type: AgentTaskType.PLAYWRIGHT; payload: PlaywrightTaskPayload }
  | { type: AgentTaskType.API;        payload: ApiTaskPayload        }
  | { type: AgentTaskType.MOCK;       payload: MockTaskPayload       };

// ─────────────────────────────────────────────────────────────────────────────
// AgentTask
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a single, atomic unit of work within an AgentJob.
 * Tasks are executed in step order; a failed non-optional task halts the job.
 *
 * @example
 * ```ts
 * const task: AgentTask = {
 *   id:        "task_abc123",
 *   jobId:     "job_xyz789",
 *   intentId:  "intent_111",
 *   stepIndex: 0,
 *   ...
 * };
 * ```
 */
export interface AgentTask {
  // ── Identity ───────────────────────────────────────────────────────────────

  /** Unique task identifier (UUID v4). */
  id: string;

  /** Parent job identifier. Correlates this task to its AgentJob. */
  jobId: string;

  /** Source intent identifier. Enables tracing task → intent lineage. */
  intentId: string;

  /**
   * Correlation ID for distributed tracing (e.g. shared with backend request logs).
   * Generated once per job, propagated to all child tasks.
   */
  correlationId: string;

  // ── Ordering & Plan Linkage ────────────────────────────────────────────────

  /**
   * Zero-based index within the parent job's task array.
   * Corresponds to IntentStep.stepIndex from the approved plan.
   */
  stepIndex: number;

  /**
   * The original IntentStep this task was derived from.
   * Preserved for audit trail and debugging.
   */
  sourceStep: IntentStep;

  // ── Type & Payload ─────────────────────────────────────────────────────────

  /**
   * Execution backend for this task.
   * Determines which payload shape and executor handles this task.
   */
  executionType: AgentTaskType;

  /**
   * Discriminated union payload.
   * Must match the executionType discriminant.
   */
  taskPayload: AgentTaskPayload;

  // ── Status ─────────────────────────────────────────────────────────────────

  /** Current execution status of this task. */
  status: AgentTaskStatus;

  /**
   * Whether this task can be skipped without failing the job.
   * @example An ERC-20 approval task is optional if allowance is already sufficient.
   */
  optional: boolean;

  // ── Retry ──────────────────────────────────────────────────────────────────

  /** Retry configuration for this task. */
  retryPolicy: RetryPolicy;

  // ── On-chain Output (populated post-execution) ─────────────────────────────

  /**
   * Transaction hash, if this task submitted an on-chain transaction.
   * Undefined until the transaction is broadcast.
   */
  txHash?: `0x${string}`;

  /** Block number in which the transaction was confirmed. */
  confirmedBlock?: bigint;

  /** Actual gas used (wei). Available after confirmation. */
  gasUsed?: bigint;

  // ── Generic Output ─────────────────────────────────────────────────────────

  /**
   * Arbitrary key-value output from this task.
   * @example { amountOut: "0.042", tokenOut: "ETH" }
   */
  output?: Record<string, unknown>;

  /** Error message if status is FAILED or RETRYING. */
  error?: string;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the task was registered. */
  createdAt: string;

  /** ISO 8601 timestamp when execution started. Undefined if still PENDING. */
  startedAt?: string;

  /** ISO 8601 timestamp when execution completed (any terminal state). */
  completedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentJob
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The top-level execution unit created from an approved IntentPlan.
 * A job owns an ordered list of AgentTask objects and tracks their
 * collective progress through the agent lifecycle.
 *
 * One intent → one job → one or more tasks.
 */
export interface AgentJob {
  // ── Identity ───────────────────────────────────────────────────────────────

  /** Unique job identifier (UUID v4). Format: "job_<uuid>". */
  id: string;

  /**
   * Source intent identifier.
   * Directly references IntentRequest.id and IntentPlan.intentId.
   */
  intentId: string;

  /**
   * Correlation ID propagated to all child tasks, logs, and events.
   * Used for distributed tracing across frontend ↔ backend ↔ agent.
   */
  correlationId: string;

  // ── Ownership ──────────────────────────────────────────────────────────────

  /** EVM wallet address of the user who owns this job. */
  userAddress: `0x${string}`;

  /** EVM chain ID the user was connected to when the job was created. */
  sourceChainId: number;

  // ── Status & Progress ──────────────────────────────────────────────────────

  /** Overall job status. Updated as tasks progress. */
  status: AgentJobStatus;

  /**
   * Snapshot of the intent status at job creation.
   * Should be IntentStatus.APPROVED at construction.
   */
  intentStatusAtCreation: IntentStatus;

  /** Ordered list of tasks to be executed. */
  tasks: AgentTask[];

  /** Index of the task currently being executed. -1 if not yet started. */
  currentTaskIndex: number;

  /** Total task count. Derived from tasks.length; stored for quick access. */
  totalTasks: number;

  /** Count of tasks that have reached COMPLETED status. */
  completedTasks: number;

  /** Count of tasks that have reached FAILED status. */
  failedTasks: number;

  // ── Session & Worker ───────────────────────────────────────────────────────

  /**
   * ID of the AgentSession managing this job.
   * Populated when a worker claims the job from the queue.
   */
  sessionId?: string;

  /**
   * Identifier of the worker process/instance that claimed this job.
   * Useful for debugging multi-worker deployments.
   */
  workerId?: string;

  // ── Signature State ────────────────────────────────────────────────────────

  /**
   * When status is WAITING_SIGNATURE, this contains the unsigned
   * transaction or message payload the user must sign.
   */
  pendingSignaturePayload?: OnchainTaskPayload;

  /**
   * The signed transaction/message returned by the user.
   * Populated when status transitions from WAITING_SIGNATURE → RUNNING.
   */
  receivedSignature?: `0x${string}`;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the job was created. */
  createdAt: string;

  /** ISO 8601 timestamp when a worker claimed the job. Undefined while QUEUED. */
  startedAt?: string;

  /** ISO 8601 timestamp when the job reached a terminal state. */
  completedAt?: string;

  /** Wall-clock duration in milliseconds. Null until completed. */
  durationMs: number | null;

  // ── Metadata ───────────────────────────────────────────────────────────────

  /** Optional tags for filtering and observability (e.g. ["swap", "stake"]). */
  tags?: string[];

  /** Free-form metadata for debugging or analytics. */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentExecutionLog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single structured log entry emitted during agent execution.
 *
 * Logs are append-only. Each entry captures one discrete moment in the
 * execution timeline with enough context to reconstruct what happened.
 * Stored in the backend and streamed to the frontend for live activity feeds.
 */
export interface AgentExecutionLog {
  // ── Identity ───────────────────────────────────────────────────────────────

  /** Unique log entry identifier (UUID v4). */
  id: string;

  /** Parent job identifier. */
  jobId: string;

  /** Parent task identifier. Undefined for job-level log entries. */
  taskId?: string;

  /** Source intent identifier. */
  intentId: string;

  /**
   * Correlation ID matching the parent job.
   * Enables joining logs across services in distributed traces.
   */
  correlationId: string;

  // ── Content ────────────────────────────────────────────────────────────────

  /** Log severity level. */
  level: AgentLogLevel;

  /** Human-readable log message. */
  message: string;

  /**
   * Structured data attached to this log entry.
   * @example { txHash: "0x...", gasUsed: "21000", protocol: "Uniswap V3" }
   */
  context?: Record<string, unknown>;

  /**
   * Error details if this is an error-level log.
   * Contains the message, stack trace, and optional error code.
   */
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };

  // ── Source ─────────────────────────────────────────────────────────────────

  /**
   * Which execution layer emitted this log.
   * Useful for filtering in observability dashboards.
   */
  source: "AGENT_WORKER" | "PLAYWRIGHT" | "CHAIN_SERVICE" | "API_SERVICE" | "SYSTEM";

  /**
   * Step index this log corresponds to.
   * Undefined for job-level entries.
   */
  stepIndex?: number;

  // ── Timestamp ──────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp with millisecond precision. */
  timestamp: string;

  /** Monotonic sequence number within the job. Used for ordered rendering. */
  sequence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentEvent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A typed domain event emitted by the agent and pushed to the frontend
 * via WebSocket or Server-Sent Events (SSE).
 *
 * Events are the primary mechanism for real-time UI updates.
 * Each event is self-contained — the frontend should not need to poll
 * after receiving an event.
 */
export interface AgentEvent<
  TType extends AgentEventType = AgentEventType,
  TData = unknown,
> {
  // ── Identity ───────────────────────────────────────────────────────────────

  /** Unique event identifier (UUID v4). */
  id: string;

  /** The type of event. Used as the discriminant for TData. */
  type: TType;

  /** Parent job identifier. */
  jobId: string;

  /** Source intent identifier. */
  intentId: string;

  /**
   * Correlation ID for distributed tracing.
   * Matches AgentJob.correlationId.
   */
  correlationId: string;

  // ── Payload ────────────────────────────────────────────────────────────────

  /**
   * Typed event payload.
   * Shape varies by event type — see AgentEventPayloadMap.
   */
  data: TData;

  // ── Timestamp ──────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the event was emitted. */
  timestamp: string;
}

// ── Strongly typed event payload map ──────────────────────────────────────────

/**
 * Maps each AgentEventType to its concrete data payload shape.
 * Use with the generic AgentEvent<T, AgentEventPayloadMap[T]> for full type safety.
 */
export interface AgentEventPayloadMap {
  [AgentEventType.JOB_CREATED]: {
    job: Pick<AgentJob, "id" | "intentId" | "totalTasks" | "userAddress" | "createdAt">;
  };

  [AgentEventType.TASK_STARTED]: {
    taskId: string;
    stepIndex: number;
    executionType: AgentTaskType;
    description: string;
  };

  [AgentEventType.TASK_COMPLETED]: {
    taskId: string;
    stepIndex: number;
    executionType: AgentTaskType;
    output?: Record<string, unknown>;
    durationMs: number;
  };

  [AgentEventType.TX_SUBMITTED]: {
    taskId: string;
    stepIndex: number;
    txHash: `0x${string}`;
    chainId: number;
    to: `0x${string}`;
  };

  [AgentEventType.TX_CONFIRMED]: {
    taskId: string;
    stepIndex: number;
    txHash: `0x${string}`;
    chainId: number;
    blockNumber: string; // bigint serialized as string for JSON transport
    gasUsed: string;
  };

  [AgentEventType.SIGNATURE_REQUESTED]: {
    taskId: string;
    stepIndex: number;
    payload: OnchainTaskPayload;
    /** Human-readable prompt to show the user in the signature modal. */
    prompt: string;
  };

  [AgentEventType.SIGNATURE_RECEIVED]: {
    taskId: string;
    stepIndex: number;
    signature: `0x${string}`;
  };

  [AgentEventType.ERROR]: {
    taskId?: string;
    stepIndex?: number;
    message: string;
    code?: string;
    fatal: boolean;
  };
}

/**
 * Convenience type aliases for each strongly-typed event variant.
 */
export type JobCreatedEvent         = AgentEvent<AgentEventType.JOB_CREATED,         AgentEventPayloadMap[AgentEventType.JOB_CREATED]>;
export type TaskStartedEvent        = AgentEvent<AgentEventType.TASK_STARTED,        AgentEventPayloadMap[AgentEventType.TASK_STARTED]>;
export type TaskCompletedEvent      = AgentEvent<AgentEventType.TASK_COMPLETED,      AgentEventPayloadMap[AgentEventType.TASK_COMPLETED]>;
export type TxSubmittedEvent        = AgentEvent<AgentEventType.TX_SUBMITTED,        AgentEventPayloadMap[AgentEventType.TX_SUBMITTED]>;
export type TxConfirmedEvent        = AgentEvent<AgentEventType.TX_CONFIRMED,        AgentEventPayloadMap[AgentEventType.TX_CONFIRMED]>;
export type SignatureRequestedEvent = AgentEvent<AgentEventType.SIGNATURE_REQUESTED, AgentEventPayloadMap[AgentEventType.SIGNATURE_REQUESTED]>;
export type SignatureReceivedEvent  = AgentEvent<AgentEventType.SIGNATURE_RECEIVED,  AgentEventPayloadMap[AgentEventType.SIGNATURE_RECEIVED]>;
export type AgentErrorEvent         = AgentEvent<AgentEventType.ERROR,               AgentEventPayloadMap[AgentEventType.ERROR]>;

/** Union of all possible concrete agent events. */
export type AnyAgentEvent =
  | JobCreatedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TxSubmittedEvent
  | TxConfirmedEvent
  | SignatureRequestedEvent
  | SignatureReceivedEvent
  | AgentErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// AgentSession
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a live execution session between the frontend and the agent worker.
 * Created when a user approves a plan and the agent claims the job.
 *
 * A session tracks:
 * - The transport channel (WebSocket/SSE) for real-time event delivery.
 * - The browser context (if Playwright tasks are involved).
 * - Session-level health and activity metrics.
 */
export interface AgentSession {
  // ── Identity ───────────────────────────────────────────────────────────────

  /** Unique session identifier. Format: "session_<uuid>". */
  id: string;

  /** The job this session is managing. */
  jobId: string;

  /** Source intent identifier. */
  intentId: string;

  /** Correlation ID matching the parent job. */
  correlationId: string;

  // ── Ownership ──────────────────────────────────────────────────────────────

  /** Wallet address of the session owner. */
  userAddress: `0x${string}`;

  // ── Transport ──────────────────────────────────────────────────────────────

  /**
   * Real-time push transport mechanism.
   * - WEBSOCKET : Bidirectional (used when signature round-trips are needed).
   * - SSE       : Server-sent events (unidirectional, simpler).
   * - POLLING   : Fallback mode for environments that block WS/SSE.
   */
  transportType: "WEBSOCKET" | "SSE" | "POLLING";

  /** Whether the real-time channel is currently open and healthy. */
  isConnected: boolean;

  // ── Playwright Context ─────────────────────────────────────────────────────

  /**
   * Whether this session has an active Playwright browser context.
   * True if any task in the job has executionType === PLAYWRIGHT.
   */
  hasBrowserContext: boolean;

  /**
   * Playwright browser context ID.
   * Undefined if no Playwright tasks are present.
   */
  browserContextId?: string;

  // ── Health & Metrics ───────────────────────────────────────────────────────

  /** Number of events emitted during this session. */
  eventCount: number;

  /** ISO 8601 timestamp of the last event emitted or received. */
  lastActivityAt: string;

  /**
   * Heartbeat interval in milliseconds.
   * Agent sends a ping on this interval; frontend disconnect is detected on timeout.
   */
  heartbeatIntervalMs: number;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when the session was established. */
  createdAt: string;

  /** ISO 8601 timestamp when the session was closed. Undefined while active. */
  closedAt?: string;

  /**
   * Reason the session was closed.
   * Undefined while active.
   */
  closeReason?: "JOB_COMPLETED" | "JOB_FAILED" | "USER_DISCONNECTED" | "TIMEOUT" | "ERROR";
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentResult
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The immutable terminal record produced when an AgentJob completes.
 * Written once; never mutated after creation.
 *
 * This is the authoritative record of what the agent actually did.
 * It is linked back to the IntentResult via intentId.
 */
export interface AgentResult {
  // ── Identity ───────────────────────────────────────────────────────────────

  /** Unique result identifier (UUID v4). */
  id: string;

  /** The job that produced this result. */
  jobId: string;

  /** Source intent identifier. */
  intentId: string;

  /** Correlation ID from the parent job. */
  correlationId: string;

  // ── Outcome ────────────────────────────────────────────────────────────────

  /** Terminal status. COMPLETED maps to IntentStatus.SUCCESS; FAILED maps to IntentStatus.FAILED. */
  status: AgentJobStatus.COMPLETED | AgentJobStatus.FAILED;

  /**
   * Human-readable summary of what the agent accomplished.
   * @example "Swapped 100 USDC → 0.042 ETH on Uniswap V3 and staked to Lido."
   */
  summary: string;

  // ── Task Outcomes ──────────────────────────────────────────────────────────

  /** Snapshot of all tasks at the time of completion. */
  tasks: AgentTask[];

  /** Number of tasks that completed successfully. */
  tasksSucceeded: number;

  /** Number of tasks that failed. */
  tasksFailed: number;

  /** Number of tasks that were skipped. */
  tasksSkipped: number;

  // ── On-chain Summary ───────────────────────────────────────────────────────

  /**
   * Ordered list of all transaction hashes submitted during this job.
   * Empty if no on-chain transactions occurred.
   */
  txHashes: `0x${string}`[];

  /**
   * Hash of the last confirmed transaction.
   * Null if no on-chain transactions occurred.
   */
  finalTxHash: `0x${string}` | null;

  /**
   * Aggregate gas cost across all on-chain tasks, in ETH (as string).
   * Null if no on-chain tasks executed.
   */
  totalGasCostEth: string | null;

  // ── Execution Log Reference ────────────────────────────────────────────────

  /**
   * IDs of all AgentExecutionLog entries associated with this job.
   * Allows fetching the full execution timeline from the backend.
   */
  logIds: string[];

  // ── Error ──────────────────────────────────────────────────────────────────

  /**
   * Top-level error message if status is FAILED.
   * Null on COMPLETED.
   */
  error: string | null;

  /**
   * The task ID that caused the terminal failure.
   * Null on COMPLETED or if the failure was job-level.
   */
  failedAtTaskId: string | null;

  // ── Timing ─────────────────────────────────────────────────────────────────

  /** ISO 8601 timestamp when execution started. */
  startedAt: string;

  /** ISO 8601 timestamp when the result was written. */
  completedAt: string;

  /** Wall-clock duration in milliseconds. */
  durationMs: number;

  // ── Arbitrary Output ───────────────────────────────────────────────────────

  /**
   * Aggregated structured output from all tasks.
   * Used by downstream services or the IntentResult builder.
   */
  output?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────────────────────

// ── Job status guards ─────────────────────────────────────────────────────────

/** Returns true if the job is waiting for a user wallet signature. */
export const isJobWaitingSignature = (job: AgentJob): boolean =>
  job.status === AgentJobStatus.WAITING_SIGNATURE;

/** Returns true if the job is waiting for a transaction to be confirmed on-chain. */
export const isJobWaitingConfirmation = (job: AgentJob): boolean =>
  job.status === AgentJobStatus.WAITING_CONFIRMATION;

/** Returns true if the job is in an active (non-queued, non-terminal) state. */
export const isJobActive = (job: AgentJob): boolean =>
  job.status === AgentJobStatus.RUNNING              ||
  job.status === AgentJobStatus.WAITING_SIGNATURE    ||
  job.status === AgentJobStatus.WAITING_CONFIRMATION;

/** Returns true if the job has reached a terminal state. */
export const isJobTerminal = (job: AgentJob): boolean =>
  job.status === AgentJobStatus.COMPLETED ||
  job.status === AgentJobStatus.FAILED;

/** Returns true if the job completed successfully. */
export const isJobCompleted = (job: AgentJob): boolean =>
  job.status === AgentJobStatus.COMPLETED;

/** Returns true if the job failed. */
export const isJobFailed = (job: AgentJob): boolean =>
  job.status === AgentJobStatus.FAILED;

// ── Task type guards ──────────────────────────────────────────────────────────

/** Returns true if the task uses the ONCHAIN executor. */
export const isOnchainTask = (task: AgentTask): boolean =>
  task.executionType === AgentTaskType.ONCHAIN;

/** Returns true if the task uses the PLAYWRIGHT executor. */
export const isPlaywrightTask = (task: AgentTask): boolean =>
  task.executionType === AgentTaskType.PLAYWRIGHT;

/** Returns true if the task uses the API executor. */
export const isApiTask = (task: AgentTask): boolean =>
  task.executionType === AgentTaskType.API;

/** Returns true if the task is a simulated MOCK execution. */
export const isMockTask = (task: AgentTask): boolean =>
  task.executionType === AgentTaskType.MOCK;

/** Returns true if the task has reached a terminal state. */
export const isTaskTerminal = (task: AgentTask): boolean =>
  task.status === AgentTaskStatus.COMPLETED ||
  task.status === AgentTaskStatus.FAILED    ||
  task.status === AgentTaskStatus.SKIPPED;

// ── Event type guards ─────────────────────────────────────────────────────────

/** Narrows an AnyAgentEvent to a SignatureRequestedEvent. */
export const isSignatureRequestedEvent = (event: AnyAgentEvent): event is SignatureRequestedEvent =>
  event.type === AgentEventType.SIGNATURE_REQUESTED;

/** Narrows an AnyAgentEvent to a TxSubmittedEvent. */
export const isTxSubmittedEvent = (event: AnyAgentEvent): event is TxSubmittedEvent =>
  event.type === AgentEventType.TX_SUBMITTED;

/** Narrows an AnyAgentEvent to a TxConfirmedEvent. */
export const isTxConfirmedEvent = (event: AnyAgentEvent): event is TxConfirmedEvent =>
  event.type === AgentEventType.TX_CONFIRMED;

/** Narrows an AnyAgentEvent to an AgentErrorEvent. */
export const isAgentErrorEvent = (event: AnyAgentEvent): event is AgentErrorEvent =>
  event.type === AgentEventType.ERROR;

/** Returns true if the error event represents a fatal (job-halting) error. */
export const isFatalErrorEvent = (event: AnyAgentEvent): boolean =>
  isAgentErrorEvent(event) && (event.data as AgentEventPayloadMap[AgentEventType.ERROR]).fatal;

// ── Result guards ─────────────────────────────────────────────────────────────

/** Returns true if the agent result represents full success. */
export const isResultSuccess = (result: AgentResult): boolean =>
  result.status === AgentJobStatus.COMPLETED;

/** Returns true if the agent result represents a failure. */
export const isResultFailed = (result: AgentResult): boolean =>
  result.status === AgentJobStatus.FAILED;
