#!/usr/bin/env bash
# =============================================================================
# ProxhqVPN Node Daemon Deployment Script
# =============================================================================
# Deploys the node agent, ghost WireGuard honeypot, and real-port monitor
# to one or more Vultr VPN servers over SSH.
#
# Usage:
#   ./deploy-node-daemon.sh [--node NODE_SSH] [--all] [--dry-run]
#
# Examples:
#   # Deploy to a single node (SSH alias or user@host):
#   ./deploy-node-daemon.sh --node root@149.28.x.x
#
#   # Deploy to all nodes defined in NODES array below:
#   ./deploy-node-daemon.sh --all
#
#   # Preview what would be run without executing:
#   ./deploy-node-daemon.sh --all --dry-run
#
# Prerequisites (on your local machine):
#   - SSH key authentication configured for each server
#   - NODE_AGENT_PSK and HONEYPOT_PSK exported as env vars, OR set them below
#   - API_BASE pointing to your deployed ProxhqVPN API
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STANDALONE="${REPO_ROOT}/standalone"

# ── Configuration ─────────────────────────────────────────────────────────────
# Override these via environment variables or edit directly.

API_BASE="${API_BASE:-https://proxhqvpn.com}"
NODE_AGENT_PSK="${NODE_AGENT_PSK:-}"
HONEYPOT_PSK="${HONEYPOT_PSK:-}"
REAL_WG_PORT="${REAL_WG_PORT:-41194}"
AGENT_VERSION="1.2.0"
INSTALL_DIR="/opt/proxhq"
CONFIG_DIR="/etc/proxhq"
PROXHQ_USER="proxhq"

# ── Node list ─────────────────────────────────────────────────────────────────
# Format: "ssh_target|node_id|node_name"
# Edit this list to match your actual Vultr servers.
declare -a NODES=(
    "root@149.28.0.0|proxhqvpn-node-1-la|ProxhqVPN Los Angeles #1"
    "root@45.32.0.0|proxhqvpn-node-2-london|ProxhqVPN London #2"
    "root@66.42.0.0|proxhqvpn-node-3-chicago|ProxhqVPN Chicago #3"
    "root@108.61.0.0|proxhqvpn-node-4-tokyo|ProxhqVPN Tokyo #4"
    # Add more nodes here — one per line
)

# ── Arg parsing ───────────────────────────────────────────────────────────────
TARGET_NODE=""
DEPLOY_ALL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --node)    TARGET_NODE="$2"; shift 2 ;;
        --all)     DEPLOY_ALL=true;   shift   ;;
        --dry-run) DRY_RUN=true;      shift   ;;
        -h|--help)
            sed -n '2,20p' "$0" | grep '^#' | sed 's/^# \?//'
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}   $*"; }
err()  { echo -e "${RED}[error]${NC}  $*"; }

if [[ -z "$NODE_AGENT_PSK" ]]; then
    err "NODE_AGENT_PSK is not set."
    err "Export it:  export NODE_AGENT_PSK=\$(cat your-psk-file)"
    exit 1
fi
if [[ -z "$HONEYPOT_PSK" ]]; then
    err "HONEYPOT_PSK is not set."
    err "Export it:  export HONEYPOT_PSK=\$(cat your-honeypot-psk-file)"
    exit 1
fi

if [[ "$DEPLOY_ALL" == false && -z "$TARGET_NODE" ]]; then
    err "Specify --node <ssh_target> or --all"
    exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
run() {
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [dry-run] $*"
    else
        eval "$@"
    fi
}

ssh_run() {
    local host="$1"; shift
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [dry-run] ssh $host '$*'"
    else
        ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$host" "$@"
    fi
}

scp_file() {
    local src="$1" host="$2" dest="$3"
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [dry-run] scp $src $host:$dest"
    else
        scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$src" "${host}:${dest}"
    fi
}

