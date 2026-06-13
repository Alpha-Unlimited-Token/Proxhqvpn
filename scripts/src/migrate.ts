// Post-merge idempotent schema migrations.
// Run via: cd lib/db && node_modules/.bin/tsx ../../scripts/src/migrate.ts
// Avoids drizzle-kit push which blocks on interactive TTY prompts.
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations: string[] = [
  // audit_log_append_only — append-only tamper-evident audit ledger
  `CREATE TABLE IF NOT EXISTS audit_log_append_only (
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
  )`,

  // node_enrollment_tokens — add columns that may be missing from older schema
  `ALTER TABLE IF EXISTS node_enrollment_tokens
    ADD COLUMN IF NOT EXISTS used_at timestamp`,
  `ALTER TABLE IF EXISTS node_enrollment_tokens
    ADD COLUMN IF NOT EXISTS claimed_node_id text`,

  // node_daemon_credentials
  `CREATE TABLE IF NOT EXISTS node_daemon_credentials (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    node_id           text NOT NULL UNIQUE,
    region            text,
    public_ip         text,
    public_key        text,
    daemon_secret_enc text NOT NULL,
    enrolled_at       timestamptz NOT NULL DEFAULT now()
  )`,

  // vpn_config_lifecycle_events
  `CREATE TABLE IF NOT EXISTS vpn_config_lifecycle_events (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    config_id  text NOT NULL,
    user_id    text NOT NULL,
    device_id  text NOT NULL,
    state      text NOT NULL,
    metadata   jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // firewall_policy_versions
  `CREATE TABLE IF NOT EXISTS firewall_policy_versions (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    version     integer NOT NULL,
    policy      jsonb NOT NULL,
    compiled    jsonb NOT NULL,
    simulation  jsonb,
    deployed_by text NOT NULL,
    deployed_at timestamptz NOT NULL DEFAULT now(),
    active      boolean NOT NULL DEFAULT false
  )`,

  // policy_graph_edges
  `CREATE TABLE IF NOT EXISTS policy_graph_edges (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   text,
    source_type text NOT NULL,
    source_id   text NOT NULL,
    relation    text NOT NULL,
    target_type text NOT NULL,
    target_id   text NOT NULL,
    metadata    jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
];

for (const sql of migrations) {
  try {
    await pool.query(sql);
    console.log("OK:", sql.trim().slice(0, 70).replace(/\s+/g, " "));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("FAIL:", msg, "\nSQL:", sql.trim().slice(0, 80));
    process.exit(1);
  }
}

await pool.end();
console.log("Schema migrations complete.");
