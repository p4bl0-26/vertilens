"use client";

/**
 * @file useContractRead.ts
 * @description Typed contract read hook wrapping wagmi's useReadContract.
 *
 * Adds:
 *  - Generic return type inference
 *  - Chain guard (prevents reads on unsupported chains)
 *  - Automatic polling control
 *  - Error normalisation
 *  - Convenience selector pattern
 */

import { useMemo } from "react";
import { useReadContract, type UseReadContractParameters } from "wagmi";
import type { Abi, Address, ContractFunctionArgs, ContractFunctionName } from "viem";

import { isSupportedChain } from "@/config/chains.config";
import { useWallet }         from "./useWallet";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type UseContractReadConfig<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
  TSelectData = unknown,
> = Omit<
    UseReadContractParameters<TAbi, TFunctionName>,
    "address" | "abi" | "functionName" | "query"
  > & {
  /** Contract ABI. Use `as const` for full type inference. */
  abi:          TAbi;
  /** Contract address on the connected chain. */
  address:      Address | undefined;
  /** ABI function name to call. */
  functionName: TFunctionName;
  /** Optional function arguments. */
  args?:        ContractFunctionArgs<TAbi, "pure" | "view", TFunctionName>;
  /**
   * Optional selector to transform raw contract output.
   * @example select: (raw) => formatEther(raw as bigint)
   */
  select?:      (data: unknown) => TSelectData;
  /**
   * Polling interval in milliseconds.
   * Defaults to 0 (no polling). Set to e.g. 12_000 for per-block polling.
   */
  pollingInterval?: number;
  /**
   * Whether to skip the read if the chain is unsupported.
   * Defaults to true (safe default).
   */
  requireSupportedChain?: boolean;
  /** React Query configuration overrides. */
  query?: { enabled?: boolean; [key: string]: unknown };
};

export interface UseContractReadResult<TData> {
  /** Transformed (or raw) contract return value. */
  data:        TData | undefined;
  /** True while the call is in flight. */
  isLoading:   boolean;
  /** True after at least one successful fetch. */
  isSuccess:   boolean;
  /** True if the call failed. */
  isError:     boolean;
  /** Normalised error message. Null on success. */
  error:       string | null;
  /** Manually trigger a refetch. */
  refetch:     () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed contract read with chain guard, polling support, and selector pattern.
 *
 * @example
 * ```ts
 * const { data: balance } = useContractRead({
 *   abi:          erc20Abi,
 *   address:      "0x...",
 *   functionName: "balanceOf",
 *   args:         [userAddress],
 *   select:       (raw) => formatEther(raw as bigint),
 *   pollingInterval: 12_000,
 * });
 * ```
 */
export function useContractRead<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
  TSelectData = unknown,
>({
  abi,
  address,
  functionName,
  args,
  select,
  pollingInterval       = 0,
  requireSupportedChain = true,
  query,
  ...rest
}: UseContractReadConfig<TAbi, TFunctionName, TSelectData>): UseContractReadResult<TSelectData> {
  const { chainId, isConnected } = useWallet();

  const chainGuardPassed =
    !requireSupportedChain ||
    (isConnected && chainId != null && isSupportedChain(chainId));

  const enabled =
    chainGuardPassed &&
    !!address &&
    (query?.enabled !== false);

  const {
    data: rawData,
    isLoading,
    isSuccess,
    isError,
    error: wagmiError,
    refetch,
  } = useReadContract({
    abi,
    address,
    functionName,
    args,
    ...rest,
    query: {
      ...query,
      enabled,
      refetchInterval: pollingInterval > 0 ? pollingInterval : false,
      // Cast needed: wagmi's select expects the concrete return type, not unknown
      select: select as ((data: unknown) => TSelectData) | undefined,
    },
  } as UseReadContractParameters<TAbi, TFunctionName>);

  const error = useMemo<string | null>(() => {
    if (!wagmiError) return null;
    const msg = wagmiError.message ?? String(wagmiError);
    const revertMatch = msg.match(/reverted with reason string '(.+?)'/);
    if (revertMatch) return revertMatch[1]!;
    return msg.split("\n")[0] ?? "Contract read failed";
  }, [wagmiError]);

  return {
    data:      rawData as TSelectData | undefined,
    isLoading: isLoading && enabled,
    isSuccess,
    isError,
    error,
    refetch,
  };
}
