-- Patch 85: Legal holds table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS legal_holds (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  subject TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_subject
  ON legal_holds(subject, status);
