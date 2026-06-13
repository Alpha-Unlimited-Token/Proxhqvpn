-- Patch 185: Route health telemetry
CREATE TABLE IF NOT EXISTS patch_185_route_health_telemetry (
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

CREATE INDEX IF NOT EXISTS idx_patch_185_route_health_telemetry_tenant_status
  ON patch_185_route_health_telemetry(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_185_route_health_telemetry_user_created
  ON patch_185_route_health_telemetry(user_id, created_at DESC);
