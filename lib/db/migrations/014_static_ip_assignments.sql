-- Patch 45: Static IP assignments table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS static_ip_assignments (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  ip_address TEXT NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('dedicated', 'reserved', 'manual')),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_static_ip_assignments_user
  ON static_ip_assignments(user_id, status);
