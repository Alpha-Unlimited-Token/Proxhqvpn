#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — Linux Setup Wizard  v5.1
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#
#  Run:  bash Launch-ProxhqVPN-Setup.sh
#  Works on: Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch, openSUSE
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BASE_URL="https://proxhqvpn.com"
TUNNEL_MODE="split"
CONFS_INSTALLED=()
ACTIVE_TUNNEL=""
WG_CONF_DIR="/etc/wireguard"
INSTALL="$HOME/.config/proxhqvpn"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$INSTALL/install.log"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; BLU='\033[0;34m'
YLW='\033[1;33m'; CYN='\033[0;36m'; DIM='\033[2m'
BLD='\033[1m';    NC='\033[0m'
ok()   { echo -e "  ${GRN}✓${NC}  $*"; write_log "INFO" "$*"; }
info() { echo -e "  ${BLU}→${NC}  $*"; write_log "INFO" "$*"; }
warn() { echo -e "  ${YLW}!${NC}  $*"; write_log "WARN" "$*"; }
err()  { echo -e "\n  ${RED}✗  ERROR:${NC}  $*\n"; write_log "ERROR" "$*"; }
sep()  { echo -e "${DIM}──────────────────────────────────────────────────────${NC}"; }

# ── Logging ───────────────────────────────────────────────────────────────────
write_log() {
  local level="$1"; shift
  mkdir -p "$INSTALL" 2>/dev/null || true
  printf '[%s]  [%-5s]  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

# ── ZIP checksum verification ─────────────────────────────────────────────────
verify_checksum() {
  local zip_path="$1"
  local sha_url="${BASE_URL}/downloads/proxhqvpn-all-servers.zip.sha256"
  info "Verifying zip integrity..."
  write_log "INFO" "Checksum URL: $sha_url"

  local remote_hash
  remote_hash=$(curl -fsSL --max-time 10 "$sha_url" 2>/dev/null | awk '{print $1}' | tr -d '[:space:]') || true

  if [[ -z "$remote_hash" ]]; then
    warn "Could not fetch checksum (network or endpoint not yet live) — skipping"
    write_log "WARN" "Checksum fetch failed — skipping"
    return 0
  fi

  local local_hash
  local_hash=$(sha256sum "$zip_path" 2>/dev/null | awk '{print $1}') || \
    local_hash=$(shasum -a 256 "$zip_path" 2>/dev/null | awk '{print $1}') || true

  if [[ "$remote_hash" == "$local_hash" ]]; then
    ok "Checksum verified ✓  ($local_hash)"
    write_log "INFO" "Checksum OK: $local_hash"
  else
    err "CHECKSUM MISMATCH — the downloaded zip may be tampered or corrupted."
    write_log "ERROR" "Checksum MISMATCH: expected=$remote_hash got=$local_hash"
    echo -e "\n  ${RED}Delete the zip from ~/Downloads and try again.${NC}\n"
    exit 1
  fi
}

# ── Support bundle export ─────────────────────────────────────────────────────
export_support_bundle() {
  local bundle_name="ProxhqVPN-Support-$(date +%Y%m%d).zip"
  local bundle_path="$HOME/Desktop/$bundle_name"
  mkdir -p "$HOME/Desktop" 2>/dev/null || true
  local tmp_dir; tmp_dir=$(mktemp -d)

  [[ -f "$LOG_FILE" ]]             && cp "$LOG_FILE"           "$tmp_dir/install.log"
  [[ -f "$INSTALL/config.json" ]]  && cp "$INSTALL/config.json" "$tmp_dir/config.json"

  {
    echo "=== ProxhqVPN Support Report ==="
    echo "Date:     $(date -u)"
    echo "Distro:   $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"' || echo unknown)"
    echo "Kernel:   $(uname -r)"
    echo "Arch:     $(uname -m)"
    echo "Hostname: $(hostname -s)"
    echo "Tunnels installed: ${#CONFS_INSTALLED[@]}"
    echo "Active tunnel: ${ACTIVE_TUNNEL:-none}"
    echo "=== wg show ==="
    sudo wg show 2>/dev/null || echo "(no active tunnels)"
    echo "=== systemd wg-quick services ==="
    systemctl list-units 'wg-quick@*' 2>/dev/null || echo "(systemctl not available)"
  } > "$tmp_dir/system-info.txt"

  if command -v python3 &>/dev/null; then
    python3 -c "
import zipfile, os
with zipfile.ZipFile('$bundle_path', 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in os.listdir('$tmp_dir'):
        zf.write(os.path.join('$tmp_dir', f), f)
" 2>/dev/null && ok "Support bundle: $bundle_path" || warn "Could not create support bundle"
  elif command -v zip &>/dev/null; then
    (cd "$tmp_dir" && zip -q "$bundle_path" ./*) && ok "Support bundle: $bundle_path" || true
  else
    warn "Cannot create zip (no python3 or zip). Log at: $LOG_FILE"
  fi

  rm -rf "$tmp_dir"
  write_log "INFO" "Support bundle exported: $bundle_path"
}

banner(){
  clear 2>/dev/null || true
  echo -e "\n${GRN}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GRN}${BLD}  ║        PROXHQVPN — LINUX SETUP WIZARD  v5.1  ║${NC}"
  echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
  echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"
}

show_step(){
  local n=$1 label=$2 total=6 i=0
  echo -e "${GRN}${BLD}  ┌── Step $n/$total ─────────────────────────────────────┐${NC}"
  echo -e "${GRN}${BLD}  │  $label${NC}"
  local filled=$(( n * 46 / total ))
  printf "${GRN}${BLD}  │  ["
  while (( i < filled )); do printf "█"; (( i++ )); done
  while (( i < 46 ));    do printf "░"; (( i++ )); done
  echo -e "] $(( n * 100 / total ))%%  ${NC}"
  echo -e "${GRN}${BLD}  └────────────────────────────────────────────────────┘${NC}\n"
}

press_enter(){ read -rp "  Press Enter to continue..."; }
confirm(){     read -rp "  $1 [Y/n] " _c; [[ "${_c:-y}" =~ ^[Yy]$ ]]; }

# ── Tunnel-name helpers ───────────────────────────────────────────────────────
region_flag() {
  case "$1" in *london*) echo "🇬🇧";; *chicago*) echo "🇺🇸";; *los*) echo "🇺🇸";; *tokyo*) echo "🇯🇵";; *) echo "🌐";; esac
}
region_label() {
  echo "${1#proxhqvpn-}" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 0 — WELCOME
# ═════════════════════════════════════════════════════════════════════════════
write_log "INFO" "ProxhqVPN Linux installer v5.1 started"
write_log "INFO" "System: $(uname -s) $(uname -r) $(uname -m)"
write_log "INFO" "Host: $(hostname -s)"
write_log "INFO" "Distro: $(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo unknown)"

banner
show_step 1 "Welcome"
echo -e "  ${BLD}Welcome to ProxhqVPN Linux Setup${NC}"
echo -e "  ${DIM}All 4 server tunnels install at once — switch anytime.${NC}\n"
echo -e "  ${GRN}⚡${NC}  WireGuard installed automatically via your package manager"
echo -e "  ${GRN}🌍${NC}  4 servers: Los Angeles · Chicago · London · Tokyo"
echo -e "  ${GRN}🔄${NC}  Switch servers at any time — Desktop switcher included"
echo -e "  ${GRN}🛡${NC}  Split Tunnel (recommended) or Full Tunnel mode"
echo -e "  ${GRN}🌐${NC}  Sign in once → all configs install automatically"
echo -e "  ${GRN}🧹${NC}  Zero-logs policy — no traffic stored or monitored\n"
echo -e "  ${DIM}Servers included:${NC}"
echo -e "  ${DIM}  🇺🇸  Los Angeles, US — 108.61.219.202${NC}"
echo -e "  ${DIM}  🇺🇸  Chicago, US    — 45.63.79.138${NC}"
echo -e "  ${DIM}  🇬🇧  London, GB     — 192.248.160.69${NC}"
echo -e "  ${DIM}  🇯🇵  Tokyo, JP      — 45.76.97.51${NC}\n"
sep
confirm "Continue with installation?" || { echo -e "\n  Setup cancelled.\n"; exit 0; }

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 1 — LICENSE + TUNNEL MODE
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 2 "License Agreement"
echo -e "  ${BLD}ProxhqVPN End User License Agreement${NC}\n"
cat <<'EOF'
  ┌────────────────────────────────────────────────────────────┐
  │  PROXHQVPN EULA — © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC │
  │                                                            │
  │  1. LICENSE — Personal use on devices you own.            │
  │  2. WIREGUARD — ProxhqVPN installs WireGuard (GPLv2).     │
  │     By proceeding you authorize its installation.          │
  │  3. ZERO LOGS — No traffic or connection data stored.      │
  │  4. LIABILITY — No indirect or consequential damages.      │
  │  WireGuard® is a trademark of Jason A. Donenfeld.         │
  └────────────────────────────────────────────────────────────┘
EOF
echo ""
confirm "I accept the license and consent to WireGuard installation?" || {
  echo -e "\n  You must accept the license to continue.\n"; exit 0
}
ok "License accepted"

banner
show_step 2 "Tunnel Mode"
echo -e "  ${BLD}Choose your VPN tunnel mode:${NC}\n"
echo -e "  ${GRN}[1]${NC}  ${BLD}⚡ Split Tunnel  (Recommended)${NC}"
echo -e "       Only ProxhqVPN traffic tunnelled — apps work at full speed.\n"
echo -e "  ${YLW}[2]${NC}  ${BLD}🔒 Full Tunnel${NC}"
echo -e "       ALL internet traffic via ProxhqVPN — maximum privacy.\n"
sep
read -rp "  Enter choice [1/2, default=1]: " TMCHOICE
case "${TMCHOICE:-1}" in
  2) TUNNEL_MODE="full"; warn "Full Tunnel selected — all traffic via ProxhqVPN" ;;
  *) TUNNEL_MODE="split"; ok "Split Tunnel selected (recommended)" ;;
esac

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 2 — WIREGUARD INSTALL
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 3 "Installing WireGuard"
echo -e "  ${BLD}Installing WireGuard${NC}"
echo -e "  ${DIM}Checking for existing installation...${NC}\n"

install_wg(){
  if command -v apt-get &>/dev/null; then
    info "Ubuntu/Debian — apt-get install wireguard-tools"
    sudo apt-get update -qq 2>&1 | tail -2 || true
    sudo apt-get install -y wireguard-tools 2>&1 | tail -5
  elif command -v dnf &>/dev/null; then
    info "Fedora/RHEL — dnf install wireguard-tools"
    sudo dnf install -y wireguard-tools 2>&1 | tail -5
  elif command -v yum &>/dev/null; then
    info "CentOS/RHEL — yum + EPEL"
    sudo yum install -y epel-release 2>&1 | tail -2 || true
    sudo yum install -y wireguard-tools 2>&1 | tail -5
  elif command -v pacman &>/dev/null; then
    info "Arch Linux — pacman -S wireguard-tools"
    sudo pacman -Sy --noconfirm wireguard-tools 2>&1 | tail -5
  elif command -v zypper &>/dev/null; then
    info "openSUSE — zypper install wireguard-tools"
    sudo zypper install -y wireguard-tools 2>&1 | tail -5
  elif command -v make &>/dev/null && command -v git &>/dev/null; then
    warn "Unknown distro — building wireguard-tools from source..."
    local TMP; TMP=$(mktemp -d)
    git clone --depth 1 https://git.zx2c4.com/wireguard-tools "$TMP/wg" 2>&1 | tail -3
    make -C "$TMP/wg/src" -j"$(nproc 2>/dev/null || echo 2)" 2>&1 | tail -3
    sudo make -C "$TMP/wg/src" install 2>&1 | tail -3
    rm -rf "$TMP"
  else
    return 1
  fi
}

WG_BUNDLED="$SCRIPT_DIR/wireguard/wg"

if command -v wg &>/dev/null; then
  ok "WireGuard already installed: $(command -v wg)"
elif [[ -f "$WG_BUNDLED" ]]; then
  info "Using bundled wireguard-tools..."
  if sudo install -m 755 "$WG_BUNDLED" /usr/local/bin/wg 2>/dev/null; then
    [[ -f "$SCRIPT_DIR/wireguard/wg-quick" ]] && \
      sudo install -m 755 "$SCRIPT_DIR/wireguard/wg-quick" /usr/local/bin/wg-quick 2>/dev/null || true
  else
    mkdir -p "$HOME/.local/bin"
    install -m 755 "$WG_BUNDLED" "$HOME/.local/bin/wg"
    [[ -f "$SCRIPT_DIR/wireguard/wg-quick" ]] && \
      install -m 755 "$SCRIPT_DIR/wireguard/wg-quick" "$HOME/.local/bin/wg-quick" || true
    export PATH="$HOME/.local/bin:$PATH"
  fi
  ok "Bundled WireGuard installed"
else
  info "Installing WireGuard via package manager..."
  if install_wg; then
    ok "WireGuard installed successfully"
  else
    warn "Automatic install failed. Install manually then re-run:"
    echo -e "  ${DIM}  Ubuntu/Debian:  sudo apt install wireguard-tools${NC}"
    echo -e "  ${DIM}  Fedora:         sudo dnf install wireguard-tools${NC}"
    echo -e "  ${DIM}  Arch:           sudo pacman -S wireguard-tools${NC}"
    press_enter
  fi
fi

# Enable IPv4 forwarding
sudo sysctl -w net.ipv4.ip_forward=1 &>/dev/null || true
grep -qxF 'net.ipv4.ip_forward=1' /etc/sysctl.conf 2>/dev/null || \
  echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf &>/dev/null || true
ok "IPv4 forwarding enabled"
ok "WireGuard ready ✓"
echo ""
press_enter

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 3 — SIGN IN
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 4 "Sign In — Automatic Download"
echo -e "  ${BLD}Sign in once — everything else is automatic${NC}\n"
echo -e "  ${GRN}🔑${NC}  Sign in to ProxhqVPN in your browser"
echo -e "  ${GRN}⚙${NC}   ProxhqVPN generates your personal keys for all 4 servers"
echo -e "  ${GRN}📦${NC}  Configs download automatically — this installer detects them"
echo -e "  ${GRN}✅${NC}  VPN live — switch servers anytime, no reinstall\n"
sep

REDIRECT_PATH="/autosetup?tunnelmode=${TUNNEL_MODE}&hostname=$(hostname -s)"
ENCODED_REDIRECT=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" \
  "$REDIRECT_PATH" 2>/dev/null || printf '%s' "$REDIRECT_PATH" | sed 's| |%20|g; s|?|%3F|g; s|=|%3D|g; s|&|%26|g')
SIGNIN_URL="${BASE_URL}/sign-in?redirect_url=${ENCODED_REDIRECT}"

info "Opening browser..."
if command -v xdg-open   &>/dev/null; then xdg-open   "$SIGNIN_URL" &>/dev/null &
elif command -v firefox  &>/dev/null; then firefox     "$SIGNIN_URL" &>/dev/null &
elif command -v chromium &>/dev/null; then chromium    "$SIGNIN_URL" &>/dev/null &
elif command -v google-chrome &>/dev/null; then google-chrome "$SIGNIN_URL" &>/dev/null &
else
  echo -e "\n  ${YLW}Cannot open browser automatically. Open this URL manually:${NC}"
  echo -e "  ${CYN}${BLD}$SIGNIN_URL${NC}\n"
fi

DL_DIR="$HOME/Downloads"
ZIP_TARGET="proxhqvpn-all-servers.zip"
WAIT_SEC=600; ELAPSED=0; FOUND_ZIP=""
SPIN=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏"); SI=0

echo ""
echo -e "  ${DIM}Watching $DL_DIR for $ZIP_TARGET ...${NC}"
echo -e "  ${DIM}Sign in — configs download themselves. Nothing else to do.${NC}\n"

while [[ $ELAPSED -lt $WAIT_SEC ]]; do
  sleep 2
  ELAPSED=$(( ELAPSED + 2 ))
  ZIP_PATH="$DL_DIR/$ZIP_TARGET"

  if [[ -f "$ZIP_PATH" ]]; then
    SZ1=$(stat -c%s "$ZIP_PATH" 2>/dev/null || echo 0)
    sleep 1
    SZ2=$(stat -c%s "$ZIP_PATH" 2>/dev/null || echo 0)
    if [[ "$SZ1" -gt 0 && "$SZ1" == "$SZ2" ]]; then
      FOUND_ZIP="$ZIP_PATH"; break
    fi
  fi

  REMAINING=$(( WAIT_SEC - ELAPSED ))
  SI=$(( (SI + 1) % ${#SPIN[@]} ))
  printf "\r  ${GRN}%s${NC}  Waiting ... %dm %ds remaining     " \
    "${SPIN[$SI]}" "$(( REMAINING / 60 ))" "$(( REMAINING % 60 ))"
done
echo ""

if [[ -z "$FOUND_ZIP" ]]; then
  warn "Timed out — no config pack detected after 10 minutes."
  echo -e "  ${DIM}Download proxhqvpn-all-servers.zip from My VPN and re-run this installer.${NC}\n"
  exit 1
fi
ok "Detected: $ZIP_TARGET  ($(stat -c%s "$FOUND_ZIP" 2>/dev/null || echo ?) bytes)"
write_log "INFO" "Zip path: $FOUND_ZIP"

verify_checksum "$FOUND_ZIP"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 4 — INSTALL TUNNELS
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 5 "Installing All Tunnels"
echo -e "  ${BLD}Installing all VPN tunnel configs...${NC}\n"

# Fallback conf dir if /etc/wireguard not writable
[[ ! -w "$WG_CONF_DIR" ]] && WG_CONF_DIR="$HOME/.config/wireguard"
mkdir -p "$WG_CONF_DIR"
mkdir -p "$INSTALL"

TMP_EXTRACT=$(mktemp -d)
info "Extracting configs..."
unzip -q "$FOUND_ZIP" -d "$TMP_EXTRACT"

# ── FIX: bash 4-compatible file collection with -print0 / -d '' ──────────────
CONF_FILES=()
while IFS= read -r -d '' f; do
  CONF_FILES+=("$f")
done < <(find "$TMP_EXTRACT" -name "proxhqvpn-*.conf" -print0 2>/dev/null)

TOTAL=${#CONF_FILES[@]}
echo -e "  ${DIM}Found $TOTAL config(s)${NC}\n"

if [[ $TOTAL -eq 0 ]]; then
  err "No proxhqvpn-*.conf files found in zip. Try re-downloading."
  rm -rf "$TMP_EXTRACT"; exit 1
fi

IDX=0
for CF in "${CONF_FILES[@]}"; do
  IDX=$(( IDX + 1 ))
  TN=$(basename "$CF" .conf)
  printf "  ${GRN}[%d/%d]${NC} %s ... " "$IDX" "$TOTAL" "$TN"

  # ── FIX: properly replace the WHOLE AllowedIPs line for split tunnel ─────────
  if [[ "$TUNNEL_MODE" == "split" ]]; then
    # Replace any AllowedIPs line that contains 0.0.0.0/0 with the split range
    sed -i 's|^[[:space:]]*AllowedIPs[[:space:]]*=.*0\.0\.0\.0/0.*|AllowedIPs = 10.8.0.0/24|' "$CF" 2>/dev/null || true
    # If AllowedIPs line is now blank or still has 0.0.0.0, force-replace it
    if grep -qE '^[[:space:]]*AllowedIPs[[:space:]]*=[[:space:]]*$' "$CF" 2>/dev/null; then
      sed -i 's|^[[:space:]]*AllowedIPs[[:space:]]*=[[:space:]]*$|AllowedIPs = 10.8.0.0/24|' "$CF" 2>/dev/null || true
    fi
    if ! grep -qE '^[[:space:]]*AllowedIPs' "$CF" 2>/dev/null; then
      printf '\nAllowedIPs = 10.8.0.0/24\n' >> "$CF"
    fi
  fi

  DEST="$WG_CONF_DIR/$TN.conf"
  cp "$CF" "$DEST"
  chmod 600 "$DEST"

  if command -v wg-quick &>/dev/null; then
    sudo wg-quick down "$TN" 2>/dev/null || true
    if sudo wg-quick up "$DEST" 2>/dev/null; then
      echo -e "${GRN}✓ active${NC}"
      CONFS_INSTALLED+=("$TN")
      ACTIVE_TUNNEL="$TN"
    else
      echo -e "${YLW}⚠ saved (not started — run: sudo wg-quick up $TN)${NC}"
      CONFS_INSTALLED+=("$TN")
    fi
  else
    echo -e "${BLU}→ saved${NC}"
    CONFS_INSTALLED+=("$TN")
  fi
done
rm -rf "$TMP_EXTRACT"

# ── FIX: write config.json (matches Windows + macOS) ─────────────────────────
JSON_TUNNELS="["
for tn in "${CONFS_INSTALLED[@]}"; do
  JSON_TUNNELS+="\"${tn}\","
done
JSON_TUNNELS="${JSON_TUNNELS%,}]"

cat > "$INSTALL/config.json" <<EOF
{
  "tunnelMode": "$TUNNEL_MODE",
  "hostname": "$(hostname -s)",
  "version": "5.1",
  "wgConfDir": "$WG_CONF_DIR",
  "installedTunnels": $JSON_TUNNELS
}
EOF
ok "Saved config: $INSTALL/config.json"

# ── Desktop shortcuts ──────────────────────────────────────────────────────────
mkdir -p "$HOME/Desktop" 2>/dev/null || true

SWITCH_SRC="$SCRIPT_DIR/SwitchServer-Linux.sh"
SWITCH_DEST="$HOME/Desktop/switch-vpn-server.sh"
if [[ -f "$SWITCH_SRC" ]]; then
  cp "$SWITCH_SRC" "$SWITCH_DEST"
  chmod +x "$SWITCH_DEST"
  ok "Switcher saved: ~/Desktop/switch-vpn-server.sh"
fi

DESKTOP_FILE="$HOME/Desktop/ProxhqVPN.desktop"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=ProxhqVPN
Comment=Open ProxhqVPN Dashboard
Exec=xdg-open https://proxhqvpn.com/dashboard
Icon=security-high
Terminal=false
Type=Application
Categories=Network;
EOF
chmod +x "$DESKTOP_FILE" 2>/dev/null || true
ok "Desktop shortcut: ProxhqVPN"

# ── FIX: systemctl enable --now (starts immediately, not just on next boot) ───
if command -v systemctl &>/dev/null && [[ ${#CONFS_INSTALLED[@]} -gt 0 ]]; then
  FIRST_TN="${CONFS_INSTALLED[0]}"
  if systemctl is-active --quiet "wg-quick@${FIRST_TN}" 2>/dev/null; then
    ok "wg-quick@${FIRST_TN} already running"
  else
    sudo systemctl enable --now "wg-quick@${FIRST_TN}" 2>/dev/null || \
      sudo systemctl enable "wg-quick@${FIRST_TN}" 2>/dev/null || true
    ok "wg-quick@${FIRST_TN} enabled and started (auto-starts on boot)"
  fi
fi

# ── Uninstall script ───────────────────────────────────────────────────────────
cat > "$INSTALL/uninstall.sh" <<'UNEOF'
#!/usr/bin/env bash
# ProxhqVPN uninstaller
echo "Removing ProxhqVPN tunnels and configs..."
for f in /etc/wireguard/proxhqvpn-*.conf ~/.config/wireguard/proxhqvpn-*.conf; do
  [[ -f "$f" ]] || continue
  TN=$(basename "$f" .conf)
  sudo wg-quick down "$TN" 2>/dev/null || true
  sudo systemctl disable --now "wg-quick@${TN}" 2>/dev/null || true
  sudo rm -f "$f"
  echo "  Removed: $f"
done
rm -f ~/Desktop/ProxhqVPN.desktop ~/Desktop/switch-vpn-server.sh
echo "Done."
UNEOF
chmod +x "$INSTALL/uninstall.sh"
ok "Uninstaller saved: $INSTALL/uninstall.sh"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 5 — DONE
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 6 "Done!"
echo ""
echo -e "  ${GRN}${BLD}✓  ${#CONFS_INSTALLED[@]} VPN tunnel(s) installed${NC}"
echo -e "  ${GRN}${BLD}✓  Tunnel mode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "  ${GRN}${BLD}✓  Configs: $WG_CONF_DIR${NC}"
echo -e "  ${GRN}${BLD}✓  Config saved: $INSTALL/config.json${NC}\n"
echo -e "  ${BLD}INSTALLED SERVERS:${NC}"
for TN in "${CONFS_INSTALLED[@]}"; do
  FLAG=$(region_flag "$TN"); REGION=$(region_label "$TN")
  echo -e "  ${FLAG}  ${BLD}${REGION}${NC}  ${DIM}(${TN})${NC}"
done
echo ""
echo -e "  ${DIM}Switch servers:     bash ~/Desktop/switch-vpn-server.sh${NC}"
echo -e "  ${DIM}Manual control:     sudo wg-quick up/down <tunnel-name>${NC}"
echo -e "  ${DIM}Status:             sudo wg show${NC}"
echo -e "  ${DIM}Uninstall:          bash $INSTALL/uninstall.sh${NC}"
echo ""
sep
write_log "INFO" "Install complete — ${#CONFS_INSTALLED[@]} tunnels installed — mode=$TUNNEL_MODE"
write_log "INFO" "Active tunnel: ${ACTIVE_TUNNEL:-none}"

# Export support bundle to Desktop
export_support_bundle

echo -e "  ${GRN}${BLD}ProxhqVPN is ready. Open your dashboard:${NC}"
echo -e "  ${CYN}${BLD}  ${BASE_URL}/dashboard${NC}\n"

if command -v xdg-open &>/dev/null; then
  read -rp "  Open dashboard in browser? [Y/n] " OB
  [[ "${OB:-y}" =~ ^[Yy]$ ]] && xdg-open "${BASE_URL}/dashboard" &>/dev/null & true
fi
press_enter
