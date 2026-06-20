/**
 * @file rainbowkit.config.ts
 * @description RainbowKit v2 theme, app info, and wallet list configuration.
 *
 * Pure TypeScript — no JSX. All React component helpers live in .tsx files.
 * Centralises all RainbowKit customisation so AppProviders.tsx stays clean.
 */

import {
  darkTheme,
  lightTheme,
  type Theme,
  getDefaultWallets,
} from "@rainbow-me/rainbowkit";
import {
  argentWallet,
  trustWallet,
  ledgerWallet,
  rabbyWallet,
  safeWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";

// ─────────────────────────────────────────────────────────────────────────────
// App info (shown inside the RainbowKit connect modal)
// ─────────────────────────────────────────────────────────────────────────────

export const RAINBOWKIT_APP_INFO = {
  appName:        (process.env["NEXT_PUBLIC_APP_NAME"])        ?? "Nexora",
  projectId:      (process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]) ?? "",
  appDescription: (process.env["NEXT_PUBLIC_APP_DESC"])        ?? "Intent-Centric Web3 Execution",
  appUrl:         (process.env["NEXT_PUBLIC_APP_URL"])         ?? "https://nexora.xyz",
  appIcon:        `${(process.env["NEXT_PUBLIC_APP_URL"])      ?? ""}/logo.svg`,
  learnMoreUrl:   "https://docs.nexora.xyz",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Custom dark theme
// ─────────────────────────────────────────────────────────────────────────────

const _darkBase = darkTheme({
  accentColor:           "#84CC16",
  accentColorForeground: "#000000",
  borderRadius:          "large",
  fontStack:             "system",
  overlayBlur:           "small",
});

/**
 * Nexora dark theme — brand-consistent violet/dark palette.
 */
export const nexoraDarkTheme: Theme = {
  ..._darkBase,
  colors: {
    ..._darkBase.colors,
    modalBackground:              "#0F0F1A",
    modalBorder:                  "#1E1E2E",
    profileForeground:            "#1E1E2E",
    connectButtonBackground:      "#1E1E2E",
    connectButtonInnerBackground: "#2A2A3E",
    menuItemBackground:           "#1E1E2E",
    actionButtonBorder:           "#2A2A3E",
    actionButtonBorderMobile:     "#2A2A3E",
    closeButton:                  "#9CA3AF",
    closeButtonBackground:        "#1E1E2E",
  },
  fonts: {
    body: "'Inter', 'system-ui', sans-serif",
  },
  shadows: {
    ..._darkBase.shadows,
    connectButton:        "0 4px 24px rgba(132, 204, 22, 0.25)",
    dialog:               "0 8px 64px rgba(0, 0, 0, 0.8)",
    profileDetailsAction: "0 2px 8px rgba(0, 0, 0, 0.5)",
    selectedOption:       "0 2px 8px rgba(132, 204, 22, 0.3)",
  },
};

/**
 * Nexora light theme — for future light-mode support.
 */
const _lightBase = lightTheme({
  accentColor:           "#84CC16",
  accentColorForeground: "#000000",
  borderRadius:          "large",
  fontStack:             "system",
  overlayBlur:           "small",
});

export const nexoraLightTheme: Theme = {
  ..._lightBase,
  colors: {
    ..._lightBase.colors,
    modalBackground: "#FFFFFF",
    modalBorder:     "#E5E7EB",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Wallet groups
// ─────────────────────────────────────────────────────────────────────────────

const { wallets: defaultWallets } = getDefaultWallets();

/**
 * Ordered wallet list shown in the connect modal.
 * Default wallets first, then extended options.
 */
export const RAINBOWKIT_WALLETS = [
  ...defaultWallets,
  {
    groupName: "More",
    wallets: [
      rabbyWallet,
      zerionWallet,
      trustWallet,
      argentWallet,
      ledgerWallet,
      safeWallet,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WalletConnect project ID (convenience re-export for wagmi.config.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const WALLETCONNECT_PROJECT_ID =
  (process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]) ?? "";
