-- Patch 218: Distributed trace search
CREATE TABLE IF NOT EXISTS patch_218_distributed_trace_search (
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

CREATE INDEX IF NOT EXISTS idx_patch_218_distributed_trace_search_tenant_status
  ON patch_218_distributed_trace_search(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_218_distributed_trace_search_user_created
  ON patch_218_distributed_trace_search(user_id, created_at DESC);
