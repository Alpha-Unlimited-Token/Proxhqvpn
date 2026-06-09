-- Migration: ZTNA device trust schema + append-only audit log + RLS
-- Gap bridge from ChatGPT audit (Top-3 Gap Bridge Package) — 2026-06-09
-- Run: pnpm --filter @workspace/db run push  (or apply manually)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Devices table — device posture and trust scores ──────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text        NOT NULL,
  cert_fingerprint  text        UNIQUE NOT NULL,
  trust_score       int         NOT NULL DEFAULT 0,
  posture           jsonb       NOT NULL DEFAULT '{}',
  revoked           boolean     NOT NULL DEFAULT false,
  last_seen_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);
CREATE INDEX IF NOT EXISTS devices_cert_idx    ON devices(cert_fingerprint);

-- ── Append-only audit log — tamper-evident, immutable via trigger ─────────────
CREATE TABLE IF NOT EXISTS audit_log_append_only (
  seq         bigserial   PRIMARY KEY,
  tenant_id   text,
  actor       text        NOT NULL,
  action      text        NOT NULL,
  resource    text        NOT NULL,
  result      text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  ip          text,
  prev_hash   text        NOT NULL,
  hash        text        NOT NULL,
  signature   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx    ON audit_log_append_only(actor);
CREATE INDEX IF NOT EXISTS audit_log_created_idx  ON audit_log_append_only(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx   ON audit_log_append_only(action);

-- Immutable trigger — prevents UPDATE and DELETE on audit log (court/compliance-friendly)
CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_append_only is immutable — rows cannot be updated or deleted';
END $$;

DROP TRIGGER IF EXISTS audit_no_update ON audit_log_append_only;
CREATE TRIGGER audit_no_update
  BEFORE UPDATE OR DELETE ON audit_log_append_only
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();

-- ── Row Level Security on devices + audit log ─────────────────────────────────
-- Set: SET LOCAL app.current_user_id = $userId in every transaction.
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devices_owner_policy ON devices;
CREATE POLICY devices_owner_policy ON devices
  USING (user_id = current_setting('app.current_user_id', true));

ALTER TABLE audit_log_append_only ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read_own ON audit_log_append_only;
CREATE POLICY audit_read_own ON audit_log_append_only
  FOR SELECT USING (actor = current_setting('app.current_user_id', true));

-- ── Service role bypass (for admin API and audit export) ──────────────────────
-- Grant the service role superuser-level bypass for admin audit reads:
-- ALTER TABLE audit_log_append_only FORCE ROW LEVEL SECURITY;
-- (Admin routes must SET LOCAL app.current_user_id = 'SERVICE_ROLE' to read all)
