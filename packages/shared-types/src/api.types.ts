/**
 * @file api.types.ts
 * @description Canonical API contract layer for the Intent-Centric Web3 Execution Platform.
 *
 * This file defines every HTTP request and response shape exchanged between:
 *   - Frontend (Next.js)    → Backend (FastAPI)
 *   - Backend (FastAPI)     → Agent Engine
 *   - Agent Engine          → Backend (webhook callbacks)
 *
 * Contract coverage:
 *   POST   /intent
 *   GET    /intent/:id
 *   POST   /intent/:id/approve
 *   POST   /intent/:id/execute
 *   GET    /intent/:id/status
 *   GET    /agent/:jobId
 *   GET    /agent/:jobId/logs
 *   GET    /agent/:jobId/events
 *   GET    /transaction/:id
 *   GET    /health
 *
 * Compatibility:
 *   - intent.types.ts     : IntentRequest, IntentPlan, IntentExecution, IntentResult, IntentStatus
 *   - agent.types.ts      : AgentJob, AgentTask, AgentExecutionLog, AgentEvent, AgentSession, AgentResult
 *   - transaction.types.ts: TransactionRecord, TransactionStatus
 *
 * Design principles:
 *   - Every endpoint has an explicit Request type and one or more Response types.
 *   - All responses are wrapped in ApiResponse<T> for uniform shape.
 *   - Errors carry a typed ApiErrorCode for programmatic handling.
 *   - Pagination is standardised via PaginationMeta and PaginatedResponse<T>.
 *   - No `any`. No implicit `unknown`. Every field is documented.
 *
 * @module api.types
 */

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IntentStatus,
  IntentRequest,
  IntentPlan,
  IntentExecution,
  IntentResult,
  IntentRecord,
} from "./intent.types";

import type {
  AgentJob,
  AgentJobStatus,
  AgentTask,
  AgentExecutionLog,
  AnyAgentEvent,
  AgentResult,
  AgentSession,
} from "./agent.types";

import type {
  TransactionRecord,
  TransactionStatus,
  TransactionSignatureRequest,
} from "./transaction.types";

// ─────────────────────────────────────────────────────────────────────────────
// ApiErrorCode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exhaustive enumeration of machine-readable error codes.
 * The frontend switches on these codes for localised error messaging and UX logic.
 *
 * Ranges:
 *   AUTH_*        : Authentication / authorisation failures.
 *   VALIDATION_*  : Request body / param validation failures.
 *   INTENT_*      : Intent-domain business rule violations.
 *   AGENT_*       : Agent execution failures.
 *   TRANSACTION_* : On-chain transaction failures.
 *   RATE_LIMIT_*  : Throttling violations.
 *   SERVER_*      : Internal / infrastructure errors.
 *   NOT_FOUND_*   : Resource not found.
 */
export enum ApiErrorCode {
  // ── Auth ────────────────────────────────────────────────────────────────────
  /** No API key or Bearer token provided. */
  AUTH_MISSING_CREDENTIALS    = "AUTH_MISSING_CREDENTIALS",
  /** Provided credentials are invalid or expired. */
  AUTH_INVALID_CREDENTIALS    = "AUTH_INVALID_CREDENTIALS",
  /** Valid credentials but insufficient permissions for this resource. */
  AUTH_INSUFFICIENT_PERMISSION = "AUTH_INSUFFICIENT_PERMISSION",
  /** Wallet address in the request does not match the authenticated session. */
  AUTH_WALLET_MISMATCH        = "AUTH_WALLET_MISMATCH",

  // ── Validation ──────────────────────────────────────────────────────────────
  /** One or more required fields are missing from the request body. */
  VALIDATION_MISSING_FIELD    = "VALIDATION_MISSING_FIELD",
  /** A field value is present but fails type or format validation. */
  VALIDATION_INVALID_FIELD    = "VALIDATION_INVALID_FIELD",
  /** Wallet address is not a valid EVM address (checksummed or not). */
  VALIDATION_INVALID_ADDRESS  = "VALIDATION_INVALID_ADDRESS",
  /** Chain ID is not supported by this platform. */
  VALIDATION_UNSUPPORTED_CHAIN = "VALIDATION_UNSUPPORTED_CHAIN",
  /** Raw intent input is empty or below minimum length. */
  VALIDATION_EMPTY_INTENT     = "VALIDATION_EMPTY_INTENT",
  /** Raw intent input exceeds maximum allowed length. */
  VALIDATION_INTENT_TOO_LONG  = "VALIDATION_INTENT_TOO_LONG",

