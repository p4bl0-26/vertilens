-- Migration to add missing anchor columns to the assets table

ALTER TABLE assets
ADD COLUMN tx_hash TEXT,
ADD COLUMN contract_address TEXT,
ADD COLUMN anchored_at TIMESTAMPTZ;

-- If you want to make tx_hash and contract_address unique:
-- ALTER TABLE assets ADD CONSTRAINT assets_tx_hash_key UNIQUE (tx_hash);
