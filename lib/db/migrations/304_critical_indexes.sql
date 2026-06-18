-- Migration 304: Critical performance indexes on hot query paths
-- These indexes eliminate sequential scans on the most frequently queried tables.

-- Audit log: timestamp desc (SIEM timeline, audit chain seeding)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_desc
  ON audit_log_append_only (created_at DESC);

-- Audit log: actor lookup (user activity queries)
CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON audit_log_append_only (actor);

-- Audit log: action lookup (event type filtering)
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log_append_only (action);

-- Node agent health: last_seen_at (offline alert worker hot path)
CREATE INDEX IF NOT EXISTS idx_node_agent_health_last_seen
  ON node_agent_health (last_seen_at);

-- Node agent health: status filter
CREATE INDEX IF NOT EXISTS idx_node_agent_health_status
  ON node_agent_health (status);

-- Honeypot alerts: unacknowledged filter (dashboard stats)
CREATE INDEX IF NOT EXISTS idx_honeypot_alerts_acknowledged
  ON honeypot_alerts (acknowledged)
  WHERE acknowledged = FALSE;

-- Honeypot alerts: created_at desc (alert feed ordering)
CREATE INDEX IF NOT EXISTS idx_honeypot_alerts_created_at_desc
  ON honeypot_alerts (created_at DESC);

-- Honeypot sessions: started_at (time-range queries, 14-day chart)
CREATE INDEX IF NOT EXISTS idx_honeypot_sessions_started_at
  ON honeypot_sessions (started_at);

-- Honeypot attackers: country (top-country aggregation)
CREATE INDEX IF NOT EXISTS idx_honeypot_attackers_country
  ON honeypot_attackers (country);

-- WireGuard devices: user_id (per-user device list)
CREATE INDEX IF NOT EXISTS idx_wg_devices_user_id
  ON wg_devices (user_id);

-- Canary tokens: active + created_at (token list queries)
CREATE INDEX IF NOT EXISTS idx_canary_tokens_active
  ON canary_tokens (active, created_at DESC);

-- ZTNA devices: user_id (posture lookup)
CREATE INDEX IF NOT EXISTS idx_ztna_devices_user_id
  ON ztna_devices (user_id);

-- ZTNA devices: cert_fingerprint (unique posture check hot path — already UNIQUE, ensuring index)
CREATE INDEX IF NOT EXISTS idx_ztna_devices_cert_fp
  ON ztna_devices (cert_fingerprint);
