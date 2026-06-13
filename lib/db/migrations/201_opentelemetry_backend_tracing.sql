-- Patch 201: OpenTelemetry backend tracing
CREATE TABLE IF NOT EXISTS patch_201_opentelemetry_backend_tracing (
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

CREATE INDEX IF NOT EXISTS idx_patch_201_opentelemetry_backend_tracing_tenant_status
  ON patch_201_opentelemetry_backend_tracing(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_201_opentelemetry_backend_tracing_user_created
  ON patch_201_opentelemetry_backend_tracing(user_id, created_at DESC);
