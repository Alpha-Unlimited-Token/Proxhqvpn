#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════════
# ProxhqVPN — Ghost Trap Deployment Script
# Deploys the Ghost Trap honeypot daemon to an Ubuntu 22.04 Vultr VPS node.
# Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
# Usage: sudo bash deploy-ghost-trap.sh
# ════════════════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

# ── Configuration (override via env vars before calling) ─────────────────────
API_BASE="${API_BASE:-https://proxhqvpn.replit.app/api}"
NODE_ID="${NODE_ID:-$(hostname)}"
NODE_AGENT_PSK="${NODE_AGENT_PSK:?NODE_AGENT_PSK env var required}"
HONEYPOT_PSK="${HONEYPOT_PSK:?HONEYPOT_PSK env var required}"
LISTEN_PORT="${LISTEN_PORT:-8443}"
GHOST_TRAP_DIR="/opt/proxhq/ghost-trap"
CONF_DIR="/etc/proxhq"
SERVICE_NAME="proxhq-ghost-trap"
LOG_TAG="[ghost-trap-deploy]"

log()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $LOG_TAG $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" &>/dev/null || die "Required binary not found: $1"; }

# ── Preflight ────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Must run as root (sudo)"
log "Starting Ghost Trap deployment on node: $NODE_ID"

# ── 1. Dependencies ──────────────────────────────────────────────────────────
log "Installing runtime dependencies..."
apt-get update -qq
apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg lsb-release ufw

# Node.js 20 LTS via NodeSource
if ! command -v node &>/dev/null; then
  log "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version | grep -q "^v20" || die "Node.js 20 required, found: $(node --version)"

# PM2
if ! command -v pm2 &>/dev/null; then
  log "Installing PM2..."
  npm install -g pm2 --silent
fi

# ── 2. Create directories ────────────────────────────────────────────────────
log "Creating directories..."
mkdir -p "$GHOST_TRAP_DIR" "$CONF_DIR"
chmod 700 "$CONF_DIR"

# ── 3. Install Ghost Trap daemon ─────────────────────────────────────────────
log "Installing Ghost Trap daemon..."
cat > "$GHOST_TRAP_DIR/ghost-trap.mjs" << 'DAEMON_EOF'
// ProxhqVPN Ghost Trap Daemon — lightweight honeypot sensor
// Reports captured probes back to the central API.
import { createServer } from "http";
import { readFileSync } from "fs";

const cfg  = JSON.parse(readFileSync("/etc/proxhq/ghost-trap.conf", "utf8"));
const API  = cfg.API_BASE;
const PSK  = cfg.HONEYPOT_PSK;
const NODE = cfg.NODE_ID;
const PORT = parseInt(cfg.LISTEN_PORT ?? "8443", 10);

const LURE_PATHS = [
  "/login", "/.env", "/config", "/admin", "/wp-login.php",
  "/phpMyAdmin", "/api/v1/auth", "/.git/config", "/etc/passwd",
];

async function report(probe) {
  try {
    await fetch(`${API}/daemon-inbound/honeypot-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-honeypot-psk": PSK },
      body: JSON.stringify({ nodeId: NODE, ...probe }),
    });
  } catch (err) {
    console.error("[ghost-trap] report failed:", err.message);
  }
}

createServer(async (req, res) => {
  const ip      = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown";
  const ua      = req.headers["user-agent"] ?? "";
  const path    = req.url ?? "/";
  const isLure  = LURE_PATHS.some(l => path.startsWith(l));

  // Tarpit: artificial delay to waste attacker resources
  const delay = isLure ? Math.floor(Math.random() * 4000) + 1000 : 200;
  await new Promise(r => setTimeout(r, delay));

  await report({
    attackerIp: ip,
    attackerUa: ua,
    method:     req.method,
    endpoint:   path,
    probeType:  isLure ? "lure_hit" : "general_probe",
    tarpitMs:   delay,
    headers:    JSON.stringify(req.headers),
  });

  // Serve convincing fake response
  if (path.startsWith("/.env")) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DB_HOST=localhost\nDB_USER=root\nDB_PASS=changeme\nAPP_KEY=fake-canary-key\n");
  } else if (path.startsWith("/login") || path.startsWith("/admin")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body><form><input name=user><input name=pass type=password><button>Login</button></form></body></html>");
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
}).listen(PORT, () => {
  console.log(`[ghost-trap] Listening on :${PORT} — node: ${NODE}`);
});
DAEMON_EOF

# ── 4. Write configuration ───────────────────────────────────────────────────
log "Writing configuration to $CONF_DIR/ghost-trap.conf..."
cat > "$CONF_DIR/ghost-trap.conf" << CONF_EOF
{
  "API_BASE": "${API_BASE}",
  "NODE_ID": "${NODE_ID}",
  "HONEYPOT_PSK": "${HONEYPOT_PSK}",
  "NODE_AGENT_PSK": "${NODE_AGENT_PSK}",
  "LISTEN_PORT": "${LISTEN_PORT}"
}
CONF_EOF
chmod 600 "$CONF_DIR/ghost-trap.conf"

# ── 5. systemd unit ──────────────────────────────────────────────────────────
log "Writing systemd unit..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << UNIT_EOF
[Unit]
Description=ProxhqVPN Ghost Trap Honeypot Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nobody
Group=nogroup
ExecStart=/usr/bin/node --input-type=module ${GHOST_TRAP_DIR}/ghost-trap.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxhq-ghost-trap
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
UNIT_EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# ── 6. UFW firewall rules ─────────────────────────────────────────────────────
log "Configuring UFW for Ghost Trap..."
if command -v ufw &>/dev/null; then
  ufw allow "${LISTEN_PORT}/tcp" comment "ProxhqVPN Ghost Trap lure port"
  ufw --force enable
fi

# ── 7. Health check ───────────────────────────────────────────────────────────
log "Verifying Ghost Trap service..."
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "✓ Ghost Trap is running on port $LISTEN_PORT"
else
  die "Ghost Trap service failed to start. Check: journalctl -u $SERVICE_NAME -n 50"
fi

# ── 8. Check-in to API ────────────────────────────────────────────────────────
log "Checking in to ProxhqVPN API..."
curl -sf -X POST "${API_BASE}/node-agent/checkin" \
  -H "Content-Type: application/json" \
  -H "x-node-agent-psk: ${NODE_AGENT_PSK}" \
  -d "{\"nodeId\":\"${NODE_ID}\",\"role\":\"ghost_trap\",\"version\":\"1.0.0\"}" && \
  log "✓ API check-in successful" || log "⚠ API check-in failed (check PSK and API_BASE)"

log "Ghost Trap deployment complete."
log "Monitor: journalctl -u ${SERVICE_NAME} -f"
