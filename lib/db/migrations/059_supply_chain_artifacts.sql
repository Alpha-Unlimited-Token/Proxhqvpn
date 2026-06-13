-- Patch 138: Supply-chain artifact registry
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS supply_chain_artifacts (
  id UUID PRIMARY KEY,
  artifact_name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  version TEXT,
  sha256 TEXT NOT NULL,
  source_uri TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_chain_artifacts_sha
  ON supply_chain_artifacts(sha256);
