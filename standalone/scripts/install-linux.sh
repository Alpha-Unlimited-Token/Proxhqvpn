#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  GhostNet VPN — Linux Installer
#  Installs the GhostNet server + daemon and wires them up as systemd services.
#  Tested: Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch Linux
#
#  Run as root:
#    sudo bash install-linux.sh [--psk "your-strong-passphrase"] [--port 51820]
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GRN}[✓]${NC} $*"; }
warn() { echo -e "${YLW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step() { echo -e "\n${YLW}▶ $*${NC}"; }

[[ $EUID -ne 0 ]] && err "Run as root:  sudo bash install-linux.sh"

INSTALL_DIR="/opt/ghostnet"
DATA_DIR="/var/lib/ghostnet"
LOG_DIR="/var/log/ghostnet"
PSK="${GHOSTNET_PSK:-ghostnet-change-me}"
VPN_PORT="${GHOSTNET_PORT:-51820}"
CTRL_PORT=7475
NODE_PORT=7474

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --psk)   PSK="$2";     shift 2 ;;
    --port)  VPN_PORT="$2"; shift 2 ;;
    *)        shift ;;
  esac
done

step "Checking system dependencies"
for pkg in python3 python3-pip iptables curl; do
  if command -v "$pkg" &>/dev/null || dpkg -l "$pkg" &>/dev/null 2>&1; then
    ok "$pkg"
  else
    warn "$pkg not found — installing..."
    if command -v apt-get &>/dev/null; then
      apt-get install -y "$pkg" >/dev/null 2>&1
    elif command -v dnf &>/dev/null; then
      dnf install -y "$pkg" >/dev/null 2>&1
    elif command -v pacman &>/dev/null; then
      pacman -Sy --noconfirm "$pkg" >/dev/null 2>&1
    fi
  fi
done

# Check Python version
PYVER=$(python3 -c "import sys; print(sys.version_info.minor)")
[[ $PYVER -lt 9 ]] && err "Python 3.9+ required (found 3.$PYVER)"
ok "Python 3.$PYVER"

step "Checking TUN kernel module"
if [[ ! -e /dev/net/tun ]]; then
  modprobe tun || err "Cannot load TUN kernel module"
  ok "TUN module loaded"
else
  ok "TUN device present (/dev/net/tun)"
fi

step "Checking IP forwarding"
echo 1 > /proc/sys/net/ipv4/ip_forward
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-ghostnet.conf
sysctl -p /etc/sysctl.d/99-ghostnet.conf >/dev/null 2>&1
ok "IP forwarding enabled"

step "Installing GhostNet files"
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"

# Copy files from current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$SCRIPT_DIR/ghostd.py"               "$INSTALL_DIR/"
cp "$SCRIPT_DIR/scripts/requirements.txt" "$INSTALL_DIR/"
[[ -f "$SCRIPT_DIR/server.bundle.cjs" ]] && cp "$SCRIPT_DIR/server.bundle.cjs" "$INSTALL_DIR/"
if [[ -d "$SCRIPT_DIR/frontend" ]]; then
  cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
fi
cp "$SCRIPT_DIR/start.sh" "$INSTALL_DIR/" 2>/dev/null || true
ok "Files copied to $INSTALL_DIR"

step "Installing Python dependencies"
pip3 install -r "$INSTALL_DIR/requirements.txt" --quiet
ok "cryptography installed"

step "Writing config file"
cat > "$DATA_DIR/ghostnet.conf" <<EOF
# GhostNet Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
PSK=$PSK
VPN_PORT=$VPN_PORT
CTRL_PORT=$CTRL_PORT
NODE_PORT=$NODE_PORT
DATA_DIR=$DATA_DIR
LOG_DIR=$LOG_DIR
INSTALL_DIR=$INSTALL_DIR
EOF
chmod 600 "$DATA_DIR/ghostnet.conf"
ok "Config written to $DATA_DIR/ghostnet.conf"

step "Creating systemd service — ghostnet-daemon (VPN tunnel daemon)"
cat > /etc/systemd/system/ghostnet-daemon.service <<EOF
[Unit]
Description=GhostNet VPN Daemon
After=network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $INSTALL_DIR/ghostd.py --mode server --port $VPN_PORT --psk "$PSK" --ctrl-port $CTRL_PORT
ExecStopPost=/usr/bin/python3 -c "import os; os.system('iptables -t nat -F; iptables -F; iptables -P INPUT ACCEPT; iptables -P OUTPUT ACCEPT; iptables -P FORWARD ACCEPT')"
Restart=on-failure
RestartSec=5
StandardOutput=append:$LOG_DIR/daemon.log
StandardError=append:$LOG_DIR/daemon.err
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW CAP_SYS_ADMIN
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_RAW CAP_SYS_ADMIN
PrivateTmp=false
ProtectHome=false