  // ── Not Found ───────────────────────────────────────────────────────────────
  /** Requested intent ID does not exist. */
  NOT_FOUND_INTENT            = "NOT_FOUND_INTENT",
  /** Requested agent job ID does not exist. */
  NOT_FOUND_AGENT_JOB         = "NOT_FOUND_AGENT_JOB",
  /** Requested transaction ID does not exist. */
  NOT_FOUND_TRANSACTION       = "NOT_FOUND_TRANSACTION",

  // ── Intent ──────────────────────────────────────────────────────────────────
  /** Intent parser could not produce a valid execution plan from the raw input. */
  INTENT_PARSE_FAILED         = "INTENT_PARSE_FAILED",
  /** Parser confidence score is below the minimum threshold for auto-execution. */
  INTENT_LOW_CONFIDENCE       = "INTENT_LOW_CONFIDENCE",
  /** Intent cannot be approved because it is not in the PARSED status. */
  INTENT_NOT_PARSEABLE        = "INTENT_NOT_PARSEABLE",
  /** Intent cannot be executed because it has not been approved. */
  INTENT_NOT_APPROVED         = "INTENT_NOT_APPROVED",
  /** Intent has already been executed (terminal state). */
  INTENT_ALREADY_EXECUTED     = "INTENT_ALREADY_EXECUTED",
  /** Intent has been cancelled and cannot transition further. */
  INTENT_CANCELLED            = "INTENT_CANCELLED",
  /** Approval attempted on an intent that is already approved. */
  INTENT_ALREADY_APPROVED     = "INTENT_ALREADY_APPROVED",

  // ── Agent ───────────────────────────────────────────────────────────────────
  /** No available agent worker to claim the job. */
  AGENT_NO_WORKER_AVAILABLE   = "AGENT_NO_WORKER_AVAILABLE",
  /** Agent job is in a state that does not allow the requested action. */
  AGENT_INVALID_JOB_STATE     = "AGENT_INVALID_JOB_STATE",
  /** Signature submitted to the agent does not match the pending request. */
  AGENT_SIGNATURE_MISMATCH    = "AGENT_SIGNATURE_MISMATCH",
  /** Agent job timed out waiting for a user signature. */
  AGENT_SIGNATURE_TIMEOUT     = "AGENT_SIGNATURE_TIMEOUT",
  /** Playwright session failed to initialise or crashed. */
  AGENT_BROWSER_ERROR         = "AGENT_BROWSER_ERROR",
  /** Agent execution failed at a specific task step. */
  AGENT_TASK_FAILED           = "AGENT_TASK_FAILED",

  // ── Transaction ─────────────────────────────────────────────────────────────
  /** Transaction simulation predicted a revert before signing. */
  TRANSACTION_SIMULATION_FAILED  = "TRANSACTION_SIMULATION_FAILED",
  /** User rejected the transaction in their wallet. */
  TRANSACTION_USER_REJECTED      = "TRANSACTION_USER_REJECTED",
  /** Submitted transaction was reverted on-chain. */
  TRANSACTION_REVERTED           = "TRANSACTION_REVERTED",
  /** Gas estimation failed for the transaction. */
  TRANSACTION_GAS_ESTIMATION_FAILED = "TRANSACTION_GAS_ESTIMATION_FAILED",
  /** Transaction confirmation timed out waiting for sufficient block confirmations. */
  TRANSACTION_CONFIRMATION_TIMEOUT = "TRANSACTION_CONFIRMATION_TIMEOUT",

  // ── Rate Limit ──────────────────────────────────────────────────────────────
  /** Too many requests from this IP or API key within the rate window. */
  RATE_LIMIT_EXCEEDED          = "RATE_LIMIT_EXCEEDED",
  /** Too many active intent executions for this wallet address. */
  RATE_LIMIT_CONCURRENT_INTENTS = "RATE_LIMIT_CONCURRENT_INTENTS",

  // ── Server ──────────────────────────────────────────────────────────────────
  /** Unhandled internal server error. */
  SERVER_INTERNAL_ERROR        = "SERVER_INTERNAL_ERROR",
  /** Upstream RPC provider or third-party API is unavailable. */
  SERVER_DEPENDENCY_UNAVAILABLE = "SERVER_DEPENDENCY_UNAVAILABLE",
  /** Feature is not yet implemented in this deployment. */
  SERVER_NOT_IMPLEMENTED       = "SERVER_NOT_IMPLEMENTED",
  /** Service is temporarily unavailable (maintenance, overload). */
  SERVER_SERVICE_UNAVAILABLE   = "SERVER_SERVICE_UNAVAILABLE",
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiError
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured error payload returned inside ApiResponse when success is false.
 * All error responses, regardless of HTTP status code, use this shape.
 */
export interface ApiError {
  /** Machine-readable error code for programmatic handling. */
  code: ApiErrorCode;

