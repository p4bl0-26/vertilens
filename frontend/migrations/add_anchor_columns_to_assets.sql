-- =============================================================================
-- Migration: Add on-chain anchor columns to assets table
-- =============================================================================
-- Applies to: Supabase project (lygicveshcxclvqsyhwi)
-- Purpose:    Store Monad Testnet anchor data directly on the assets row
--             for fast, join-free access to on-chain provenance status.
--
-- These columns are nullable and populated by POST /api/anchor after a
-- successful anchorHash() call on the ProvenanceRegistry contract:
--   0x3da524a7becd8323dde9b4bf766be71a991dfaa0 (Monad Testnet)
--
-- Run via: Supabase Dashboard → SQL Editor, or `supabase db push`
-- =============================================================================

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS tx_hash          TEXT,
  ADD COLUMN IF NOT EXISTS contract_address TEXT,
  ADD COLUMN IF NOT EXISTS anchored_at      TIMESTAMPTZ;

-- Index for fast lookup of anchored vs. unanchored assets.
CREATE INDEX IF NOT EXISTS assets_tx_hash_idx
  ON assets (tx_hash)
  WHERE tx_hash IS NOT NULL;

-- Optional: comment the columns for Supabase dashboard clarity.
COMMENT ON COLUMN assets.tx_hash IS
  '0x-prefixed Monad Testnet tx hash from ProvenanceRegistry.anchorHash(). Null until anchored.';

COMMENT ON COLUMN assets.contract_address IS
  'Address of the ProvenanceRegistry contract used for anchoring. Null until anchored.';

COMMENT ON COLUMN assets.anchored_at IS
  'Timestamp when the on-chain anchor tx was mined. Null until anchored.';
