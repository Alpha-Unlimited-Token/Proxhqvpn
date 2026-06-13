-- Patch 182: Edge gateway lifecycle
CREATE TABLE IF NOT EXISTS patch_182_edge_gateway_lifecycle (
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

CREATE INDEX IF NOT EXISTS idx_patch_182_edge_gateway_lifecycle_tenant_status
  ON patch_182_edge_gateway_lifecycle(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_182_edge_gateway_lifecycle_user_created
  ON patch_182_edge_gateway_lifecycle(user_id, created_at DESC);
