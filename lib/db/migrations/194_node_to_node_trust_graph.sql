-- Patch 194: Node-to-node trust graph
CREATE TABLE IF NOT EXISTS patch_194_node_to_node_trust_graph (
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

CREATE INDEX IF NOT EXISTS idx_patch_194_node_to_node_trust_graph_tenant_status
  ON patch_194_node_to_node_trust_graph(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_194_node_to_node_trust_graph_user_created
  ON patch_194_node_to_node_trust_graph(user_id, created_at DESC);
