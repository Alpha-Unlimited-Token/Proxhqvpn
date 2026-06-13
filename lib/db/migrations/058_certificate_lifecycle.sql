-- Patch 136: Certificate lifecycle management
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  issuer TEXT,
  serial_number TEXT,
  fingerprint_sha256 TEXT NOT NULL,
  not_before TIMESTAMPTZ,
  not_after TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_expiry
  ON certificates(not_after, status);
