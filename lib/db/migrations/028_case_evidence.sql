-- Patch 65: Case evidence table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS case_evidence (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  storage_uri TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_evidence_case
  ON case_evidence(case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_evidence_sha256
  ON case_evidence(sha256);
