"use client";

/**
 * @file useContractWrite.ts
 * @description Typed contract write hook wrapping wagmi's useWriteContract
 *              and useWaitForTransactionReceipt.
 *
 * Provides a single async `execute()` function that:
 *   1. Sends the transaction via the connected wallet.
 *   2. Waits for the specified number of confirmations.
 *   3. Returns the receipt.
 *   4. Surfaces granular status at each stage.
 *
 * Integrates with TransactionStatus from transaction.types.ts for
 * consistent status language across frontend and backend.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type {
  Abi,
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  Hash,
  TransactionReceipt,
} from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// TransactionStatus — inline enum so the hook has no path-alias dependency.
// Mirror values from transaction.types.ts.
// ─────────────────────────────────────────────────────────────────────────────

export enum TxWriteStatus {
  IDLE              = "CREATED",
  SIGNATURE_PENDING = "SIGNATURE_PENDING",
  SUBMITTED         = "SUBMITTED",
  CONFIRMING        = "CONFIRMING",
  CONFIRMED         = "CONFIRMED",
  FAILED            = "FAILED",
  REVERTED          = "REVERTED",
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseContractWriteConfig<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
> {
  /** Contract ABI. Use `as const` for full type inference. */
  abi:           TAbi;
  /** Contract address. */
  address:       Address;
  /** ABI function name to call. */
  functionName:  TFunctionName;
  /**
   * Number of block confirmations to wait for before resolving.
   * @default 1
   */
  confirmations?: number;
  /** Callback fired when the transaction hash is available (mempool). */
  onSubmitted?:  (hash: Hash) => void;
  /** Callback fired when the transaction is confirmed on-chain. */
  onConfirmed?:  (receipt: TransactionReceipt) => void;
  /** Callback fired on any error (signing rejection, revert, etc.). */
  onError?:      (error: Error) => void;
}

