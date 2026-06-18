-- Migration 306: Audit chain entries persistence table
-- Stores signed hash-chain entries for tamper-evident cross-restart continuity.
-- The in-process chain seeds from this table on startup (seedChainFromDb).
-- IMPORTANT: This table is INSERT-ONLY. The trigger below prevents UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS audit_chain_entries (
  seq         BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prev_hash   TEXT        NOT NULL,
  hash        TEXT        NOT NULL UNIQUE,
  sig         TEXT        NOT NULL,
  actor       TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  resource    TEXT        NOT NULL,
  result      TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutability trigger — blocks UPDATE and DELETE at the DB level
CREATE OR REPLACE FUNCTION prevent_audit_chain_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_chain_entries is append-only — UPDATE and DELETE are not permitted';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_chain_immutable ON audit_chain_entries;
CREATE TRIGGER trg_audit_chain_immutable
  BEFORE UPDATE OR DELETE ON audit_chain_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_chain_mutation();

-- Index for chain seeding: get latest entry efficiently
CREATE INDEX IF NOT EXISTS idx_audit_chain_entries_seq_desc
  ON audit_chain_entries (seq DESC);

CREATE INDEX IF NOT EXISTS idx_audit_chain_entries_created_at_desc
  ON audit_chain_entries (created_at DESC);

COMMENT ON TABLE audit_chain_entries IS
  'Append-only SHA3-256 + HMAC-SHA512 signed audit chain entries. Mirror of in-process chain state for crash recovery.';
