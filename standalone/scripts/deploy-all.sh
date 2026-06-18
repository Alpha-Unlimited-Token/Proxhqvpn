#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════════
# ProxhqVPN — Master Deployment Script
# Deploys all three security layers in order:
#   1. Firewall Engine (nftables)
#   2. Ghost Trap (honeypot HTTP lure daemon)
#   3. Ghost Nodes (deceptive WireGuard interface + monitor)
#
# Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
# Usage: sudo bash deploy-all.sh
#
# Required env vars:
#   NODE_AGENT_PSK   — shared key for node agent check-ins
#   HONEYPOT_PSK     — shared key for honeypot event callbacks
#
# Optional env vars (have sensible defaults):
#   API_BASE         — ProxhqVPN API URL (default: https://proxhqvpn.replit.app/api)
#   NODE_ID          — node identifier (default: hostname)
#   WG_REAL_PORT     — real WireGuard port (default: 41194)
#   WG_GHOST_PORT    — deception WireGuard port (default: 51820)
#   SSH_PORT         — SSH port (default: 22)
#   LISTEN_PORT      — Ghost Trap HTTP lure port (default: 8443)
#   ENABLE_PORT_KNOCK — set to "1" to enable knockd port knocking (default: 0)
# ════════════════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

: "${NODE_AGENT_PSK:?NODE_AGENT_PSK env var required}"
: "${HONEYPOT_PSK:?HONEYPOT_PSK env var required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_TAG="[deploy-all]"
DEPLOY_LOG="/var/log/proxhq-deploy-$(date +%Y%m%d-%H%M%S).log"

log()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $LOG_TAG $*" | tee -a "$DEPLOY_LOG"; }
die()  { log "FATAL: $*"; exit 1; }
step() { log ""; log "══════════════════════════════════════"; log "  $*"; log "══════════════════════════════════════"; }

[[ $EUID -eq 0 ]] || die "Must run as root (sudo)"

export API_BASE="${API_BASE:-https://proxhqvpn.replit.app/api}"
export NODE_ID="${NODE_ID:-$(hostname)}"
export NODE_AGENT_PSK
export HONEYPOT_PSK
export WG_REAL_PORT="${WG_REAL_PORT:-41194}"
export WG_GHOST_PORT="${WG_GHOST_PORT:-51820}"
export SSH_PORT="${SSH_PORT:-22}"
export LISTEN_PORT="${LISTEN_PORT:-8443}"
export ENABLE_PORT_KNOCK="${ENABLE_PORT_KNOCK:-0}"

log "ProxhqVPN Full Stack Deployment"
log "Node: $NODE_ID"
log "API:  $API_BASE"
log "Log:  $DEPLOY_LOG"