export interface UseContractWriteResult<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
> {
  /**
   * Execute the contract write.
   * Resolves with the on-chain receipt after `confirmations` blocks.
   * Throws on error.
   */
  execute: (
    args?:      ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>,
    overrides?: { value?: bigint },
  ) => Promise<TransactionReceipt>;

  /** Semantic transaction status. */
  status: TxWriteStatus;

  /** True while waiting for the user to sign in their wallet. */
  isSignaturePending: boolean;
  /** True after submission, while awaiting block confirmation. */
  isConfirming: boolean;
  /** True once confirmed on-chain. */
  isConfirmed: boolean;
  /** True in any error state. */
  isError: boolean;
  /** True while any async operation is in progress. */
  isLoading: boolean;

  /** Transaction hash. Undefined before submission. */
  txHash:  Hash | undefined;
  /** On-chain receipt. Undefined before confirmation. */
  receipt: TransactionReceipt | undefined;
  /** Normalised error message. Null when not in error state. */
  error:   string | null;

  /** Reset all state back to IDLE. */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error normalisation
// ─────────────────────────────────────────────────────────────────────────────

function normaliseError(err: unknown): string {
  if (!err) return "Unknown error";
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("User rejected") || msg.includes("user rejected"))
    return "Transaction rejected by user.";
  if (msg.includes("insufficient funds"))
    return "Insufficient funds for gas.";
  const revertMatch = msg.match(/reverted with reason string '(.+?)'/);
  if (revertMatch) return `Contract reverted: ${revertMatch[1]}`;
  const customErrMatch = msg.match(/reverted with custom error '(.+?)'/);
  if (customErrMatch) return `Contract error: ${customErrMatch[1]}`;
  return msg.split("\n")[0] ?? "Transaction failed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed contract write with granular status tracking and callbacks.
 *
 * @example
 * ```tsx
 * const { execute, status, txHash, isLoading, error } = useContractWrite({
 *   abi:           vaultAbi,
 *   address:       "0x...",
 *   functionName:  "deposit",
 *   confirmations: 1,
 *   onConfirmed:   (receipt) => toast.success("Deposit confirmed!"),
 * });
 *
 * await execute([parseUnits("100", 6)]);
 * ```
 */
export function useContractWrite<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
>({
  abi,
  address,
  functionName,
  confirmations = 1,
  onSubmitted,
  onConfirmed,
  onError,
}: UseContractWriteConfig<TAbi, TFunctionName>): UseContractWriteResult<TAbi, TFunctionName> {
  const [status,   setStatus]   = useState<TxWriteStatus>(TxWriteStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash,   setTxHash]   = useState<Hash | undefined>(undefined);

  // Keep a ref to resolve/reject the promise returned from execute()
  const promiseRef = useRef<{
    resolve: (r: TransactionReceipt) => void;
    reject:  (e: unknown) => void;
  } | null>(null);

  const {
    writeContractAsync,
    isPending: isWritePending,
    reset:     resetWrite,
  } = useWriteContract();

  const {
    data:      receipt,
    isLoading: isWaiting,
    isSuccess: isReceiptConfirmed,
    isError:   isReceiptError,
    error:     receiptError,
  } = useWaitForTransactionReceipt({
    hash:          txHash,
    confirmations,
    query: { enabled: !!txHash },
  });

  // Resolve the promise when receipt arrives
  useEffect(() => {
    if (isReceiptConfirmed && receipt) {
      setStatus(TxWriteStatus.CONFIRMED);
      onConfirmed?.(receipt);
      promiseRef.current?.resolve(receipt);
      promiseRef.current = null;
    }
  }, [isReceiptConfirmed, receipt, onConfirmed]);

  // Reject the promise on receipt error
  useEffect(() => {
    if (isReceiptError && receiptError) {
      const msg = normaliseError(receiptError);
      setErrorMsg(msg);
      setStatus(TxWriteStatus.FAILED);
      const err = receiptError instanceof Error ? receiptError : new Error(msg);
      onError?.(err);
      promiseRef.current?.reject(err);
      promiseRef.current = null;
    }
  }, [isReceiptError, receiptError, onError]);

  const execute = useCallback(
    (
      args?:      ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>,
      overrides?: { value?: bigint },
    ): Promise<TransactionReceipt> => {
      setErrorMsg(null);
      setStatus(TxWriteStatus.SIGNATURE_PENDING);

      // Return a promise that resolves/rejects via the useEffect above
      const p = new Promise<TransactionReceipt>((resolve, reject) => {
        promiseRef.current = { resolve, reject };
      });

      writeContractAsync({
        abi,
        address,
        functionName,
        args:  (args ?? []) as ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>,
        value: overrides?.value,
      } as Parameters<typeof writeContractAsync>[0])
        .then((hash) => {
          setTxHash(hash);
          setStatus(TxWriteStatus.SUBMITTED);
          onSubmitted?.(hash);
          // status moves to CONFIRMING via the useEffect once wagmi starts polling
        })
        .catch((err: unknown) => {
          const msg = normaliseError(err);
          setErrorMsg(msg);
          const isRejected = msg.includes("rejected") || msg.includes("denied");
          setStatus(isRejected ? TxWriteStatus.FAILED : TxWriteStatus.REVERTED);
          const normErr = err instanceof Error ? err : new Error(msg);
          onError?.(normErr);
          promiseRef.current?.reject(normErr);
          promiseRef.current = null;
        });

      return p;
    },
    [writeContractAsync, abi, address, functionName, onSubmitted, onError],
  );

  // Advance to CONFIRMING once wagmi starts waiting for the receipt
  useEffect(() => {
    if (isWaiting && txHash) {
      setStatus(TxWriteStatus.CONFIRMING);
    }
  }, [isWaiting, txHash]);

  const reset = useCallback(() => {
    setStatus(TxWriteStatus.IDLE);
    setErrorMsg(null);
    setTxHash(undefined);
    promiseRef.current = null;
    resetWrite();
  }, [resetWrite]);

  const isSignaturePending = status === TxWriteStatus.SIGNATURE_PENDING || isWritePending;
  const isConfirming       = status === TxWriteStatus.CONFIRMING;
  const isConfirmed        = status === TxWriteStatus.CONFIRMED;
  const isError            = status === TxWriteStatus.FAILED || status === TxWriteStatus.REVERTED;
  const isLoading          = isSignaturePending || status === TxWriteStatus.SUBMITTED || isConfirming;

  return {
    execute,
    status,
    isSignaturePending,
    isConfirming,
    isConfirmed,
    isError,
    isLoading,
    txHash,
    receipt,
    error: errorMsg,
    reset,
  };
}
