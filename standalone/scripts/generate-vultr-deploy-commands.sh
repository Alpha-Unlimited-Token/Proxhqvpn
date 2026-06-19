#!/usr/bin/env bash
# ============================================================
# ProxhqVPN — Vultr Node Deploy Command Generator
# © 2026 Alpha Unlimited Technologies LLC
#
# Run this INSIDE Replit shell to get fully-filled copy-paste
# commands for all 4 Vultr nodes.
#
# Usage:
#   bash standalone/scripts/generate-vultr-deploy-commands.sh
# ============================================================

DOMAIN="${REPLIT_DOMAINS:-8ed1e79f-3fa7-4c82-b61d-7b93cb57936e-00-1arzc3ag01duz.spock.replit.dev}"
PSK="${NODE_AGENT_PSK:-}"
BASE_URL="https://${DOMAIN}"
SIEM_URL="${BASE_URL}/api/siem/ingest"
GEO="CN RU KP IR SY"

if [[ -z "$PSK" ]]; then
  echo ""
  echo "  ERROR: NODE_AGENT_PSK environment variable is not set."
  echo "  Make sure you are running this inside Replit where secrets are loaded."
  exit 1
fi

print_node() {
  local LABEL="$1"
  local NODE_ID="$2"

  cat <<CMD

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Node — ${LABEL}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Step 1: Download + run node setup script ──────────
curl -fsSL \\
  -H "X-Node-Agent-PSK: ${PSK}" \\
  "${BASE_URL}/api/node-scripts/${NODE_ID}" \\
  -o setup.sh && bash setup.sh

# ── Step 2: Download combat hardening script ──────────
curl -fsSL \\
  -H "Authorization: token ${GITHUB_TOKEN:-<your-github-token>}" \\
  "https://raw.githubusercontent.com/Alpha-Unlimited-Token/Proxhqvpn/main/standalone/scripts/combat-attacker-architecture.sh" \\
  -o combat-attacker-architecture.sh

# ── Step 3: Run hardening ─────────────────────────────
WG_PORT=51820 \\
GEO_BLOCK_COUNTRIES="${GEO}" \\
SIEM_WEBHOOK_URL="${SIEM_URL}" \\
DAEMON_PORT=3000 \\
SSH_PORT=22 \\
bash combat-attacker-architecture.sh

CMD
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ProxhqVPN — Vultr Node Deploy Commands                ║"
echo "║   Copy each block and run it as root on the target node ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Domain  : ${DOMAIN}"
echo "  SIEM    : ${SIEM_URL}"
echo "  Geo     : ${GEO}"
echo "  PSK     : ${PSK:0:4}****${PSK: -4}  (masked for display)"
echo ""

print_node "London (proxhqvpn-node-2)"        "proxhqvpn-node-2"
print_node "Tokyo (proxhqvpn-tokyo-01)"        "proxhqvpn-tokyo-01"
print_node "Los Angeles (proxhqvpn-los-angeles-01)" "proxhqvpn-los-angeles-01"
print_node "Chicago (proxhqvpn-chicago)"       "proxhqvpn-chicago"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " After each run: check /var/log/proxhqvpn-combat.log"
echo " on the Vultr node to confirm all 14 sections applied."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
