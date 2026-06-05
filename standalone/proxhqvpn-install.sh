#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — Universal Installer
#  Works on Linux (x64) and macOS (Apple Silicon + Intel)
#
#  ONE COMMAND INSTALL:
#    curl -fsSL https://get.proxhqvpn.app | bash
#
#  Or with options:
#    curl -fsSL https://get.proxhqvpn.app | bash -s -- --port 8080 --dir ~/proxhqvpn
#
#  What this does:
#    1. Detects your OS and chip type
#    2. Downloads the correct ProxhqVPN package
#    3. Extracts it to ~/ProxhqVPN (or your chosen folder)
#    4. Removes macOS quarantine flags automatically
#    5. Installs as a background service (optional)
#    6. Opens the dashboard in your browser
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; BLU='\033[0;34m'
YLW='\033[1;33m'; BLD='\033[1m';    NC='\033[0m'
ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
info() { echo -e "  ${BLU}→${NC}  $*"; }
warn() { echo -e "  ${YLW}!${NC}  $*"; }
err()  { echo -e "\n  ${RED}✗  ERROR:${NC}  $*\n"; exit 1; }
step() { echo -e "\n${BLD}${YLW}▶ $*${NC}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GRN}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${GRN}  ║       PROXHQVPN — INSTALLER v3.0         ║${NC}"
echo -e "${GRN}  ╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Defaults ─────────────────────────────────────────────────────────────────
INSTALL_DIR="${HOME}/ProxhqVPN"
PORT=7474
INSTALL_SERVICE=false
BASE_URL="https://releases.proxhqvpn.app"   # ← update when hosting releases

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --port)    PORT="$2";        shift 2 ;;
    --service) INSTALL_SERVICE=true; shift ;;
    --help|-h)
      echo "Usage: curl -fsSL https://get.proxhqvpn.app | bash -s -- [OPTIONS]"
      echo ""
      echo "  --dir    <path>   Install location (default: ~/ProxhqVPN)"
      echo "  --port   <port>   Dashboard port   (default: 7474)"
      echo "  --service         Install as background service (systemd/launchd)"
      echo "  --help            Show this help"
      exit 0 ;;
    *) shift ;;
  esac
done

# ── Detect OS and architecture ────────────────────────────────────────────────
step "Detecting your system"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    OS_LABEL="Linux"
    case "$ARCH" in
      x86_64)  PACKAGE="ProxhqVPN-Linux-x64" ;;
      aarch64) err "Linux ARM64 is not yet supported. Use the Universal package:\n  Download Node.js 20+ from https://nodejs.org then use ProxhqVPN-Universal-NodeJS.zip" ;;
      *)       err "Unknown Linux architecture: $ARCH" ;;
    esac
    ;;
  Darwin)
    OS_LABEL="macOS"
    case "$ARCH" in
      arm64)  PACKAGE="ProxhqVPN-macOS-arm64" ;;
      x86_64) PACKAGE="ProxhqVPN-macOS-x64"   ;;
      *)      err "Unknown macOS architecture: $ARCH" ;;
    esac
    ;;
  *)
    err "Unsupported OS: $OS\n  Windows users: run the PowerShell installer instead:\n  irm https://get.proxhqvpn.app/win | iex"
    ;;
esac

ok "$OS_LABEL ($ARCH) — using $PACKAGE"

# ── Check for download tool ───────────────────────────────────────────────────
if command -v curl &>/dev/null; then
  DOWNLOADER="curl"
elif command -v wget &>/dev/null; then
  DOWNLOADER="wget"
else
  err "Neither curl nor wget found. Install one:\n  sudo apt install curl   (Ubuntu/Debian)\n  brew install curl       (macOS)"
fi
ok "Download tool: $DOWNLOADER"

