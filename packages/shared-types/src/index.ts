/**
 * @file index.ts
 * @description Barrel export for @nexora/shared-types.
 *
 * Import from this file when you need types from multiple modules:
 *   import type { Asset, VerificationResult } from "@nexora/shared-types";
 *
 * Import directly from the sub-path for better tree-shaking:
 *   import type { Asset } from "@nexora/shared-types/provenance.types";
 */

export * from "./provenance.types";
