"use client";

/**
 * @file AppProviders.tsx
 * @description Root provider composition for the Veritas frontend.
 *
 * Render order (outermost → innermost):
 *   WagmiProvider
 *     └─ QueryProvider (TanStack Query)
 *         └─ RainbowKitProvider
 *             └─ ToastProvider
 *                 └─ {children}
 *
 * This component is imported once in app/layout.tsx.
 * All providers are client-side; the layout itself may remain a Server Component.
 */

import React from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, type Locale } from "@rainbow-me/rainbowkit";

import { wagmiConfig }                          from "@/config/wagmi.config";
import { nexoraDarkTheme, RAINBOWKIT_APP_INFO } from "@/config/rainbowkit.config";
import { QueryProvider }                        from "./QueryProvider";
import { ToastProvider }                        from "./ToastProvider";

// ─────────────────────────────────────────────────────────────────────────────
// AppProviders
// ─────────────────────────────────────────────────────────────────────────────

interface AppProvidersProps {
  children: React.ReactNode;
  /**
   * BCP-47 locale string passed from the server layout (e.g. "en", "zh-CN").
   * Used to initialise RainbowKit's localisation.
   * Defaults to "en".
   */
  locale?: string;
}

/**
 * Composes all application-level providers.
 *
 * Import this in app/layout.tsx:
 * ```tsx
 * import { AppProviders } from "@/providers/AppProviders";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AppProviders>{children}</AppProviders>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function AppProviders({ children, locale = "en" }: AppProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryProvider>
        <RainbowKitProvider
          theme={nexoraDarkTheme}
          locale={locale as Locale}
          appInfo={{
            appName:      RAINBOWKIT_APP_INFO.appName,
            learnMoreUrl: RAINBOWKIT_APP_INFO.learnMoreUrl,
          }}
          modalSize="compact"
          showRecentTransactions
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryProvider>
    </WagmiProvider>
  );
}
