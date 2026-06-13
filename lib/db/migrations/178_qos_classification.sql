-- Patch 178: QoS classification
CREATE TABLE IF NOT EXISTS patch_178_qos_classification (
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

CREATE INDEX IF NOT EXISTS idx_patch_178_qos_classification_tenant_status
  ON patch_178_qos_classification(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_178_qos_classification_user_created
  ON patch_178_qos_classification(user_id, created_at DESC);
