"use client";

/**
 * @file QueryProvider.tsx
 * @description TanStack Query v5 provider with platform-optimised defaults.
 *
 * Configures:
 *  - Stale times appropriate for on-chain data (short) vs. intent data (longer)
 *  - Retry logic that avoids hammering RPCs on known error types
 *  - DevTools in development only
 */

import React, { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// ─────────────────────────────────────────────────────────────────────────────
// QueryClient factory
// ─────────────────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * 30 seconds stale time for most queries.
         * On-chain data hooks should override this to a shorter window.
         */
        staleTime:            30 * 1_000,
        /**
         * Keep unused query data in cache for 5 minutes.
         */
        gcTime:               5 * 60 * 1_000,
        /**
         * Retry failed queries up to 2 times.
         * Avoids retrying on 4xx errors (auth, not-found) — only on network/5xx.
         */
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          // Don't retry client errors
          if (error instanceof Error && "status" in error) {
            const status = (error as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return true;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
        /**
         * Re-fetch on window focus for near-real-time feel.
         * Disable for queries that are already subscribed to via WebSocket.
         */
        refetchOnWindowFocus:        true,
        refetchOnReconnect:          true,
        refetchOnMount:              true,
      },
      mutations: {
        /** Mutations are not retried by default — user-initiated actions should be explicit. */
        retry: false,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SSR-safe singleton pattern (per Next.js 15 docs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Browser-side singleton. A new QueryClient is created once per page load
 * and reused across all React renders to preserve cache state.
 */
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  if (isServer) {
    // Server: always create a new QueryClient per request
    return makeQueryClient();
  }
  // Browser: reuse the singleton, or create it if first load
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// QueryProvider component
// ─────────────────────────────────────────────────────────────────────────────

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * TanStack Query provider.
 * Must be rendered above any component that uses useQuery / useMutation.
 * Placed inside AppProviders.tsx — do not add directly to layout.tsx.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  /**
   * useState ensures the QueryClient is not re-created on every render
   * in the client component boundary.
   */
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}
