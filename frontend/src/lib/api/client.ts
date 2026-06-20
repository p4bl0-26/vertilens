/**
 * @file api/client.ts
 * @description Typed HTTP client for all Frontend → Backend API calls.
 *
 * Features:
 *  - Generic ApiResponse<T> unwrapping with type narrowing
 *  - Automatic correlation ID injection (X-Correlation-ID header)
 *  - API key auth (X-API-Key header)
 *  - Request timeout with AbortController
 *  - Retry with exponential backoff for retryable errors
 *  - Detailed error mapping to ApiError shape
 *  - Fully typed method signatures tied to ApiEndpointMap
 *
 * Compatible with:
 *  - api.types.ts   (ApiResponse, ApiError, ApiErrorCode, all endpoint types)
 */

import {
  type ApiResponse,
  type ApiError,
  type ApiErrorCode,
  type PostIntentRequest,
  type PostIntentResponse,
  type GetIntentByIdResponse,
  type ApproveIntentRequest,
  type ApproveIntentResponse,
  type ExecuteIntentRequest,
  type ExecuteIntentResponse,
  type GetIntentStatusResponse,
  type GetAgentJobResponse,
  type GetAgentJobLogsQuery,
  type GetAgentJobLogsResponse,
  type GetAgentJobEventsQuery,
  type GetAgentJobEventsResponse,
  type GetTransactionResponse,
  type ListTransactionsQuery,
  type ListTransactionsResponse,
  type HealthCheckResponse,
  isRetryableError,
} from "@nexora/shared-types/api.types";
// NOTE: @nexora/shared-types/* resolves via tsconfig paths → ../packages/shared-types/src/*

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_KEY    = process.env.NEXT_PUBLIC_API_KEY ?? "";
const API_VER    = "v1";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Correlation ID generator
// ─────────────────────────────────────────────────────────────────────────────

function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `fe-${crypto.randomUUID()}`;
  }
  return `fe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiClientError (throwable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown by the client when the server returns a non-success response.
 * Carries the full ApiError payload for programmatic handling.
 */
export class ApiClientError extends Error {
  public readonly apiError:    ApiError;
  public readonly httpStatus:  number;
  public readonly code:        ApiErrorCode;

  constructor(apiError: ApiError, httpStatus: number) {
    super(apiError.message);
    this.name       = "ApiClientError";
    this.apiError   = apiError;
    this.httpStatus = httpStatus;
    this.code       = apiError.code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface RequestOptions {
  method?:    "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?:      unknown;
  params?:    Record<string, string | number | boolean | undefined>;
  headers?:   Record<string, string>;
  timeoutMs?: number;
  retries?:   number;
}

async function request<T>(
  path:      string,
  options:   RequestOptions = {},
): Promise<T> {
  const {
    method    = "GET",
    body,
    params    = {},
    headers   = {},
    timeoutMs = TIMEOUT_MS,
    retries   = MAX_RETRIES,
  } = options;

  // Build URL with query params
  const url = new URL(`${BASE_URL}/${API_VER}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const correlationId = generateCorrelationId();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort("timeout"), timeoutMs);

  const init: RequestInit = {
    method,
    signal: controller.signal,
    headers: {
      "Content-Type":     "application/json",
      "Accept":           "application/json",
      "X-API-Key":        API_KEY,
      "X-Correlation-ID": correlationId,
      ...headers,
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), init);
      clearTimeout(timeoutId);

      // Parse body
      const contentType = res.headers.get("content-type") ?? "";
      const isJson      = contentType.includes("application/json");
      const rawBody     = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        // Try to extract a well-formed ApiError from the body
        const apiError: ApiError = isJson && rawBody?.error
          ? rawBody.error
          : {
              code:              "SERVER_INTERNAL_ERROR" as ApiErrorCode,
              message:           `HTTP ${res.status}: ${res.statusText}`,
              userMessage:       "An unexpected error occurred.",
              fieldErrors:       null,
              detail:            isJson ? JSON.stringify(rawBody) : String(rawBody),
              traceId:           correlationId,
              timestamp:         new Date().toISOString(),
              retryAfterSeconds: null,
              docsUrl:           null,
            };

        // Retry on retryable errors with backoff
        if (attempt < retries && isRetryableError(apiError)) {
          const delay = Math.min(1_000 * 2 ** attempt, 8_000);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new ApiClientError(apiError, res.status);
          continue;
        }

        throw new ApiClientError(apiError, res.status);
      }

      // Unwrap ApiResponse<T>
      const envelope = rawBody as ApiResponse<T>;
      if (!envelope.success) {
        throw new ApiClientError(envelope.error, res.status);
      }

      return envelope.data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ApiClientError) throw err;

      // Network / timeout errors
      if (attempt < retries) {
        const delay = Math.min(1_000 * 2 ** attempt, 8_000);
        await new Promise((r) => setTimeout(r, delay));
        lastError = err;
        continue;
      }

      const msg = err instanceof Error ? err.message : "Network error";
      throw new ApiClientError(
        {
          code:              "SERVER_DEPENDENCY_UNAVAILABLE" as ApiErrorCode,
          message:           msg,
          userMessage:       "Unable to reach the server. Check your connection.",
          fieldErrors:       null,
          detail:            null,
          traceId:           correlationId,
          timestamp:         new Date().toISOString(),
          retryAfterSeconds: null,
          docsUrl:           null,
        },
        0,
      );
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed API methods
// ─────────────────────────────────────────────────────────────────────────────

