#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — macOS Installer
#  Installs the ProxhqVPN daemon and dashboard as launchd services.
#  Tested: macOS 12 Monterey+, macOS 13 Ventura, macOS 14 Sonoma
#
#  Run as root:
#    sudo bash install-macos.sh [--psk "your-strong-passphrase"] [--port 51820]
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GRN}[✓]${NC} $*"; }
warn() { echo -e "${YLW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step() { echo -e "\n${YLW}▶ $*${NC}"; }

[[ $EUID -ne 0 ]] && err "Run as root:  sudo bash install-macos.sh"

INSTALL_DIR="/opt/proxhqvpn"
DATA_DIR="/var/lib/proxhqvpn"
LOG_DIR="/var/log/proxhqvpn"
PSK="${PROXHQVPN_PSK:-proxhqvpn-change-me}"
VPN_PORT="${PROXHQVPN_PORT:-51820}"
CTRL_PORT=7475
NODE_PORT=7474

while [[ $# -gt 0 ]]; do
  case "$1" in
    --psk)   PSK="$2";     shift 2 ;;
    --port)  VPN_PORT="$2"; shift 2 ;;
    *)        shift ;;
  esac
done

step "Checking system dependencies"
if ! command -v python3 &>/dev/null; then
  err "Python 3 not found. Install from https://www.python.org/downloads/ or via Homebrew: brew install python3"
fi
PYVER=$(python3 -c "import sys; print(sys.version_info.minor)")
[[ $PYVER -lt 9 ]] && err "Python 3.9+ required (found 3.$PYVER)"
ok "Python 3.$PYVER"

if ! command -v pip3 &>/dev/null; then
  python3 -m ensurepip --upgrade
fi
ok "pip3"

step "Installing ProxhqVPN files"
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$SCRIPT_DIR/ghostd.py"                "$INSTALL_DIR/"
cp "$SCRIPT_DIR/scripts/requirements.txt" "$INSTALL_DIR/"
[[ -f "$SCRIPT_DIR/server.bundle.cjs" ]] && cp "$SCRIPT_DIR/server.bundle.cjs" "$INSTALL_DIR/"
if [[ -d "$SCRIPT_DIR/frontend" ]]; then
  cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
fi
ok "Files copied to $INSTALL_DIR"

step "Installing Python dependencies"
pip3 install -r "$INSTALL_DIR/requirements.txt" --quiet
ok "cryptography installed"

step "Writing config"
cat > "$DATA_DIR/proxhqvpn.conf" <<EOF
PSK=$PSK
VPN_PORT=$VPN_PORT
CTRL_PORT=$CTRL_PORT
NODE_PORT=$NODE_PORT
DATA_DIR=$DATA_DIR
EOF
chmod 600 "$DATA_DIR/proxhqvpn.conf"
ok "Config written"

step "Creating launchd plist — proxhqvpn-daemon"
cat > /Library/LaunchDaemons/com.proxhqvpn.daemon.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>com.proxhqvpn.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$INSTALL_DIR/ghostd.py</string>
    <string>--mode</string>  <string>server</string>
    <string>--port</string>  <string>$VPN_PORT</string>
    <string>--psk</string>   <string>$PSK</string>
    <string>--ctrl-port</string> <string>$CTRL_PORT</string>
  </array>
  <key>RunAtLoad</key>        <true/>
  <key>KeepAlive</key>        <true/>
  <key>UserName</key>         <string>root</string>
  <key>StandardOutPath</key>  <string>$LOG_DIR/daemon.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/daemon.err</string>
</dict>
</plist>
EOF
ok "launchd plist: com.proxhqvpn.daemon"

step "Creating launchd plist — proxhqvpn dashboard"
cat > /Library/LaunchDaemons/com.proxhqvpn.dashboard.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>com.proxhqvpn.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>$INSTALL_DIR/server.bundle.cjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>             <string>$NODE_PORT</string>
    <key>PROXHQVPN_DATA</key>   <string>$DATA_DIR</string>
  </dict>
  <key>WorkingDirectory</key>  <string>$INSTALL_DIR</string>
  <key>RunAtLoad</key>         <true/>
  <key>KeepAlive</key>         <true/>
  <key>UserName</key>          <string>root</string>
  <key>StandardOutPath</key>   <string>$LOG_DIR/dashboard.log</string>
  <key>StandardErrorPath</key> <string>$LOG_DIR/dashboard.err</string>
</dict>
</plist>
EOF
ok "launchd plist: com.proxhqvpn.dashboard"

step "Creating proxhqvpn CLI"
cat > /usr/local/bin/proxhqvpn <<'SCRIPT'
#!/usr/bin/env bash
CTRL="http://127.0.0.1:7475"
case "$1" in
  status)   curl -s "$CTRL/status" | python3 -m json.tool ;;
  stop)     curl -s -X POST "$CTRL/stop" ;;
  ks-on)    curl -s -X POST "$CTRL/killswitch/on" ;;
  ks-off)   curl -s -X POST "$CTRL/killswitch/off" ;;
  dns-on)   curl -s -X POST "$CTRL/dns/protect" ;;
  dns-off)  curl -s -X POST "$CTRL/dns/restore" ;;
  rotate)   curl -s -X POST "$CTRL/rotate" ;;
  peers)    curl -s "$CTRL/peers" | python3 -m json.tool ;;
  logs)     curl -s "$CTRL/logs" | python3 -m json.tool | head -100 ;;
  *)
    echo "Usage: proxhqvpn [status|stop|ks-on|ks-off|dns-on|dns-off|rotate|peers|logs]"
    ;;
esac
SCRIPT
chmod +x /usr/local/bin/proxhqvpn
ok "CLI installed: /usr/local/bin/proxhqvpn"

step "Opening firewall port $VPN_PORT/udp"
/usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/python3 2>/dev/null || true
ok "Firewall configured"

step "Loading launchd services"
launchctl load -w /Library/LaunchDaemons/com.proxhqvpn.daemon.plist
sleep 2
launchctl load -w /Library/LaunchDaemons/com.proxhqvpn.dashboard.plist

echo ""
echo -e "${GRN}══════════════════════════════════════════════════════${NC}"
echo -e "${GRN}  ProxhqVPN installed successfully!${NC}"
echo -e "${GRN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Dashboard :  http://localhost:$NODE_PORT"
echo "  VPN port  :  UDP $VPN_PORT"
echo "  PSK       :  $PSK"
echo ""
echo "  CLI:  proxhqvpn status | ks-on | dns-on | peers | logs"
echo ""
echo "  Service management:"
echo "    launchctl list | grep proxhqvpn"
echo "    tail -f $LOG_DIR/daemon.log"
echo ""
echo "  Connect a client:"
echo "    sudo python3 ghostd.py --mode client --server YOUR_IP:$VPN_PORT --psk \"$PSK\""
echo ""
