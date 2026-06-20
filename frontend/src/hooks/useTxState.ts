"use client";

/**
 * @file useTxState.ts
 * @description Transaction state machine hook for intent-driven executions.
 *
 * Models the complete frontend transaction lifecycle:
 *
 *   IDLE → SIMULATING → AWAITING_SIGNATURE → SUBMITTING →
 *   CONFIRMING → CONFIRMED | FAILED | REVERTED
 *
 * Designed to drive TxButton.tsx and TxStatus.tsx components.
 * Integrates with useToast for automatic user feedback at each stage.
 */

import React, { useCallback, useReducer, useRef } from "react";
import type { Hash, TransactionReceipt } from "viem";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Inline status enum (mirrors transaction.types.ts — avoids path-alias issues)
// ─────────────────────────────────────────────────────────────────────────────

export enum TxStateStatus {
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
// State shape
// ─────────────────────────────────────────────────────────────────────────────

export interface TxState {
  /** Current lifecycle status. */
  status: TxStateStatus;
  /** Transaction hash (available after SUBMITTED). */
  txHash: Hash | undefined;
  /** On-chain receipt (available after CONFIRMED). */
  receipt: TransactionReceipt | undefined;
  /** Normalised error message. Null when not in an error state. */
  error: string | null;
  /** Number of block confirmations received so far. */
  confirmations: number;
  /** Whether any async operation is in progress. */
  isLoading: boolean;
}

const INITIAL_STATE: TxState = {
  status:        TxStateStatus.CREATED,
  txHash:        undefined,
  receipt:       undefined,
  error:         null,
  confirmations: 0,
  isLoading:     false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Action types
// ─────────────────────────────────────────────────────────────────────────────

type TxAction =
  | { type: "SIMULATE_START" }
  | { type: "SIMULATE_SUCCESS" }
  | { type: "SIMULATE_FAIL";  error: string }
  | { type: "AWAIT_SIGNATURE" }
  | { type: "SIGNING_REJECTED" }
  | { type: "SUBMITTED";      txHash: Hash }
  | { type: "CONFIRMATION";   count: number }
  | { type: "CONFIRMED";      receipt: TransactionReceipt }
  | { type: "FAILED";         error: string }
  | { type: "REVERTED";       error: string }
  | { type: "RESET" };

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function txReducer(state: TxState, action: TxAction): TxState {
  switch (action.type) {
    case "SIMULATE_START":
      return { ...INITIAL_STATE, status: TxStateStatus.SIMULATED, isLoading: true };

    case "SIMULATE_SUCCESS":
      return { ...state, status: TxStateStatus.SIMULATED, isLoading: false };

    case "SIMULATE_FAIL":
      return { ...state, status: TxStateStatus.FAILED, error: action.error, isLoading: false };

    case "AWAIT_SIGNATURE":
      return { ...state, status: TxStateStatus.SIGNATURE_PENDING, isLoading: true };

    case "SIGNING_REJECTED":
      return {
        ...state,
        status:    TxStateStatus.FAILED,
        error:     "Transaction rejected by user.",
        isLoading: false,
      };

    case "SUBMITTED":
      return {
        ...state,
        txHash:    action.txHash,
        status:    TxStateStatus.CONFIRMING,
        isLoading: true,
      };

    case "CONFIRMATION":
      return { ...state, confirmations: action.count };

    case "CONFIRMED":
      return {
        ...state,
        status:    TxStateStatus.CONFIRMED,
        receipt:   action.receipt,
        isLoading: false,
      };

    case "FAILED":
      return { ...state, status: TxStateStatus.FAILED, error: action.error, isLoading: false };

    case "REVERTED":
      return { ...state, status: TxStateStatus.REVERTED, error: action.error, isLoading: false };

    case "RESET":
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTxStateReturn {
  /** Current transaction state. */
  txState: TxState;

  /** Raw dispatch — use convenience helpers below instead where possible. */
  dispatch: React.Dispatch<TxAction>;

  // ── Derived booleans ──────────────────────────────────────────────────────

  isIdle:              boolean;
  isSimulating:        boolean;
  isAwaitingSignature: boolean;
  isSubmitting:        boolean;
  isConfirming:        boolean;
  isConfirmed:         boolean;
  isFailed:            boolean;
  isReverted:          boolean;
  isTerminal:          boolean;
  isLoading:           boolean;

  // ── Convenience dispatchers ───────────────────────────────────────────────

  startSimulation:   () => void;
  simulationSuccess: () => void;
  simulationFailed:  (error: string) => void;
  awaitSignature:    () => void;
  signatureRejected: () => void;
  submitted:         (txHash: Hash) => void;
  confirmationTick:  (count: number) => void;
  confirmed:         (receipt: TransactionReceipt) => void;
  failed:            (error: string) => void;
  reverted:          (error: string) => void;
  reset:             () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

interface UseTxStateOptions {
  /** Chain ID — used to build explorer URLs in toasts. */
  chainId?:     number;
  /**
   * If true, automatic toasts fire at each lifecycle stage.
   * @default true
   */
  showToasts?:  boolean;
  /**
   * Label for the action shown in toasts.
   * @default "Transaction"
   */
  actionLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transaction state machine for intent-driven flows.
 *
 * @example
 * ```tsx
 * const {
 *   txState, submitted, confirmed, failed, isLoading,
 * } = useTxState({ chainId: 11155111, actionLabel: "Swap" });
 * ```
 */
export function useTxState({
  chainId,
  showToasts  = true,
  actionLabel = "Transaction",
}: UseTxStateOptions = {}): UseTxStateReturn {
  const [txState, dispatch] = useReducer(txReducer, INITIAL_STATE);
  const toastIdRef          = useRef<string | number>("");

  // ── Convenience dispatchers ───────────────────────────────────────────────

  const startSimulation = useCallback(() => {
    dispatch({ type: "SIMULATE_START" });
    if (showToasts) {
      toastIdRef.current = toast.loading(actionLabel, {
        description: "Simulating transaction…",
      });
    }
  }, [showToasts, actionLabel]);

  const simulationSuccess = useCallback(() => {
    dispatch({ type: "SIMULATE_SUCCESS" });
    if (showToasts) toast.dismiss(toastIdRef.current);
  }, [showToasts]);

  const simulationFailed = useCallback((error: string) => {
    dispatch({ type: "SIMULATE_FAIL", error });
    if (showToasts) {
      toast.dismiss(toastIdRef.current);
      toast.error("Simulation failed", { description: error });
    }
  }, [showToasts]);

  const awaitSignature = useCallback(() => {
    dispatch({ type: "AWAIT_SIGNATURE" });
    if (showToasts) {
      toastIdRef.current = toast.loading(actionLabel, {
        description: "Waiting for wallet signature…",
      });
    }
  }, [showToasts, actionLabel]);

  const signatureRejected = useCallback(() => {
    dispatch({ type: "SIGNING_REJECTED" });
    if (showToasts) {
      toast.dismiss(toastIdRef.current);
      toast.error("Rejected", { description: "You rejected the transaction." });
    }
  }, [showToasts]);

  const submitted = useCallback((txHash: Hash) => {
    dispatch({ type: "SUBMITTED", txHash });
    if (showToasts) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = toast.loading(`${actionLabel} submitted`, {
        description: "Waiting for block confirmation…",
      });
    }
  }, [showToasts, actionLabel, chainId]);

  const confirmationTick = useCallback((count: number) => {
    dispatch({ type: "CONFIRMATION", count });
  }, []);

  const confirmed = useCallback((receipt: TransactionReceipt) => {
    dispatch({ type: "CONFIRMED", receipt });
    if (showToasts) {
      toast.dismiss(toastIdRef.current);
      toast.success(`${actionLabel} confirmed`, {
        description: "Transaction included in a block.",
      });
    }
  }, [showToasts, actionLabel, chainId]);

  const failed = useCallback((error: string) => {
    dispatch({ type: "FAILED", error });
    if (showToasts) {
      toast.dismiss(toastIdRef.current);
      toast.error(`${actionLabel} failed`, { description: error });
    }
  }, [showToasts, actionLabel]);

  const reverted = useCallback((error: string) => {
    dispatch({ type: "REVERTED", error });
    if (showToasts) {
      toast.dismiss(toastIdRef.current);
      toast.error(`${actionLabel} reverted`, { description: error });
    }
  }, [showToasts, actionLabel]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    toast.dismiss(toastIdRef.current);
  }, [toast]);

  // ── Derived booleans ──────────────────────────────────────────────────────

  const s = txState.status;

  return {
    txState,
    dispatch,

    isIdle:              s === TxStateStatus.CREATED,
    isSimulating:        s === TxStateStatus.SIMULATED && txState.isLoading,
    isAwaitingSignature: s === TxStateStatus.SIGNATURE_PENDING,
    isSubmitting:        s === TxStateStatus.SUBMITTED,
    isConfirming:        s === TxStateStatus.CONFIRMING,
    isConfirmed:         s === TxStateStatus.CONFIRMED,
    isFailed:            s === TxStateStatus.FAILED,
    isReverted:          s === TxStateStatus.REVERTED,
    isTerminal:
      s === TxStateStatus.CONFIRMED ||
      s === TxStateStatus.FAILED    ||
      s === TxStateStatus.REVERTED,
    isLoading: txState.isLoading,

    startSimulation,
    simulationSuccess,
    simulationFailed,
    awaitSignature,
    signatureRejected,
    submitted,
    confirmationTick,
    confirmed,
    failed,
    reverted,
    reset,
  };
}
