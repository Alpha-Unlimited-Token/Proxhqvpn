-- Patch 83: Audit exports table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS audit_exports (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  requested_by TEXT NOT NULL,
  export_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  row_count INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  storage_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