# ── Check port availability ───────────────────────────────────────────────────
step "Checking port $PORT availability"
if command -v lsof &>/dev/null && lsof -iTCP:"$PORT" -sTCP:LISTEN &>/dev/null 2>&1; then
  warn "Port $PORT is in use. Trying $((PORT + 1))..."
  PORT=$((PORT + 1))
  if lsof -iTCP:"$PORT" -sTCP:LISTEN &>/dev/null 2>&1; then
    err "Ports $((PORT - 1)) and $PORT are both in use.\n  Stop the conflicting process or specify a different port:\n  curl -fsSL https://get.proxhqvpn.app | bash -s -- --port 8080"
  fi
fi
ok "Port $PORT is available"

# ── Download ──────────────────────────────────────────────────────────────────
step "Downloading ProxhqVPN"

ZIP_NAME="${PACKAGE}.zip"
DOWNLOAD_URL="${BASE_URL}/${ZIP_NAME}"
TMP_DIR="$(mktemp -d)"
TMP_ZIP="${TMP_DIR}/${ZIP_NAME}"

info "From: $DOWNLOAD_URL"
info "To:   $TMP_ZIP"

if [[ "$DOWNLOADER" == "curl" ]]; then
  curl -fsSL --progress-bar -o "$TMP_ZIP" "$DOWNLOAD_URL" || {
    # Fallback: try local copy if URL not reachable (development mode)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || SCRIPT_DIR="."
    LOCAL_ZIP="${SCRIPT_DIR}/dist/${ZIP_NAME}"
    if [[ -f "$LOCAL_ZIP" ]]; then
      warn "Remote URL not reachable — using local build at $LOCAL_ZIP"
      cp "$LOCAL_ZIP" "$TMP_ZIP"
    else
      err "Could not download ProxhqVPN.\n  Check your internet connection.\n  Or download manually from: https://proxhqvpn.app/download"
    fi
  }
else
  wget -q --show-progress -O "$TMP_ZIP" "$DOWNLOAD_URL" || {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || SCRIPT_DIR="."
    LOCAL_ZIP="${SCRIPT_DIR}/dist/${ZIP_NAME}"
    if [[ -f "$LOCAL_ZIP" ]]; then
      warn "Remote URL not reachable — using local build"
      cp "$LOCAL_ZIP" "$TMP_ZIP"
    else
      err "Download failed. Check your internet connection."
    fi
  }
fi

ok "Downloaded ${ZIP_NAME}"

# ── Extract ───────────────────────────────────────────────────────────────────
step "Installing to $INSTALL_DIR"

if [[ -d "$INSTALL_DIR" ]]; then
  warn "Folder already exists — backing up to ${INSTALL_DIR}.bak"
  rm -rf "${INSTALL_DIR}.bak"
  mv "$INSTALL_DIR" "${INSTALL_DIR}.bak"
fi

mkdir -p "$INSTALL_DIR"
unzip -q "$TMP_ZIP" -d "$TMP_DIR/extracted"

# Find the extracted folder (may be inside a subdirectory)
EXTRACTED=$(find "$TMP_DIR/extracted" -maxdepth 1 -mindepth 1 -type d | head -1)
[[ -z "$EXTRACTED" ]] && EXTRACTED="$TMP_DIR/extracted"

cp -r "$EXTRACTED/." "$INSTALL_DIR/"
rm -rf "$TMP_DIR"

ok "Installed to $INSTALL_DIR"

# ── Fix permissions ───────────────────────────────────────────────────────────
step "Setting permissions"
chmod +x "${INSTALL_DIR}/ProxhqVPN"   2>/dev/null || true
chmod +x "${INSTALL_DIR}/start.sh"   2>/dev/null || true
chmod +x "${INSTALL_DIR}/ghostd.py"  2>/dev/null || true
ok "Permissions set"

# ── macOS: Remove quarantine flag ─────────────────────────────────────────────
if [[ "$OS" == "Darwin" ]]; then
  step "Removing macOS quarantine flag"
  xattr -cr "$INSTALL_DIR" 2>/dev/null || true
  ok "Quarantine flag removed — Gatekeeper will not block ProxhqVPN"
fi