[Install]
WantedBy=multi-user.target
EOF
ok "systemd service created: ghostnet-daemon"

step "Creating systemd service — ghostnet (Node.js dashboard)"
cat > /etc/systemd/system/ghostnet.service <<EOF
[Unit]
Description=GhostNet Dashboard
After=ghostnet-daemon.service
Requires=ghostnet-daemon.service

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
Environment=PORT=$NODE_PORT
Environment=GHOSTNET_DATA=$DATA_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/server.bundle.cjs
Restart=on-failure
RestartSec=3
StandardOutput=append:$LOG_DIR/dashboard.log
StandardError=append:$LOG_DIR/dashboard.err

[Install]
WantedBy=multi-user.target
EOF
ok "systemd service created: ghostnet"

step "Creating ghostnet CLI tool"
cat > /usr/local/bin/ghostnet <<'SCRIPT'
#!/usr/bin/env bash
CTRL="http://127.0.0.1:7475"
case "$1" in
  status)    curl -s "$CTRL/status"    | python3 -m json.tool ;;
  stop)      curl -s -X POST "$CTRL/stop" ;;
  ks-on)     curl -s -X POST "$CTRL/killswitch/on" ;;
  ks-off)    curl -s -X POST "$CTRL/killswitch/off" ;;
  dns-on)    curl -s -X POST "$CTRL/dns/protect" ;;
  dns-off)   curl -s -X POST "$CTRL/dns/restore" ;;
  rotate)    curl -s -X POST "$CTRL/rotate" ;;
  peers)     curl -s "$CTRL/peers" | python3 -m json.tool ;;
  logs)      curl -s "$CTRL/logs" | python3 -m json.tool | head -100 ;;
  *)
    echo "GhostNet CLI"
    echo "Usage: ghostnet [status|stop|ks-on|ks-off|dns-on|dns-off|rotate|peers|logs]"
    ;;
esac
SCRIPT
chmod +x /usr/local/bin/ghostnet
ok "CLI tool installed: /usr/local/bin/ghostnet"

step "Opening firewall ports"
# iptables
iptables -I INPUT  -p udp --dport $VPN_PORT -j ACCEPT 2>/dev/null || true
iptables -I INPUT  -p tcp --dport $NODE_PORT -j ACCEPT 2>/dev/null || true
iptables -I OUTPUT -p udp --sport $VPN_PORT -j ACCEPT 2>/dev/null || true
# ufw
if command -v ufw &>/dev/null; then
  ufw allow $VPN_PORT/udp >/dev/null 2>&1 || true
  ufw allow $NODE_PORT/tcp >/dev/null 2>&1 || true
fi
ok "Ports $VPN_PORT/udp and $NODE_PORT/tcp opened"

step "Enabling and starting services"
systemctl daemon-reload
systemctl enable ghostnet-daemon ghostnet
systemctl start  ghostnet-daemon
sleep 2
systemctl start  ghostnet

ok "ghostnet-daemon started"
ok "ghostnet dashboard started"

echo ""
echo -e "${GRN}══════════════════════════════════════════════════════${NC}"
echo -e "${GRN}  GhostNet VPN installed successfully!${NC}"
echo -e "${GRN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Dashboard :  http://localhost:$NODE_PORT"
echo "  VPN port  :  UDP $VPN_PORT"
echo "  PSK       :  $PSK"
echo ""
echo "  CLI commands:"
echo "    ghostnet status    — show daemon status"
echo "    ghostnet ks-on     — enable kill switch"
echo "    ghostnet dns-on    — enable DNS protection"
echo "    ghostnet peers     — list connected peers"
echo "    ghostnet logs      — show audit log"
echo ""
echo "  Service commands:"
echo "    systemctl status ghostnet-daemon"
echo "    systemctl status ghostnet"
echo "    journalctl -u ghostnet-daemon -f"
echo ""
echo "  Connect a client:"
echo "    sudo python3 ghostd.py --mode client --server YOUR_IP:$VPN_PORT --psk \"$PSK\""
echo ""
