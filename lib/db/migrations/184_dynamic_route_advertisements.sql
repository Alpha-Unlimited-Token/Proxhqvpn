-- Patch 184: Dynamic route advertisements
CREATE TABLE IF NOT EXISTS patch_184_dynamic_route_advertisements (
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

CREATE INDEX IF NOT EXISTS idx_patch_184_dynamic_route_advertisements_tenant_status
  ON patch_184_dynamic_route_advertisements(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_184_dynamic_route_advertisements_user_created
  ON patch_184_dynamic_route_advertisements(user_id, created_at DESC);
