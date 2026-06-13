-- Patch 78: RBAC v2 tables
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS rbac_roles (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS rbac_assignments (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, role_id)
);