  /** Human-readable error message intended for developer logging. */
  message: string;

  /**
   * Human-readable message safe to display directly in the UI.
   * Null if message can be displayed as-is.
   */
  userMessage: string | null;

  /**
   * Field-level validation errors.
   * Populated only when code is VALIDATION_*.
   * Each key is the failing field path (dot-notation for nested fields).
   *
   * @example { "rawInput": "Must be at least 10 characters.", "chainId": "Unsupported chain." }
   */
  fieldErrors: Record<string, string> | null;

  /**
   * Technical error detail for debugging (stack trace fragment, upstream error message).
   * Never returned in production to end users.
   */
  detail: string | null;

  /**
   * Trace ID for correlating this error with backend logs.
   * Matches the X-Correlation-ID response header.
   */
  traceId: string;

  /**
   * ISO 8601 timestamp when the error occurred server-side.
   */
  timestamp: string;

  /**
   * Retry-After duration in seconds.
   * Populated only for RATE_LIMIT_* errors.
   * Null otherwise.
   */
  retryAfterSeconds: number | null;

  /**
   * Documentation URL for this error code.
   * @example "https://docs.nexora.xyz/errors/INTENT_PARSE_FAILED"
   */
  docsUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiResponse<T>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Universal envelope for every API response.
 *
 * Success shape:
 *   { success: true, data: T, error: null, meta: ResponseMeta }
 *
 * Error shape:
 *   { success: false, data: null, error: ApiError, meta: ResponseMeta }
 *
 * The discriminant field `success` allows the frontend client to safely
 * narrow the type without runtime instanceof checks.
 *
 * @template T - The payload type for a successful response.
 */
export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;

/**
 * Successful API response.
 */
export interface ApiSuccessResponse<T> {
  /** Always true for successful responses. */
  success: true;

  /** The response payload. */
  data: T;

  /** Always null on success. */
  error: null;

  /** Response metadata. */
  meta: ResponseMeta;
}

/**
 * Error API response.
 */
export interface ApiErrorResponse {
  /** Always false for error responses. */
  success: false;

  /** Always null on error. */
  data: null;

  /** Structured error payload. */
  error: ApiError;

  /** Response metadata. */
  meta: ResponseMeta;
}

/**
 * Metadata attached to every response regardless of success/failure.
 */
export interface ResponseMeta {
  /**
   * Correlation ID for distributed tracing.
   * Matches the X-Correlation-ID request/response header.
   */
  correlationId: string;

  /**
   * ISO 8601 timestamp of the server response.
   */
  timestamp: string;

  /**
   * API version string.
   * @example "v1"
   */
  apiVersion: string;

  /**
   * Server processing time in milliseconds.
   */
  processingMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PaginationMeta + PaginatedResponse<T>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pagination metadata included in list endpoint responses.
 */
export interface PaginationMeta {
  /** Current page number (1-indexed). */
  page: number;

  /** Number of items per page. */
  pageSize: number;

  /** Total number of items matching the query (across all pages). */
  totalItems: number;

  /** Total number of pages. Derived: Math.ceil(totalItems / pageSize). */
  totalPages: number;

  /** Whether there is a next page available. */
  hasNextPage: boolean;

  /** Whether there is a previous page available. */
  hasPreviousPage: boolean;
}

/**
 * Standardised paginated list payload.
 * Used as the `data` field inside ApiResponse<PaginatedResponse<T>>.
 *
 * @template T - Item type in the list.
 */
export interface PaginatedResponse<T> {
  /** The list of items for the current page. */
  items: T[];

  /** Pagination metadata. */
  pagination: PaginationMeta;
}

/**
 * Common query parameters for list endpoints.
 */
export interface PaginationQuery {
  /**
   * Page number to fetch (1-indexed).
   * @default 1
   */
  page?: number;

  /**
   * Number of items per page.
   * @default 20
   * @maximum 100
   */
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── INTENT ENDPOINTS ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /intent ─────────────────────────────────────────────────────────────

/**
 * Request body for POST /intent.
 *
 * Submits a raw user intent to the platform.
 * The backend will parse this into a structured IntentPlan.
 *
 * @endpoint POST /intent
 * @auth     Required (API key or wallet session)
 */
export interface PostIntentRequest {
  /**
   * Raw, natural-language intent expression from the user.
   *
   * @minLength 10
   * @maxLength 500
   * @example "Swap 100 USDC to ETH and stake it on Lido"
   */
  rawInput: string;

