"use client";

/**
 * @file ConnectButton.tsx
 * @description Veritas-branded RainbowKit connect button wrapper.
 *
 * Provides three visual states:
 *   1. Not connected → "Connect Wallet" button
 *   2. Wrong network → "Switch Network" button
 *   3. Connected    → Address pill + chain badge + dropdown trigger
 *
 * Fully accessible and keyboard-navigable.
 * All click handlers are delegated to RainbowKit's internal openConnectModal
 * and openChainModal — no custom wallet logic needed.
 */

import React from "react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2, Wallet, ChevronDown, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Utility: address truncation
// ─────────────────────────────────────────────────────────────────────────────

function truncateAddress(address: string, leading = 6, trailing = 4): string {
  if (address.length <= leading + trailing) return address;
  return `${address.slice(0, leading)}…${address.slice(-trailing)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared button styles (inline — no Tailwind dependency for this component)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_BTN: React.CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  gap:            "8px",
  height:         "40px",
  padding:        "0 16px",
  borderRadius:   "10px",
  border:         "1px solid transparent",
  fontSize:       "13px",
  fontWeight:     600,
  cursor:         "pointer",
  transition:     "all 150ms ease",
  outline:        "none",
  userSelect:     "none",
  whiteSpace:     "nowrap",
  fontFamily:     "inherit",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ConnectCTA({ onClick }: { onClick: () => void }) {
  return (
    <button
      id="wallet-connect-button"
      onClick={onClick}
      style={{
        ...BASE_BTN,
        background:   "linear-gradient(135deg, #7C3AED, #6D28D9)",
        color:        "#FFFFFF",
        border:       "1px solid rgba(124,58,237,0.5)",
        boxShadow:    "0 0 16px rgba(124,58,237,0.3)",
      }}
      aria-label="Connect wallet"
    >
      <Wallet size={15} strokeWidth={2.2} />
      Connect Wallet
    </button>
  );
}

function WrongNetworkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      id="wallet-switch-network-button"
      onClick={onClick}
      style={{
        ...BASE_BTN,
        background: "#1E1E2E",
        color:      "#EF4444",
        border:     "1px solid rgba(239,68,68,0.4)",
      }}
      aria-label="Switch network"
    >
      <AlertTriangle size={15} strokeWidth={2.2} />
      Wrong Network
    </button>
  );
}

function ConnectedPill({
  address,
  ensName,
  ensAvatar,
  chainName,
  chainIconUrl,
  onChainClick,
  onAccountClick,
}: {
  address:        string;
  ensName?:       string;
  ensAvatar?:     string;
  chainName:      string;
  chainIconUrl?:  string;
  onChainClick:   () => void;
  onAccountClick: () => void;
}) {
  const displayName = ensName ?? truncateAddress(address);

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "6px" }}
      role="group"
      aria-label="Wallet info"
    >
      {/* Chain badge */}
      <button
        id="wallet-chain-button"
        onClick={onChainClick}
        style={{
          ...BASE_BTN,
          background: "#1E1E2E",
          color:      "#CBD5E1",
          border:     "1px solid #2A2A3E",
          padding:    "0 12px",
          gap:        "6px",
        }}
        aria-label={`Current chain: ${chainName}. Click to switch.`}
        title={chainName}
      >
        {chainIconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chainIconUrl}
            alt={chainName}
            width={16}
            height={16}
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <span
            style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "#7C3AED", display: "inline-block",
            }}
          />
        )}
        <span style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {chainName}
        </span>
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>

      {/* Account pill */}
      <button
        id="wallet-account-button"
        onClick={onAccountClick}
        style={{
          ...BASE_BTN,
          background: "#1E1E2E",
          color:      "#E2E8F0",
          border:     "1px solid #2A2A3E",
          padding:    "0 12px",
          gap:        "8px",
        }}
        aria-label={`Wallet: ${displayName}. Click to view account.`}
      >
        {/* Avatar */}
        {ensAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ensAvatar}
            alt="ENS avatar"
            width={18}
            height={18}
            style={{ borderRadius: "50%", flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
              display: "inline-block",
            }}
          />
        )}
        <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.01em" }}>
          {displayName}
        </span>
        <ChevronDown size={12} strokeWidth={2.5} style={{ color: "#64748B" }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectButton
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectButtonProps {
  /** If true, render a compact icon-only button when connected. */
  compact?: boolean;
}

/**
 * Veritas wallet connect button.
 * Renders contextually based on connection state using RainbowKit's render prop.
 *
 * @example
 * ```tsx
 * <ConnectButton />
 * <ConnectButton compact />
 * ```
 */
export function ConnectButton() {
  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready   = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account != null &&
          chain   != null &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!ready) {
          return (
            <button
              disabled
              style={{ ...BASE_BTN, background: "#1E1E2E", color: "#4B5563", border: "1px solid #2A2A3E" }}
              aria-busy="true"
            >
              <Loader2 size={15} strokeWidth={2.2} style={{ animation: "spin 1s linear infinite" }} />
              Connecting…
            </button>
          );
        }

        if (!connected) {
          return <ConnectCTA onClick={openConnectModal} />;
        }

        if (chain.unsupported) {
          return <WrongNetworkButton onClick={openChainModal} />;
        }

        return (
          <ConnectedPill
            address={account.address}
            ensName={account.ensName}
            ensAvatar={account.ensAvatar ?? undefined}
            chainName={chain.name ?? "Unknown Chain"}
            chainIconUrl={chain.iconUrl ?? undefined}
            onChainClick={openChainModal}
            onAccountClick={openAccountModal}
          />
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

export default ConnectButton;