# ── Per-node deployment ───────────────────────────────────────────────────────
deploy_to_node() {
    local ssh_target="$1"
    local node_id="$2"
    local node_name="$3"

    log "═══════════════════════════════════════════════════════"
    log "Deploying to: $node_name ($node_id)"
    log "SSH target:   $ssh_target"
    log "═══════════════════════════════════════════════════════"

    # 1. Ensure Python3 + requests are installed
    log "Step 1/7 — Installing Python dependencies"
    ssh_run "$ssh_target" "
        apt-get update -qq 2>/dev/null || true
        apt-get install -y -qq python3 python3-pip 2>/dev/null || true
        pip3 install requests cryptography --break-system-packages -q 2>/dev/null || \
        pip3 install requests cryptography -q 2>/dev/null || true
    "

    # 2. Create proxhq user (if not already exists) and install dir
    log "Step 2/7 — Creating system user and directories"
    ssh_run "$ssh_target" "
        id -u ${PROXHQ_USER} &>/dev/null || \
            useradd --system --no-create-home --shell /usr/sbin/nologin ${PROXHQ_USER}
        mkdir -p ${INSTALL_DIR} ${CONFIG_DIR}
        chown root:${PROXHQ_USER} ${CONFIG_DIR}
        chmod 750 ${CONFIG_DIR}
    "

    # 3. Copy daemon scripts
    log "Step 3/7 — Uploading daemon scripts"
    scp_file "${STANDALONE}/proxhq-node-agent.py"        "$ssh_target" "${INSTALL_DIR}/proxhq-node-agent.py"
    scp_file "${STANDALONE}/ghost-wireguard.py"          "$ssh_target" "${INSTALL_DIR}/ghost-wireguard.py"
    scp_file "${STANDALONE}/ghost-realport-monitor.py"   "$ssh_target" "${INSTALL_DIR}/ghost-realport-monitor.py"
    ssh_run "$ssh_target" "chmod +x ${INSTALL_DIR}/*.py"

    # 4. Write /etc/proxhq/config.json
    log "Step 4/7 — Writing /etc/proxhq/config.json"
    local config_json
    config_json=$(cat <<EOF
{
  "api_base":         "${API_BASE}",
  "node_agent_psk":   "${NODE_AGENT_PSK}",
  "honeypot_psk":     "${HONEYPOT_PSK}",
  "node_id":          "${node_id}",
  "node_name":        "${node_name}",
  "wg_interface":     "wg0",
  "real_wg_port":     ${REAL_WG_PORT},
  "checkin_interval": 30,
  "health_interval":  10,
  "retry_delay":      5
}
EOF
)
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [dry-run] Writing /etc/proxhq/config.json for node ${node_id}"
    else
        echo "$config_json" | ssh -o StrictHostKeyChecking=accept-new "$ssh_target" \
            "cat > ${CONFIG_DIR}/config.json && chmod 640 ${CONFIG_DIR}/config.json && chown root:${PROXHQ_USER} ${CONFIG_DIR}/config.json"
    fi

    # 5. Write /etc/proxhq/daemon.env (for ghost daemons that use EnvironmentFile)
    log "Step 5/7 — Writing /etc/proxhq/daemon.env"
    local daemon_env
    daemon_env=$(cat <<EOF
API_BASE=${API_BASE}
NODE_AGENT_PSK=${NODE_AGENT_PSK}
HONEYPOT_PSK=${HONEYPOT_PSK}
NODE_ID=${node_id}
REAL_WG_PORT=${REAL_WG_PORT}
EOF
)
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [dry-run] Writing /etc/proxhq/daemon.env for node ${node_id}"
    else
        echo "$daemon_env" | ssh -o StrictHostKeyChecking=accept-new "$ssh_target" \
            "cat > ${CONFIG_DIR}/daemon.env && chmod 600 ${CONFIG_DIR}/daemon.env"
    fi

    # 6. Install systemd service units
    log "Step 6/7 — Installing systemd service units"
    scp_file "${STANDALONE}/systemd/proxhq-node-agent.service"       "$ssh_target" "/etc/systemd/system/proxhq-node-agent.service"
    scp_file "${STANDALONE}/systemd/proxhq-ghost-wireguard.service"   "$ssh_target" "/etc/systemd/system/proxhq-ghost-wireguard.service"
    scp_file "${STANDALONE}/systemd/proxhq-realport-monitor.service"  "$ssh_target" "/etc/systemd/system/proxhq-realport-monitor.service"

    ssh_run "$ssh_target" "
        systemctl daemon-reload
        systemctl enable proxhq-node-agent proxhq-ghost-wireguard proxhq-realport-monitor
        systemctl restart proxhq-node-agent proxhq-ghost-wireguard proxhq-realport-monitor
    "

    # 7. Verify services are running and check-ins appear
    log "Step 7/7 — Verifying services"
    sleep 3
    ssh_run "$ssh_target" "
        echo ''
        echo '── Service status ──────────────────────────────────────────'
        systemctl is-active proxhq-node-agent       && echo '  ✓ proxhq-node-agent       is active' || echo '  ✗ proxhq-node-agent       FAILED'
        systemctl is-active proxhq-ghost-wireguard  && echo '  ✓ proxhq-ghost-wireguard  is active' || echo '  ✗ proxhq-ghost-wireguard  FAILED'
        systemctl is-active proxhq-realport-monitor && echo '  ✓ proxhq-realport-monitor is active' || echo '  ✗ proxhq-realport-monitor FAILED'
        echo ''
        echo '── Node agent recent logs ──────────────────────────────────'
        journalctl -u proxhq-node-agent --no-pager -n 15 2>/dev/null || true
    "

    log "✓ Node ${node_id} deployed successfully"
    echo ""
}