  /**
   * EVM wallet address of the initiating user.
   * Must be a valid checksummed or lowercase EVM address.
   */
  userAddress: `0x${string}`;

  /**
   * EVM chain ID the user is currently connected to.
   * Must be a chain ID supported by the platform.
   */
  sourceChainId: number;

  /**
   * Optional client-provided idempotency key.
   * If provided, duplicate submissions with the same key within 60 seconds
   * will return the original response instead of creating a new intent.
   */
  idempotencyKey?: string;

  /** Optional free-form metadata for client tracking. */
  metadata?: Record<string, unknown>;
}

/**
 * Response payload for POST /intent (success).
 *
 * Returns the created IntentRequest and, if parsing completed synchronously,
 * the generated IntentPlan. For async parsing, plan will be null.
 *
 * @endpoint POST /intent
 */
export interface PostIntentResponse {
  /** The created intent request record. */
  intent: IntentRequest;

  /**
   * The generated execution plan.
   * Null if parsing is async and not yet complete.
   */
  plan: IntentPlan | null;

  /**
   * Whether the plan was generated synchronously in this request.
   * If false, poll GET /intent/:id/status to await the plan.
   */
  planReady: boolean;

  /**
   * Estimated time in milliseconds before the plan will be ready.
   * Only meaningful when planReady is false.
   * Null if unknown.
   */
  estimatedPlanReadyMs: number | null;
}

// ── GET /intent/:id ────────────────────────────────────────────────────────────

/**
 * Path parameters for GET /intent/:id.
 */
export interface GetIntentByIdParams {
  /** The intent ID to retrieve. */
  id: string;
}

/**
 * Response payload for GET /intent/:id (success).
 * Returns the full intent record at its current lifecycle stage.
 *
 * @endpoint GET /intent/:id
 */
export interface GetIntentByIdResponse {
  /** The full intent record aggregating all lifecycle stages. */
  intent: IntentRecord;
}

// ── POST /intent/:id/approve ──────────────────────────────────────────────────

/**
 * Path parameters for POST /intent/:id/approve.
 */
export interface ApproveIntentParams {
  /** The intent ID to approve. */
  id: string;
}

/**
 * Request body for POST /intent/:id/approve.
 *
 * Called when the user reviews the generated plan and confirms execution.
 *
 * @endpoint POST /intent/:id/approve
 * @requires Intent must be in PARSED status.
 */
export interface ApproveIntentRequest {
  /**
   * Wallet address of the approving user.
   * Must match the userAddress on the original IntentRequest.
   */
  userAddress: `0x${string}`;

  /**
   * If the plan contains multiple variants, the user selects one here.
   * Null or omitted if only one plan variant exists.
   */
  selectedPlanVariantIndex?: number | null;

  /**
   * Optional override for the gas settings.
   * Null to use the platform-recommended settings.
   */
  gasOverride?: GasOverride | null;
}

/**
 * User-provided gas override for intent approval.
 */
export interface GasOverride {
  /**
   * Override maxFeePerGas (wei, decimal string).
   * Null to use estimated value.
   */
  maxFeePerGas: string | null;

  /**
   * Override maxPriorityFeePerGas (wei, decimal string).
   * Null to use estimated value.
   */
  maxPriorityFeePerGas: string | null;
}

/**
 * Response payload for POST /intent/:id/approve (success).
 *
 * @endpoint POST /intent/:id/approve
 */
export interface ApproveIntentResponse {
  /** The updated intent plan with status APPROVED. */
  plan: IntentPlan;

  /**
   * Whether auto-execution was triggered immediately after approval.
   * True when the platform policy allows it.
   */
  autoExecutionTriggered: boolean;

  /**
   * The agent job created by auto-execution.
   * Null if autoExecutionTriggered is false.
   */
  agentJob: AgentJob | null;
}

// ── POST /intent/:id/execute ─────────────────────────────────────────────────

/**
 * Path parameters for POST /intent/:id/execute.
 */
export interface ExecuteIntentParams {
  /** The intent ID to execute. */
  id: string;
}

/**
 * Request body for POST /intent/:id/execute.
 *
 * Explicitly triggers execution of an approved intent.
 * Required when auto-execution is disabled or was not triggered on approval.
 *
 * @endpoint POST /intent/:id/execute
 * @requires Intent must be in APPROVED status.
 */
export interface ExecuteIntentRequest {
  /**
   * Wallet address initiating execution.
   * Must match the intent's userAddress.
   */
  userAddress: `0x${string}`;

