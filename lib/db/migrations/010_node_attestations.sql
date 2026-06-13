-- Patch 39: Node attestations table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS node_attestations (
  id UUID PRIMARY KEY,
  node_id TEXT NOT NULL,
  attestation_type TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'unknown')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_attestations_node_created
  ON node_attestations(node_id, created_at DESC);