export const apiClient = {
  // ── Health ──────────────────────────────────────────────────────────────────

  /**
   * GET /health
   * Check platform health and dependency status.
   */
  getHealth(): Promise<HealthCheckResponse> {
    return request<HealthCheckResponse>("/health");
  },

  // ── Intent ──────────────────────────────────────────────────────────────────

  /**
   * POST /intent
   * Submit a raw user intent for parsing.
   */
  submitIntent(body: PostIntentRequest): Promise<PostIntentResponse> {
    return request<PostIntentResponse>("/intent", { method: "POST", body });
  },

  /**
   * GET /intent/:id
   * Retrieve the full intent record by ID.
   */
  getIntent(id: string): Promise<GetIntentByIdResponse> {
    return request<GetIntentByIdResponse>(`/intent/${encodeURIComponent(id)}`);
  },

  /**
   * POST /intent/:id/approve
   * Approve a parsed intent plan.
   */
  approveIntent(id: string, body: ApproveIntentRequest): Promise<ApproveIntentResponse> {
    return request<ApproveIntentResponse>(`/intent/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body,
    });
  },

  /**
   * POST /intent/:id/execute
   * Trigger execution of an approved intent.
   */
  executeIntent(id: string, body: ExecuteIntentRequest): Promise<ExecuteIntentResponse> {
    return request<ExecuteIntentResponse>(`/intent/${encodeURIComponent(id)}/execute`, {
      method: "POST",
      body,
    });
  },

  /**
   * GET /intent/:id/status
   * Lightweight status poll for the intent and its agent job.
   */
  getIntentStatus(id: string): Promise<GetIntentStatusResponse> {
    return request<GetIntentStatusResponse>(
      `/intent/${encodeURIComponent(id)}/status`,
    );
  },

  // ── Agent ────────────────────────────────────────────────────────────────────

  /**
   * GET /agent/:jobId
   * Retrieve the full agent job record and result.
   */
  getAgentJob(jobId: string): Promise<GetAgentJobResponse> {
    return request<GetAgentJobResponse>(`/agent/${encodeURIComponent(jobId)}`);
  },

  /**
   * GET /agent/:jobId/logs
   * Retrieve paginated execution logs for a job.
   */
  getAgentJobLogs(
    jobId:  string,
    query?: GetAgentJobLogsQuery,
  ): Promise<GetAgentJobLogsResponse> {
    return request<GetAgentJobLogsResponse>(
      `/agent/${encodeURIComponent(jobId)}/logs`,
      { params: query as Record<string, string | number | boolean | undefined> },
    );
  },

  /**
   * GET /agent/:jobId/events
   * Retrieve persisted agent events for a job (for history, not real-time).
   */
  getAgentJobEvents(
    jobId:  string,
    query?: GetAgentJobEventsQuery,
  ): Promise<GetAgentJobEventsResponse> {
    return request<GetAgentJobEventsResponse>(
      `/agent/${encodeURIComponent(jobId)}/events`,
      { params: query as Record<string, string | number | boolean | undefined> },
    );
  },

  // ── Transaction ──────────────────────────────────────────────────────────────

  /**
   * GET /transaction/:id
   * Retrieve the full transaction record by ID.
   */
  getTransaction(id: string): Promise<GetTransactionResponse> {
    return request<GetTransactionResponse>(
      `/transaction/${encodeURIComponent(id)}`,
    );
  },

  /**
   * GET /transaction
   * List transactions filtered by jobId or intentId.
   */
  listTransactions(query: ListTransactionsQuery): Promise<ListTransactionsResponse> {
    return request<ListTransactionsResponse>("/transaction", {
      params: query as Record<string, string | number | boolean | undefined>,
    });
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Type exports for consumers
// ─────────────────────────────────────────────────────────────────────────────

export type { ApiResponse, ApiError };