  /**
   * Execution mode.
   * - REAL : Execute on-chain against the live testnet/mainnet.
   * - DRY_RUN : Simulate execution without submitting any transactions.
   * - MOCK : Use mock executors for demo purposes.
   */
  executionMode: "REAL" | "DRY_RUN" | "MOCK";
}

/**
 * Response payload for POST /intent/:id/execute (success).
 *
 * @endpoint POST /intent/:id/execute
 */
export interface ExecuteIntentResponse {
  /**
   * The agent job created for this execution.
   * Use agentJob.id to poll agent status endpoints.
   */
  agentJob: AgentJob;

  /**
   * The agent session created for real-time event streaming.
   * Connect to the WebSocket/SSE endpoint using sessionId.
   */
  session: AgentSession;

  /**
   * WebSocket URL to connect to for real-time execution events.
   * @example "wss://api.nexora.xyz/ws/session/session_abc123"
   */
  wsUrl: string;

  /**
   * SSE URL as an alternative to WebSocket.
   * @example "https://api.nexora.xyz/sse/session/session_abc123"
   */
  sseUrl: string;
}

// ── GET /intent/:id/status ────────────────────────────────────────────────────

/**
 * Path parameters for GET /intent/:id/status.
 */
export interface GetIntentStatusParams {
  /** The intent ID to check status for. */
  id: string;
}

/**
 * Response payload for GET /intent/:id/status (success).
 *
 * Lightweight polling endpoint — returns only status fields, not the full record.
 * Use for polling loops before the WebSocket/SSE is connected.
 *
 * @endpoint GET /intent/:id/status
 */
export interface GetIntentStatusResponse {
  /** The intent ID. */
  intentId: string;

  /** Current intent lifecycle status. */
  intentStatus: IntentStatus;

  /**
   * Current agent job status.
   * Null if no agent job has been created yet.
   */
  agentJobStatus: AgentJobStatus | null;

  /**
   * Agent job ID.
   * Null if no job has been created.
   */
  agentJobId: string | null;

  /**
   * Index of the task currently executing.
   * Null if not yet executing.
   */
  currentTaskIndex: number | null;

  /** Total number of tasks in the plan. */
  totalTasks: number;

  /** Number of tasks completed so far. */
  completedTasks: number;

  /**
   * Human-readable status message for the UI activity feed.
   * @example "Swapping USDC for ETH on Uniswap V3..."
   */
  statusMessage: string | null;

  /**
   * Whether the intent has reached a terminal state.
   * Frontend polling loops should stop when this is true.
   */
  isTerminal: boolean;

  /** ISO 8601 timestamp of this status snapshot. */
  checkedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── AGENT ENDPOINTS ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /agent/:jobId ─────────────────────────────────────────────────────────

/**
 * Path parameters for GET /agent/:jobId.
 */
export interface GetAgentJobParams {
  /** The agent job ID to retrieve. */
  jobId: string;
}

/**
 * Response payload for GET /agent/:jobId (success).
 *
 * @endpoint GET /agent/:jobId
 */
export interface GetAgentJobResponse {
  /** The full agent job record. */
  job: AgentJob;

  /**
   * The agent result, if the job has reached a terminal state.
   * Null while still in progress.
   */
  result: AgentResult | null;

  /**
   * The active session for this job.
   * Null if the session has been closed.
   */
  session: AgentSession | null;
}

// ── GET /agent/:jobId/logs ─────────────────────────────────────────────────────

/**
 * Path parameters for GET /agent/:jobId/logs.
 */
export interface GetAgentJobLogsParams {
  /** The agent job ID. */
  jobId: string;
}

/**
 * Query parameters for GET /agent/:jobId/logs.
 */
export interface GetAgentJobLogsQuery extends PaginationQuery {
  /**
   * Filter logs by minimum severity level.
   * @example "WARN" returns WARN and ERROR logs only.
   */
  minLevel?: "DEBUG" | "INFO" | "WARN" | "ERROR";

  /**
   * Filter logs to a specific task.
   * Null or omitted to include all task logs and job-level logs.
   */
  taskId?: string;

  /**
   * Filter logs to a specific step index.
   * Null or omitted to include all steps.
   */
  stepIndex?: number;