# ── Inject custom port if not default ────────────────────────────────────────
if [[ "$PORT" != "7474" ]]; then
  info "Configuring port $PORT"
  # Patch start.sh to use custom port
  if [[ -f "${INSTALL_DIR}/start.sh" ]]; then
    sed -i.bak "s/localhost:7474/localhost:${PORT}/g" "${INSTALL_DIR}/start.sh"
    rm -f "${INSTALL_DIR}/start.sh.bak"
  fi
fi

# ── Optional: install as background service ───────────────────────────────────
if [[ "$INSTALL_SERVICE" == "true" ]]; then
  step "Installing background service"

  if [[ "$OS" == "Linux" ]]; then
    if ! command -v systemctl &>/dev/null; then
      warn "systemd not found — skipping service install"
    else
      USERNAME="$(whoami)"
      SERVICE_FILE="/etc/systemd/system/proxhqvpn.service"
      BINARY="${INSTALL_DIR}/ProxhqVPN"

      if [[ $EUID -ne 0 ]]; then
        warn "Service install requires root. Running without service install."
        warn "To install the service manually later:"
        warn "  sudo bash ${INSTALL_DIR}/scripts/install-linux.sh"
      else
        cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ProxhqVPN Platform
After=network.target

[Service]
Type=simple
User=${USERNAME}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${BINARY}
Restart=on-failure
RestartSec=5
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        systemctl enable proxhqvpn
        systemctl start proxhqvpn
        ok "systemd service installed and started"
        ok "Manage with: sudo systemctl {start|stop|status|restart} proxhqvpn"
      fi
    fi

  elif [[ "$OS" == "Darwin" ]]; then
    PLIST="${HOME}/Library/LaunchAgents/app.proxhqvpn.plist"
    mkdir -p "${HOME}/Library/LaunchAgents"
    cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>app.proxhqvpn</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/ProxhqVPN</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${PORT}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/proxhqvpn.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/proxhqvpn-error.log</string>
</dict>
</plist>
EOF
    launchctl load "$PLIST" 2>/dev/null || launchctl bootstrap gui/"$(id -u)" "$PLIST" 2>/dev/null || true
    ok "launchd service installed (auto-starts on login)"
    ok "Logs: ~/Library/Logs/proxhqvpn.log"
  fi
fi

# ── Launch (if not running as a service) ─────────────────────────────────────
if [[ "$INSTALL_SERVICE" != "true" ]]; then
  step "Launching ProxhqVPN"
  info "Starting on http://localhost:${PORT}"
  info "Press Ctrl+C at any time to stop"
  echo ""
  echo -e "${GRN}  ════════════════════════════════════════════════${NC}"
  echo -e "${GRN}  ✓  ProxhqVPN installed at: ${INSTALL_DIR}${NC}"
  echo -e "${GRN}  ✓  Dashboard:   http://localhost:${PORT}${NC}"
  echo -e "${GRN}  ════════════════════════════════════════════════${NC}"
  echo ""

  # Open browser after 2s
  (sleep 2 && {
    if command -v xdg-open &>/dev/null; then xdg-open "http://localhost:${PORT}"
    elif command -v open &>/dev/null;   then open    "http://localhost:${PORT}"
    fi
  }) &

  cd "$INSTALL_DIR"
  PORT="$PORT" ./ProxhqVPN
else
  echo ""
  echo -e "${GRN}  ════════════════════════════════════════════════${NC}"
  echo -e "${GRN}  ✓  ProxhqVPN installed at: ${INSTALL_DIR}${NC}"
  echo -e "${GRN}  ✓  Running as background service${NC}"
  echo -e "${GRN}  ✓  Dashboard:   http://localhost:${PORT}${NC}"
  echo -e "${GRN}  ════════════════════════════════════════════════${NC}"
  echo ""
  echo "  To open the dashboard:"
  echo "    open http://localhost:${PORT}   (macOS)"
  echo "    xdg-open http://localhost:${PORT}   (Linux)"
  echo ""
  echo "  To stop the service:"
  if [[ "$OS" == "Linux" ]]; then
    echo "    sudo systemctl stop proxhqvpn"
  else
    echo "    launchctl unload ~/Library/LaunchAgents/app.proxhqvpn.plist"
  fi
  echo ""
fi
