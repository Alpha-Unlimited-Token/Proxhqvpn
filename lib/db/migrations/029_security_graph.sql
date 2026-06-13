-- Patch 66: Security graph tables
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS security_graph_nodes (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS security_graph_edges (
  id UUID PRIMARY KEY,
  source_node_id UUID NOT NULL,
  target_node_id UUID NOT NULL,
  relationship TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_graph_edges_source
  ON security_graph_edges(source_node_id);

CREATE INDEX IF NOT EXISTS idx_security_graph_edges_target
  ON security_graph_edges(target_node_id);