  /**
   * Return only logs emitted after this ISO 8601 timestamp.
   * Used for incremental polling ("give me logs since I last checked").
   */
  after?: string;
}

/**
 * Response payload for GET /agent/:jobId/logs (success).
 *
 * @endpoint GET /agent/:jobId/logs
 */
export interface GetAgentJobLogsResponse extends PaginatedResponse<AgentExecutionLog> {
  /** The job ID these logs belong to. */
  jobId: string;

  /**
   * Sequence number of the latest log entry across the entire job.
   * Use as `after` cursor for the next poll to fetch only new entries.
   */
  latestSequence: number;
}

// ── GET /agent/:jobId/events ───────────────────────────────────────────────────

/**
 * Path parameters for GET /agent/:jobId/events.
 */
export interface GetAgentJobEventsParams {
  /** The agent job ID. */
  jobId: string;
}

/**
 * Query parameters for GET /agent/:jobId/events.
 */
export interface GetAgentJobEventsQuery extends PaginationQuery {
  /**
   * Return only events emitted after this ISO 8601 timestamp.
   */
  after?: string;

  /**
   * Filter events by type.
   * Omit to return all event types.
   */
  eventType?: string;
}

/**
 * Response payload for GET /agent/:jobId/events (success).
 *
 * Returns the persisted event history for a job.
 * For real-time delivery, connect to the WebSocket or SSE endpoint instead.
 *
 * @endpoint GET /agent/:jobId/events
 */
export interface GetAgentJobEventsResponse extends PaginatedResponse<AnyAgentEvent> {
  /** The job ID these events belong to. */
  jobId: string;

  /**
   * ISO 8601 timestamp of the most recently emitted event.
   * Use as `after` cursor for the next poll.
   */
  latestEventAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TRANSACTION ENDPOINTS ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /transaction/:id ─────────────────────────────────────────────────────

/**
 * Path parameters for GET /transaction/:id.
 */
export interface GetTransactionParams {
  /** The transaction ID to retrieve. */
  id: string;
}

/**
 * Response payload for GET /transaction/:id (success).
 *
 * @endpoint GET /transaction/:id
 */
export interface GetTransactionResponse {
  /** The full transaction record. */
  transaction: TransactionRecord;

  /**
   * Block explorer URL for this transaction.
   * Null until the transaction has been submitted to the mempool.
   */
  explorerUrl: string | null;
}

// ── GET /transaction (list) ───────────────────────────────────────────────────

/**
 * Query parameters for GET /transaction (list transactions for a job or intent).
 */
export interface ListTransactionsQuery extends PaginationQuery {
  /**
   * Filter transactions by agent job ID.
   * One of intentId or jobId must be provided.
   */
  jobId?: string;

  /**
   * Filter transactions by intent ID.
   * One of intentId or jobId must be provided.
   */
  intentId?: string;

  /**
   * Filter by transaction status.
   * Omit to return all statuses.
   */
  status?: TransactionStatus;
}

/**
 * Response payload for GET /transaction (list).
 *
 * @endpoint GET /transaction
 */
export interface ListTransactionsResponse extends PaginatedResponse<TransactionRecord> {
  /** Summary statistics for the result set. */
  summary: TransactionListSummary;
}

/**
 * Summary statistics for a list of transactions.
 */
export interface TransactionListSummary {
  /** Total number of confirmed transactions. */
  confirmed: number;

  /** Total number of failed transactions. */
  failed: number;

  /** Total number of reverted transactions. */
  reverted: number;

  /** Total number of pending (non-terminal) transactions. */
  pending: number;

  /**
   * Total gas cost across all confirmed transactions (ETH, decimal string).
   * "0" if no confirmed transactions exist.
   */
  totalGasCostEth: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── HEALTH ENDPOINT ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /health ───────────────────────────────────────────────────────────────

/**
 * Overall health status of the platform.
 */
export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

/**
 * Health status of an individual platform dependency.
 */
export interface DependencyHealth {
  /** Dependency name. @example "rpc_provider", "database", "playwright_pool" */
  name: string;

  /** Current health status. */
  status: HealthStatus;

  /**
   * Latest round-trip latency to this dependency in milliseconds.
   * Null if the check could not be completed.
   */
  latencyMs: number | null;

  /**
   * Additional details about the dependency state.
   * @example { activeConnections: 5, maxConnections: 20 }
   */
  detail?: Record<string, unknown>;

  /**
   * Error message if status is DEGRADED or UNHEALTHY.
   * Null if healthy.
   */
  error: string | null;
}

/**
 * Response payload for GET /health (success).
 *
 * Returned as ApiResponse<HealthCheckResponse>.
 * Note: A DEGRADED response is still HTTP 200; only UNHEALTHY returns HTTP 503.
 *
 * @endpoint GET /health
 */
export interface HealthCheckResponse {
  /** Aggregate health status of the platform. */
  status: HealthStatus;

