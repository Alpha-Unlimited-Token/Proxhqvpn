#!/bin/bash
set -e

# Step 1: install deps
pnpm install --frozen-lockfile

# Step 2: apply schema additions via idempotent SQL.
# We use psql directly instead of drizzle-kit push because drizzle-kit prompts
# interactively on ambiguous table/column renames, which hangs the 20s timeout.
psql "$DATABASE_URL" <<'SQL'
-- audit_log_append_only: append-only tamper-evident audit ledger
CREATE TABLE IF NOT EXISTS audit_log_append_only (
  seq        bigserial PRIMARY KEY,
  tenant_id  text,
  actor      text NOT NULL,
  action     text NOT NULL,
  resource   text NOT NULL,
  result     text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  ip         text,
  prev_hash  text NOT NULL,
  hash       text NOT NULL,
  signature  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- node_enrollment_tokens: add columns missing from older schema versions
ALTER TABLE IF EXISTS node_enrollment_tokens
  ADD COLUMN IF NOT EXISTS used_at timestamp;
ALTER TABLE IF EXISTS node_enrollment_tokens
  ADD COLUMN IF NOT EXISTS claimed_node_id text;

-- node_daemon_credentials
CREATE TABLE IF NOT EXISTS node_daemon_credentials (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id           text NOT NULL UNIQUE,
  region            text,
  public_ip         text,
  public_key        text,
  daemon_secret_enc text NOT NULL,
  enrolled_at       timestamptz NOT NULL DEFAULT now()
);

-- vpn_config_lifecycle_events
CREATE TABLE IF NOT EXISTS vpn_config_lifecycle_events (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id  text NOT NULL,
  user_id    text NOT NULL,
  device_id  text NOT NULL,
  state      text NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- firewall_policy_versions
CREATE TABLE IF NOT EXISTS firewall_policy_versions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version     integer NOT NULL,
  policy      jsonb NOT NULL,
  compiled    jsonb NOT NULL,
  simulation  jsonb,
  deployed_by text NOT NULL,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  active      boolean NOT NULL DEFAULT false
);

-- policy_graph_edges
CREATE TABLE IF NOT EXISTS policy_graph_edges (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   text,
  source_type text NOT NULL,
  source_id   text NOT NULL,
  relation    text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
SQL

echo "Schema migrations complete."
