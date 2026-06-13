-- Patch 139: Build attestations
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS build_attestations (
  id UUID PRIMARY KEY,
  build_id TEXT NOT NULL,
  commit_sha TEXT,
  artifact_sha256 TEXT NOT NULL,
  attestation JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_build_attestations_build
  ON build_attestations(build_id, created_at DESC);