  /**
   * Platform version string.
   * @example "1.0.0-hackathon"
   */
  version: string;

  /**
   * Server uptime in seconds.
   */
  uptimeSeconds: number;

  /**
   * ISO 8601 timestamp of this health check.
   */
  checkedAt: string;

  /**
   * Health status of each platform dependency.
   */
  dependencies: {
    /** Primary EVM RPC provider health. */
    rpcProvider: DependencyHealth;

    /** Backend database health. */
    database: DependencyHealth;

    /** Playwright browser pool health. */
    playwrightPool: DependencyHealth;

    /** Intent parser / LLM service health. */
    intentParser: DependencyHealth;

    /**
     * Any additional tracked dependencies.
     * @example { "price_feed": DependencyHealth }
     */
    [key: string]: DependencyHealth;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── WEBHOOK ENDPOINTS (Agent → Backend callbacks) ─────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Webhook payload sent by the Agent Engine to the Backend when a
 * transaction status changes (submitted, confirmed, reverted).
 *
 * @endpoint POST /webhook/tx (internal)
 */
export interface TxWebhookPayload {
  /** Webhook event type. */
  event: "TX_SUBMITTED" | "TX_CONFIRMED" | "TX_REVERTED" | "TX_FAILED";

  /** The updated transaction record. */
  transaction: TransactionRecord;

  /** Agent job ID that owns this transaction. */
  agentJobId: string;

  /** Intent ID that owns this agent job. */
  intentId: string;

  /** Correlation ID for tracing. */
  correlationId: string;

  /** ISO 8601 timestamp of the webhook emission. */
  timestamp: string;

  /**
   * HMAC-SHA256 signature over the payload body.
   * Used for webhook authenticity verification.
   */
  signature: string;
}

/**
 * Webhook payload sent by the Agent Engine to the Backend when a
 * signature is requested from the user.
 *
 * @endpoint POST /webhook/signature-request (internal)
 */
export interface SignatureWebhookPayload {
  /** Always "SIGNATURE_REQUESTED". */
  event: "SIGNATURE_REQUESTED";

  /** Agent job ID awaiting the signature. */
  agentJobId: string;

  /** Task ID that requires the signature. */
  taskId: string;

  /** Intent ID. */
  intentId: string;

  /** The transaction signature request payload to forward to the frontend. */
  signatureRequest: TransactionSignatureRequest;

  /** Correlation ID. */
  correlationId: string;

  /** ISO 8601 timestamp. */
  timestamp: string;

  /** HMAC-SHA256 signature. */
  signature: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── REALTIME (WebSocket / SSE) MESSAGE CONTRACTS ──────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base shape for all messages sent over the WebSocket or SSE channel.
 */
export interface RealtimeMessage<TEvent extends string = string, TData = unknown> {
  /** Message type discriminant. */
  type: TEvent;

  /** The session this message belongs to. */
  sessionId: string;

  /** Agent job ID. */
  jobId: string;

  /** Correlation ID. */
  correlationId: string;

  /** Message payload. */
  data: TData;

  /** ISO 8601 timestamp of emission. */
  timestamp: string;
}

/** Union of all possible realtime message types sent to the frontend. */
export type AnyRealtimeMessage =
  | RealtimeMessage<"AGENT_EVENT",         AnyAgentEvent>
  | RealtimeMessage<"SIGNATURE_REQUIRED",  TransactionSignatureRequest>
  | RealtimeMessage<"STATUS_UPDATE",       GetIntentStatusResponse>
  | RealtimeMessage<"HEARTBEAT",           { serverTime: string }>
  | RealtimeMessage<"SESSION_CLOSED",      { reason: string }>;

// ─────────────────────────────────────────────────────────────────────────────
// Typed endpoint map (for API client implementation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps every endpoint to its Request → Response pair.
 * Used by the typed API client (frontend/src/lib/api/client.ts) for
 * compile-time request/response type safety.
 *
 * @example
 * ```ts
 * async function call<E extends keyof ApiEndpointMap>(
 *   endpoint: E,
 *   request: ApiEndpointMap[E]["request"],
 * ): Promise<ApiResponse<ApiEndpointMap[E]["response"]>> { ... }
 * ```
 */
export interface ApiEndpointMap {
  "POST /intent": {
    request:  PostIntentRequest;
    response: PostIntentResponse;
  };
  "GET /intent/:id": {
    request:  GetIntentByIdParams;
    response: GetIntentByIdResponse;
  };
  "POST /intent/:id/approve": {
    request:  ApproveIntentRequest;
    response: ApproveIntentResponse;
  };
  "POST /intent/:id/execute": {
    request:  ExecuteIntentRequest;
    response: ExecuteIntentResponse;
  };
  "GET /intent/:id/status": {
    request:  GetIntentStatusParams;
    response: GetIntentStatusResponse;
  };
  "GET /agent/:jobId": {
    request:  GetAgentJobParams;
    response: GetAgentJobResponse;
  };
  "GET /agent/:jobId/logs": {
    request:  GetAgentJobLogsQuery & GetAgentJobLogsParams;
    response: GetAgentJobLogsResponse;
  };
  "GET /agent/:jobId/events": {
    request:  GetAgentJobEventsQuery & GetAgentJobEventsParams;
    response: GetAgentJobEventsResponse;
  };
  "GET /transaction/:id": {
    request:  GetTransactionParams;
    response: GetTransactionResponse;
  };
  "GET /health": {
    request:  Record<string, never>;
    response: HealthCheckResponse;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────────────────────

// ── Response narrowing ────────────────────────────────────────────────────────

/**
 * Narrows ApiResponse<T> to ApiSuccessResponse<T>.
 * Use inside `if (isApiSuccess(response))` for type-safe data access.
 */
export const isApiSuccess = <T>(
  response: ApiResponse<T>,
): response is ApiSuccessResponse<T> =>
  response.success === true;

/**
 * Narrows ApiResponse<T> to ApiErrorResponse.
 * Use inside `if (isApiError(response))` for type-safe error handling.
 */
export const isApiError = <T>(
  response: ApiResponse<T>,
): response is ApiErrorResponse =>
  response.success === false;

// ── Error code classification ─────────────────────────────────────────────────

/** Returns true if the error is an authentication or authorisation failure. */
export const isAuthError = (error: ApiError): boolean =>
  error.code.startsWith("AUTH_");

/** Returns true if the error is a request validation failure. */
export const isValidationError = (error: ApiError): boolean =>
  error.code.startsWith("VALIDATION_");

/** Returns true if the error is a rate-limiting failure. */
export const isRateLimitError = (error: ApiError): boolean =>
  error.code.startsWith("RATE_LIMIT_");

/** Returns true if the error is an internal server or infrastructure error. */
export const isServerError = (error: ApiError): boolean =>
  error.code.startsWith("SERVER_");

/** Returns true if the error is a not-found error. */
export const isNotFoundError = (error: ApiError): boolean =>
  error.code.startsWith("NOT_FOUND_");

/** Returns true if the error is an intent-domain business rule violation. */
export const isIntentError = (error: ApiError): boolean =>
  error.code.startsWith("INTENT_");

/** Returns true if the error is an agent execution failure. */
export const isAgentError = (error: ApiError): boolean =>
  error.code.startsWith("AGENT_");

/** Returns true if the error is a transaction-level failure. */
export const isTransactionError = (error: ApiError): boolean =>
  error.code.startsWith("TRANSACTION_");

/**
 * Returns true if the error is retryable by the client.
 * Rate-limit errors should be retried after retryAfterSeconds.
 * Server unavailability errors may be retried with exponential backoff.
 */
export const isRetryableError = (error: ApiError): boolean =>
  error.code === ApiErrorCode.RATE_LIMIT_EXCEEDED              ||
  error.code === ApiErrorCode.SERVER_SERVICE_UNAVAILABLE       ||
  error.code === ApiErrorCode.SERVER_DEPENDENCY_UNAVAILABLE    ||
  error.code === ApiErrorCode.TRANSACTION_CONFIRMATION_TIMEOUT ||
  error.code === ApiErrorCode.AGENT_NO_WORKER_AVAILABLE;

// ── Health guards ─────────────────────────────────────────────────────────────

/** Returns true if the platform health check reports a fully healthy system. */
export const isPlatformHealthy = (health: HealthCheckResponse): boolean =>
  health.status === "HEALTHY";

/** Returns true if the platform is operational but with degraded dependencies. */
export const isPlatformDegraded = (health: HealthCheckResponse): boolean =>
  health.status === "DEGRADED";

/** Returns true if the platform is unhealthy and should not accept requests. */
export const isPlatformUnhealthy = (health: HealthCheckResponse): boolean =>
  health.status === "UNHEALTHY";
