-- Patch 38: Node enrollment claims table (v2)
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS node_enrollment_claims (
  id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL,
  node_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  public_ip TEXT,
  region TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_node_enrollment_claims_node
  ON node_enrollment_claims(node_id, claimed_at DESC);