# ── Health-check helper ───────────────────────────────────────────────────────
health_check() {
  local name="$1"
  local service="$2"
  if systemctl is-active --quiet "$service"; then
    log "✓ $name health check PASSED"
  else
    log "✗ $name health check FAILED"
    log "  systemctl status $service"
    if [[ "${ROLLBACK_ON_FAILURE:-1}" == "1" ]]; then
      log "Rolling back $service..."
      systemctl stop "$service" 2>/dev/null || true
      systemctl disable "$service" 2>/dev/null || true
    fi
    die "$name failed to start. Deployment halted. See: $DEPLOY_LOG"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 1 — Firewall Engine
# ═══════════════════════════════════════════════════════════════════════════════
step "LAYER 1 — Firewall Engine (nftables)"
bash "$SCRIPT_DIR/deploy-firewall-engine.sh" 2>&1 | tee -a "$DEPLOY_LOG" || die "Firewall deployment failed"
health_check "Firewall (nftables)" "nftables"

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 2 — Ghost Trap
# ═══════════════════════════════════════════════════════════════════════════════
step "LAYER 2 — Ghost Trap Honeypot Daemon"
bash "$SCRIPT_DIR/deploy-ghost-trap.sh" 2>&1 | tee -a "$DEPLOY_LOG" || die "Ghost Trap deployment failed"
health_check "Ghost Trap" "proxhq-ghost-trap"

# Verify lure port is actually responding
sleep 2
if curl -sf --max-time 5 "http://localhost:${LISTEN_PORT}/.env" > /dev/null 2>&1; then
  log "✓ Ghost Trap lure responding on port $LISTEN_PORT"
else
  log "⚠ Ghost Trap lure not yet responding (may be starting up)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 3 — Ghost Nodes (deceptive WireGuard)
# ═══════════════════════════════════════════════════════════════════════════════
step "LAYER 3 — Ghost Nodes (Deceptive WireGuard)"
bash "$SCRIPT_DIR/deploy-ghost-nodes.sh" 2>&1 | tee -a "$DEPLOY_LOG" || die "Ghost Nodes deployment failed"
health_check "Ghost Nodes daemon" "proxhq-ghost-nodes"

# Verify deception WireGuard interface is up
if wg show wg-ghost0 &>/dev/null; then
  log "✓ wg-ghost0 deception interface active"
else
  log "⚠ wg-ghost0 may not be active — check: wg show wg-ghost0"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Final API check-in reporting full stack deployed
# ═══════════════════════════════════════════════════════════════════════════════
step "Final API check-in"
curl -sf -X POST "${API_BASE}/node-agent/checkin" \
  -H "Content-Type: application/json" \
  -H "x-node-agent-psk: ${NODE_AGENT_PSK}" \
  -d "{\"nodeId\":\"${NODE_ID}\",\"role\":\"full_stack\",\"version\":\"1.0.0\",\"layers\":[\"firewall\",\"ghost_trap\",\"ghost_nodes\"]}" \
  && log "✓ Full-stack check-in successful" \
  || log "⚠ API check-in failed (check NODE_AGENT_PSK and API_BASE)"

# ═══════════════════════════════════════════════════════════════════════════════
# Verification tests
# ═══════════════════════════════════════════════════════════════════════════════
step "Verification"
PUBLIC_IP=$(curl -sf --max-time 5 ifconfig.me 2>/dev/null || echo "unknown")
log "Node public IP: $PUBLIC_IP"
log ""
log "Run these verification tests:"
log ""
log "  TEST 1 — Deception port appears open (good — attracts scanners into honeypot):"
log "    nmap -sU -p ${WG_GHOST_PORT} ${PUBLIC_IP}"
log "    Expected: open"
log ""
log "  TEST 2 — Real WireGuard port appears filtered (good — hidden from scanners):"
log "    nmap -sU -p ${WG_REAL_PORT} ${PUBLIC_IP}"
log "    Expected: filtered or closed"
log ""
log "  TEST 3 — WireGuard handshake on deception port → check Ghost Trap evidence:"
log "    wg show wg-ghost0   (should show connected peers after any handshake attempt)"
log "    journalctl -u proxhq-ghost-nodes -n 20"
log ""
log "  TEST 4 — Ghost Trap HTTP lure:"
log "    curl -v http://localhost:${LISTEN_PORT}/.env"
log "    Expected: fake credentials returned"
log ""
log "  TEST 5 — nftables rules active:"
log "    nft list ruleset | grep dport"
log ""
log "Deployment complete. Full log: $DEPLOY_LOG"

# ── Daily key rotation cron (deception keys rotate every 24h) ────────────────
cat > /etc/cron.d/proxhq-ghost-rotate << CRON_EOF
# ProxhqVPN — rotate deception WireGuard keys daily to prevent fingerprinting
0 4 * * * root /usr/bin/bash -c 'wg-quick down wg-ghost0; PK=\$(wg genkey); sed -i "s|PrivateKey = .*|PrivateKey = \$PK|" /etc/wireguard/wg-ghost0.conf; wg-quick up wg-ghost0; echo "[key-rotate] Ghost keys rotated \$(date)"' >> /var/log/proxhq-key-rotate.log 2>&1
CRON_EOF
log "✓ Deception key rotation scheduled (daily 04:00)"