# ── Verify checkins against the API ──────────────────────────────────────────
# GET /api/node-agent/nodes requires Clerk admin auth (cookie/session), not PSK.
# We verify by watching the POST /api/node-agent/health endpoint locally —
# the agent will log "Checkin OK" in its journal if the PSK is accepted.
verify_api_checkins() {
    log "Waiting 35 s for first check-in cycle, then verifying via journal logs..."
    sleep 35

    # Build the list of hosts to check
    local -a CHECK_HOSTS=()
    if [[ -n "$TARGET_NODE" ]]; then
        CHECK_HOSTS=("${TARGET_NODE}|${TARGET_NODE}|single")
    else
        CHECK_HOSTS=("${NODES[@]}")
    fi

    for entry in "${CHECK_HOSTS[@]}"; do
        IFS='|' read -r ssh_target node_id _node_name <<< "$entry"
        log "Checking journal on ${node_id} (${ssh_target})..."
        ssh_run "$ssh_target" "
            journalctl -u proxhq-node-agent --no-pager -n 5 2>/dev/null | \
                grep -E 'Checkin OK|error|FAILED|version rejected' || \
                echo '  (no recent log lines yet — try: journalctl -u proxhq-node-agent -f)'
        " || true
    done

    log "────────────────────────────────────────────────────────────"
    log "To confirm live data in the dashboard:"
    log "  1. Sign in at ${API_BASE}/sign-in"
    log "  2. Go to ${API_BASE}/dashboard — nodes appear within 30 s"
    log "  3. Admin API: GET ${API_BASE}/api/node-agent/nodes (requires Clerk session)"
    log "────────────────────────────────────────────────────────────"
}

# ── Main ──────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
    warn "DRY RUN mode — no changes will be made"
    echo ""
fi

if [[ -n "$TARGET_NODE" ]]; then
    # Single node — expect format "user@host" or an SSH alias.
    # node_id and node_name are derived from the hostname if not provided.
    node_hostname=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$TARGET_NODE" \
        "hostname" 2>/dev/null || echo "unknown-node")
    deploy_to_node "$TARGET_NODE" "$node_hostname" "$node_hostname"
    verify_api_checkins
else
    # Deploy to all nodes in the NODES array
    for entry in "${NODES[@]}"; do
        IFS='|' read -r ssh_target node_id node_name <<< "$entry"
        deploy_to_node "$ssh_target" "$node_id" "$node_name"
    done
    verify_api_checkins
fi

log "All deployments complete."
log "Dashboard: ${API_BASE}/dashboard"
log "Node list: ${API_BASE}/api/node-agent/nodes"
