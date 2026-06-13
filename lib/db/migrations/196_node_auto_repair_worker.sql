-- Patch 196: Node auto-repair worker
CREATE TABLE IF NOT EXISTS patch_196_node_auto_repair_worker (
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

CREATE INDEX IF NOT EXISTS idx_patch_196_node_auto_repair_worker_tenant_status
  ON patch_196_node_auto_repair_worker(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_196_node_auto_repair_worker_user_created
  ON patch_196_node_auto_repair_worker(user_id, created_at DESC);
