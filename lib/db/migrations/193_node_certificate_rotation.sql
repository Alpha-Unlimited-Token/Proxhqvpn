-- Patch 193: Node certificate rotation
CREATE TABLE IF NOT EXISTS patch_193_node_certificate_rotation (
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

CREATE INDEX IF NOT EXISTS idx_patch_193_node_certificate_rotation_tenant_status
  ON patch_193_node_certificate_rotation(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_193_node_certificate_rotation_user_created
  ON patch_193_node_certificate_rotation(user_id, created_at DESC);
