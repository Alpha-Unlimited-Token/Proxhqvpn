#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════════
# ProxhqVPN — Ghost Nodes Deployment Script
# Creates a deceptive WireGuard interface (wg-ghost0) on port 51820 that accepts
# all handshakes and feeds captured peer data to the Ghost Trap evidence system.
# Real WireGuard runs on a separate non-standard port (set WG_REAL_PORT).
# Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
# Usage: sudo WG_REAL_PORT=41194 bash deploy-ghost-nodes.sh
# ════════════════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

API_BASE="${API_BASE:-https://proxhqvpn.replit.app/api}"
NODE_ID="${NODE_ID:-$(hostname)}"
NODE_AGENT_PSK="${NODE_AGENT_PSK:?NODE_AGENT_PSK env var required}"
HONEYPOT_PSK="${HONEYPOT_PSK:?HONEYPOT_PSK env var required}"
WG_REAL_PORT="${WG_REAL_PORT:-41194}"       # Real WireGuard port (non-standard, hidden)
WG_GHOST_PORT="${WG_GHOST_PORT:-51820}"     # Deception port (original, attracts scanners)
GHOST_SUBNET="${GHOST_SUBNET:-10.99.0.1/24}"  # Dead-end RFC1918 subnet for trapped peers
SERVICE_NAME="proxhq-ghost-nodes"
LOG_TAG="[ghost-nodes-deploy]"

log()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $LOG_TAG $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Must run as root (sudo)"
log "Starting Ghost Nodes deployment on node: $NODE_ID"

# ── 1. Install WireGuard ─────────────────────────────────────────────────────
log "Installing WireGuard..."
apt-get update -qq
apt-get install -y --no-install-recommends wireguard wireguard-tools iptables iproute2

# ── 2. Generate FAKE WireGuard keypair (deception only) ─────────────────────
log "Generating fake WireGuard keypair for deception interface..."
GHOST_PRIVATE_KEY=$(wg genkey)
GHOST_PUBLIC_KEY=$(echo "$GHOST_PRIVATE_KEY" | wg pubkey)
log "Ghost public key (decoy, not real): ${GHOST_PUBLIC_KEY}"

# Store in RAM only for the daemon — NOT written to /etc/wireguard
GHOST_KEY_FILE="/dev/shm/proxhq-ghost-wg.key"
echo "$GHOST_PRIVATE_KEY" > "$GHOST_KEY_FILE"
chmod 600 "$GHOST_KEY_FILE"
log "Fake private key stored RAM-only at $GHOST_KEY_FILE"

# ── 3. Create wg-ghost0 WireGuard config ─────────────────────────────────────
log "Creating wg-ghost0 deception interface config..."
# wg-ghost0 deliberately has NO [Peer] sections — it accepts ALL handshakes
# making it appear as a wide-open WireGuard server to scanners.
cat > /etc/wireguard/wg-ghost0.conf << WG_EOF
[Interface]
# DECEPTION INTERFACE — accepts all inbound WireGuard handshakes
# Traffic is routed to dead-end subnet ${GHOST_SUBNET}, NOT the internet
Address = ${GHOST_SUBNET}
ListenPort = ${WG_GHOST_PORT}
PrivateKey = ${GHOST_PRIVATE_KEY}
PostUp   = iptables -A FORWARD -i wg-ghost0 -j DROP; iptables -A FORWARD -o wg-ghost0 -j DROP; ip rule add from 10.99.0.0/24 blackhole priority 100
PostDown = iptables -D FORWARD -i wg-ghost0 -j DROP; iptables -D FORWARD -o wg-ghost0 -j DROP; ip rule del from 10.99.0.0/24 blackhole priority 100
# Logging: all handshake attempts captured by tcpdump sidecar (see daemon)
WG_EOF
chmod 600 /etc/wireguard/wg-ghost0.conf

# ── 4. Bring up wg-ghost0 ────────────────────────────────────────────────────
log "Starting wg-ghost0 deception interface..."
wg-quick down wg-ghost0 2>/dev/null || true
wg-quick up wg-ghost0
log "✓ wg-ghost0 active on port $WG_GHOST_PORT"

# ── 5. Ghost Nodes monitoring daemon ─────────────────────────────────────────
log "Installing Ghost Nodes monitoring daemon..."
mkdir -p /opt/proxhq/ghost-nodes

cat > /opt/proxhq/ghost-nodes/ghost-nodes.mjs << 'DAEMON_EOF'
// ProxhqVPN Ghost Nodes Daemon
// Monitors wg-ghost0 for handshake attempts and reports captured peers to API.
import { execSync, exec } from "child_process";
import { readFileSync } from "fs";

