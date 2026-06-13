CREATE TABLE IF NOT EXISTS patch_282_tenant_data_partition_strategy (
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

CREATE INDEX IF NOT EXISTS idx_patch_282_tenant_data_partition_strategy_tenant_status
  ON patch_282_tenant_data_partition_strategy(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_282_tenant_data_partition_strategy_user_created
  ON patch_282_tenant_data_partition_strategy(user_id, created_at DESC);
