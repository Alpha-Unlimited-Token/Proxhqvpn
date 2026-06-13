-- Patch 204: Request latency SLOs
CREATE TABLE IF NOT EXISTS patch_204_request_latency_slos (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patch_204_request_latency_slos_tenant_status
  ON patch_204_request_latency_slos(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_204_request_latency_slos_user_created
  ON patch_204_request_latency_slos(user_id, created_at DESC);