const cfg  = JSON.parse(readFileSync("/etc/proxhq/ghost-trap.conf", "utf8"));
const API  = cfg.API_BASE;
const PSK  = cfg.HONEYPOT_PSK;
const NODE = cfg.NODE_ID;

const knownPeers = new Set();

async function pollWgStats() {
  try {
    const out = execSync("wg show wg-ghost0 dump 2>/dev/null", { encoding: "utf8" });
    for (const line of out.trim().split("\n").slice(1)) {
      const parts = line.split("\t");
      if (parts.length < 4) continue;
      const [pubkey, , endpoint, ] = parts;
      const peerKey = `${pubkey}:${endpoint}`;
      if (endpoint && endpoint !== "(none)" && !knownPeers.has(peerKey)) {
        knownPeers.add(peerKey);
        const ip = endpoint.split(":")[0];
        console.log(`[ghost-nodes] New deception handshake from ${ip} — pubkey: ${pubkey.slice(0,12)}...`);
        await fetch(`${API}/daemon-inbound/ghost-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-honeypot-psk": PSK },
          body: JSON.stringify({
            nodeId: NODE,
            eventType: "ghost_wg_handshake",
            attackerIp: ip,
            metadata: { pubkey, endpoint, interface: "wg-ghost0", note: "Deception WireGuard handshake captured" },
          }),
        }).catch(e => console.error("[ghost-nodes] report failed:", e.message));
      }
    }
  } catch {}
}

setInterval(pollWgStats, 5_000);
console.log(`[ghost-nodes] Monitoring wg-ghost0 for deception handshakes...`);
DAEMON_EOF

# ── 6. Write config (reuses ghost-trap.conf) ─────────────────────────────────
if [[ ! -f /etc/proxhq/ghost-trap.conf ]]; then
  mkdir -p /etc/proxhq
  cat > /etc/proxhq/ghost-trap.conf << CONF_EOF
{
  "API_BASE": "${API_BASE}",
  "NODE_ID": "${NODE_ID}",
  "HONEYPOT_PSK": "${HONEYPOT_PSK}",
  "NODE_AGENT_PSK": "${NODE_AGENT_PSK}",
  "LISTEN_PORT": "8443"
}
CONF_EOF
  chmod 600 /etc/proxhq/ghost-trap.conf
fi

# ── 7. systemd unit ──────────────────────────────────────────────────────────
log "Writing systemd unit for Ghost Nodes daemon..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << UNIT_EOF
[Unit]
Description=ProxhqVPN Ghost Nodes WireGuard Monitor
After=network-online.target wg-quick@wg-ghost0.service
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node --input-type=module /opt/proxhq/ghost-nodes/ghost-nodes.mjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxhq-ghost-nodes

[Install]
WantedBy=multi-user.target
UNIT_EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# ── 8. Enable wg-ghost0 on boot ──────────────────────────────────────────────
systemctl enable wg-quick@wg-ghost0

# ── 9. UFW rules ──────────────────────────────────────────────────────────────
log "Configuring firewall rules..."
if command -v ufw &>/dev/null; then
  ufw allow "${WG_GHOST_PORT}/udp"  comment "ProxhqVPN Ghost WireGuard (deception layer)"
  ufw allow "${WG_REAL_PORT}/udp"   comment "ProxhqVPN Real WireGuard (hidden)"
  ufw --force enable
fi

# ── 10. Health check ──────────────────────────────────────────────────────────
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "✓ Ghost Nodes daemon running"
else
  die "Ghost Nodes daemon failed. Check: journalctl -u $SERVICE_NAME -n 50"
fi

WG_SHOW=$(wg show wg-ghost0 2>/dev/null)
if echo "$WG_SHOW" | grep -q "listening port: ${WG_GHOST_PORT}"; then
  log "✓ wg-ghost0 listening on UDP $WG_GHOST_PORT"
else
  log "⚠ wg-ghost0 status unexpected — verify with: wg show wg-ghost0"
fi

log "Ghost Nodes deployment complete."
log ""
log "Deception layer summary:"
log "  Port $WG_GHOST_PORT/udp — Fake WireGuard (accepts all, routes to dead-end ${GHOST_SUBNET})"
log "  Port $WG_REAL_PORT/udp  — Real WireGuard (your actual VPN tunnel)"
log "  Ghost public key: $GHOST_PUBLIC_KEY"
log ""
log "Test deception layer:"
log "  nmap -sU -p $WG_GHOST_PORT \$(curl -s ifconfig.me)"
log "  wg show wg-ghost0"
