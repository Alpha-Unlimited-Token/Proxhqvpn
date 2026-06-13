-- Patch 199: Global network topology API
CREATE TABLE IF NOT EXISTS patch_199_global_network_topology_api (
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

CREATE INDEX IF NOT EXISTS idx_patch_199_global_network_topology_api_tenant_status
  ON patch_199_global_network_topology_api(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_199_global_network_topology_api_user_created
  ON patch_199_global_network_topology_api(user_id, created_at DESC);
