-- Migration 318: Per-user persistent firewall rules.
-- Rules survive server restart, user logoff, and VPN reconnection.
-- The nftables-sync endpoint rebuilds /etc/proxhq/nftables-user-rules.nft
-- from this table on every boot via a systemd oneshot service.

CREATE TYPE fw_protocol  AS ENUM ('tcp', 'udp', 'both');
CREATE TYPE fw_direction AS ENUM ('inbound', 'outbound', 'both');
CREATE TYPE fw_action    AS ENUM ('allow', 'block');

CREATE TABLE IF NOT EXISTS user_firewall_rules (
  id             SERIAL PRIMARY KEY,
  user_id        TEXT        NOT NULL,
  label          TEXT        NOT NULL DEFAULT '',
  protocol       fw_protocol NOT NULL DEFAULT 'tcp',
  direction      fw_direction NOT NULL DEFAULT 'inbound',
  action         fw_action   NOT NULL DEFAULT 'allow',
  external_port  INTEGER     NOT NULL CHECK (external_port BETWEEN 1 AND 65535),
  internal_port  INTEGER              CHECK (internal_port BETWEEN 1 AND 65535),
  source_ip      TEXT,
  tunnel_ip      TEXT,
  notes          TEXT,
  enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  synced         BOOLEAN     NOT NULL DEFAULT FALSE,
  hit_count      INTEGER     NOT NULL DEFAULT 0,
  last_hit_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ufw_user_id        ON user_firewall_rules(user_id);
CREATE INDEX idx_ufw_enabled        ON user_firewall_rules(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_ufw_tunnel_ip      ON user_firewall_rules(tunnel_ip) WHERE tunnel_ip IS NOT NULL;
CREATE INDEX idx_ufw_external_port  ON user_firewall_rules(external_port);
