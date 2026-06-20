import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Transpile the shared-types workspace package so Next.js can process it.
   * Without this, Next.js won't compile TypeScript from node_modules/symlinked packages.
   */
  transpilePackages: ["@nexora/shared-types"],

  /** Silence the ESLint step during `next build` — run lint separately. */
  eslint: {
    ignoreDuringBuilds: true,
  },

  /** Allow TypeScript errors during build in dev — typecheck separately. */
  typescript: {
    ignoreBuildErrors: false,
  },

  /** Fix for @metamask/sdk webpack crash (RainbowKit dependency) */
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
