"use client";

/**
 * @file useWallet.ts
 * @description Unified wallet state hook for the Nexora frontend.
 *
 * Aggregates account, chain, balance, and connection state from Wagmi
 * into a single, memoised object. Prevents individual components from
 * depending on multiple wagmi hooks separately.
 *
 * Features:
 *  - Typed return values
 *  - Chain validation against supported set
 *  - Disconnect helper
 *  - Formatted address + balance
 *  - ENS resolution
 */

import { useMemo, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useBalance,
  useDisconnect,
  useEnsName,
  useEnsAvatar,
  useSwitchChain,
} from "wagmi";
import { formatEther } from "viem";

import { isSupportedChain, getChainMeta, type SupportedChainId } from "@/config/chains.config";

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletState {
  // ── Connection ───────────────────────────────────────────────────────────────
  /** True if a wallet is connected and on a supported chain. */
  isConnected: boolean;
  /** True if wagmi is still determining the connection state (hydration). */
  isConnecting: boolean;
  /** True if the connected chain is not in the supported set. */
  isWrongChain: boolean;
  /** True if a disconnect is in progress. */
  isDisconnecting: boolean;

  // ── Account ──────────────────────────────────────────────────────────────────
  /** Raw EVM address. Undefined when not connected. */
  address: `0x${string}` | undefined;
  /** Checksummed EVM address. Undefined when not connected. */
  checksummedAddress: `0x${string}` | undefined;
  /** Truncated address for display. e.g. "0x1234…5678". Undefined when not connected. */
  shortAddress: string | undefined;

  // ── ENS ─────────────────────────────────────────────────────────────────────
  /** Resolved ENS name. Null if none. Undefined while loading. */
  ensName: string | null | undefined;
  /** Resolved ENS avatar URL. Null if none. Undefined while loading. */
  ensAvatar: string | null | undefined;
  /** Display name: ENS name if available, else shortAddress. */
  displayName: string | undefined;

  // ── Chain ─────────────────────────────────────────────────────────────────────
  /** Connected chain ID. */
  chainId: number | undefined;
  /** Whether the connected chain is supported. */
  isSupportedChain: boolean;
  /** Chain metadata object from chains.config.ts. */
  chainMeta: ReturnType<typeof getChainMeta>;

  // ── Balance ──────────────────────────────────────────────────────────────────
  /** Native balance in ETH (formatted string). "0.000" when not loaded. */
  nativeBalance: string;
  /** Raw native balance in wei (bigint). */
  nativeBalanceRaw: bigint | undefined;
  /** Native balance symbol. */
  nativeSymbol: string;
  /** True while the balance is being fetched. */
  isBalanceLoading: boolean;

  // ── Connector ─────────────────────────────────────────────────────────────────
  /** Connected wallet connector name. @example "MetaMask", "Coinbase Wallet" */
  connectorName: string | undefined;

  // ── Actions ──────────────────────────────────────────────────────────────────
  /** Disconnects the current wallet. */
  disconnect: () => void;
  /**
   * Switches to the specified chain ID.
   * No-op if already on that chain or switching is not supported.
   */
  switchToChain: (chainId: SupportedChainId) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function truncateAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified wallet hook.
 *
 * @example
 * ```tsx
 * const { address, chainId, isConnected, isWrongChain, disconnect } = useWallet();
 * ```
 */
export function useWallet(): WalletState {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const chainId   = useChainId();
  const { disconnectAsync, isPending: isDisconnecting }  = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  // ENS
  // wagmi useEnsName only supports mainnet (1) for ENS resolution
  // We cast to any because mainnet is currently commented out in chains.config.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ensName }   = useEnsName({ address, chainId: 1 as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined, chainId: 1 as any });

  // Balance
  const {
    data: balanceData,
    isLoading: isBalanceLoading,
  } = useBalance({
    address,
    query: { enabled: !!address },
  });

  // Derived
  const supported    = isSupportedChain(chainId);
  const chainMeta    = getChainMeta(chainId);
  const isWrongChain = isConnected && !supported;

  const shortAddress = address ? truncateAddress(address) : undefined;
  const displayName  = ensName ?? shortAddress;

  const nativeBalance    = balanceData ? parseFloat(formatEther(balanceData.value)).toFixed(4) : "0.0000";
  const nativeBalanceRaw = balanceData?.value;
  const nativeSymbol     = balanceData?.symbol ?? chainMeta?.nativeCurrency ?? "ETH";

  const disconnect = useCallback(async () => {
    await disconnectAsync();
  }, [disconnectAsync]);

  const switchToChain = useCallback(
    async (targetChainId: SupportedChainId) => {
      if (chainId === targetChainId) return;
      await switchChainAsync({ chainId: targetChainId });
    },
    [chainId, switchChainAsync],
  );

  return useMemo<WalletState>(
    () => ({
      // Connection
      isConnected:     isConnected && supported,
      isConnecting,
      isWrongChain,
      isDisconnecting,

      // Account
      address,
      checksummedAddress: address,
      shortAddress,

      // ENS
      ensName,
      ensAvatar,
      displayName,

      // Chain
      chainId,
      isSupportedChain: supported,
      chainMeta,

      // Balance
      nativeBalance,
      nativeBalanceRaw,
      nativeSymbol,
      isBalanceLoading,

      // Connector
      connectorName: connector?.name,

      // Actions
      disconnect,
      switchToChain,
    }),
    [
      isConnected, supported, isConnecting, isWrongChain, isDisconnecting,
      address, shortAddress, ensName, ensAvatar, displayName,
      chainId, chainMeta,
      nativeBalance, nativeBalanceRaw, nativeSymbol, isBalanceLoading,
      connector,
      disconnect, switchToChain,
    ],
  );
}
