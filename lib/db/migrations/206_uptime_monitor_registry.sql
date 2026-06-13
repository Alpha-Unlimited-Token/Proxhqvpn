-- Patch 206: Uptime monitor registry
CREATE TABLE IF NOT EXISTS patch_206_uptime_monitor_registry (
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

CREATE INDEX IF NOT EXISTS idx_patch_206_uptime_monitor_registry_tenant_status
  ON patch_206_uptime_monitor_registry(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_206_uptime_monitor_registry_user_created
  ON patch_206_uptime_monitor_registry(user_id, created_at DESC);
