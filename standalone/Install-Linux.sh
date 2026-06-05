#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — Linux Setup Wizard
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

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; BLU='\033[0;34m'
YLW='\033[1;33m'; CYN='\033[0;36m'; DIM='\033[2m'
BLD='\033[1m';    NC='\033[0m'
ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
info() { echo -e "  ${BLU}→${NC}  $*"; }
warn() { echo -e "  ${YLW}!${NC}  $*"; }
err()  { echo -e "\n  ${RED}✗  ERROR:${NC}  $*\n"; }
step() { echo -e "\n${BLD}${YLW}▶  $*${NC}"; }
sep()  { echo -e "${DIM}──────────────────────────────────────────────────────${NC}"; }

banner(){
  clear 2>/dev/null||true
  echo -e "\n${GRN}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GRN}${BLD}  ║        PROXHQVPN — LINUX SETUP WIZARD  v5.0  ║${NC}"
  echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
  echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"
}

show_step(){
  local n=$1 total=6 label=$2
  echo -e "${GRN}${BLD}  ┌── Step $n/$total ─────────────────────────────────────┐${NC}"
  echo -e "${GRN}${BLD}  │  $label${NC}"
  local filled=$(( n * 46 / total ))
  printf   "${GRN}${BLD}  │  ["; for((i=0;i<filled;i++)); do printf "█"; done
  for((i=filled;i<46;i++)); do printf "░"; done
  echo -e "] $(( n * 100 / total ))%%  ${NC}"
  echo -e "${GRN}${BLD}  └────────────────────────────────────────────────────┘${NC}\n"
}

press_enter(){ read -rp "  Press Enter to continue..."; }
confirm(){     read -rp "  $1 [Y/n] " _c; [[ "${_c:-y}" =~ ^[Yy]$ ]]; }

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 0 — WELCOME
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 1 "Welcome"
echo -e "  ${BLD}Welcome to ProxhqVPN Linux Setup${NC}"
echo -e "  ${DIM}All 4 server tunnels install at once — switch anytime.${NC}\n"
echo -e "  ${GRN}⚡${NC}  WireGuard installed automatically (no manual download)"
echo -e "  ${GRN}🌍${NC}  4 servers: Los Angeles · Chicago · London · Tokyo"
echo -e "  ${GRN}🔄${NC}  Switch servers at any time — use the included switcher script"
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
echo -e "       Only ProxhqVPN traffic routes through the VPN."
echo -e "       Apps, streaming, and gaming work at full speed.\n"
echo -e "  ${YLW}[2]${NC}  ${BLD}🔒 Full Tunnel${NC}"
echo -e "       ALL internet traffic routes through ProxhqVPN."
echo -e "       Maximum privacy — may slow some apps.\n"
sep
read -rp "  Enter choice [1/2, default=1]: " TMCHOICE
case "${TMCHOICE:-1}" in
  2) TUNNEL_MODE="full"; warn "Full Tunnel selected — all traffic via ProxhqVPN" ;;
  *) TUNNEL_MODE="split"; ok "Split Tunnel selected" ;;
esac

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 2 — WIREGUARD INSTALL
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 3 "Installing WireGuard"
echo -e "  ${BLD}Installing WireGuard${NC}"
echo -e "  ${DIM}Checking for existing installation...${NC}\n"

install_wg(){
  # Detect distro and install
  if command -v apt-get &>/dev/null; then
    info "Ubuntu/Debian detected — running: apt-get install -y wireguard-tools"
    sudo apt-get update -qq 2>&1 | tail -3
    sudo apt-get install -y wireguard-tools 2>&1 | tail -5
  elif command -v dnf &>/dev/null; then
    info "Fedora/RHEL detected — running: dnf install -y wireguard-tools"
    sudo dnf install -y wireguard-tools 2>&1 | tail -5
  elif command -v yum &>/dev/null; then
    info "CentOS/RHEL (yum) detected..."
    sudo yum install -y epel-release 2>&1|tail -2
    sudo yum install -y wireguard-tools 2>&1|tail -5
  elif command -v pacman &>/dev/null; then
    info "Arch Linux detected — running: pacman -S --noconfirm wireguard-tools"
    sudo pacman -Sy --noconfirm wireguard-tools 2>&1|tail -5
  elif command -v zypper &>/dev/null; then
    info "openSUSE detected — running: zypper install -y wireguard-tools"
    sudo zypper install -y wireguard-tools 2>&1|tail -5
  else
    warn "Unknown distro — trying to build from source..."
    if command -v make &>/dev/null && command -v git &>/dev/null; then
      TMP=$(mktemp -d)
      git clone https://git.zx2c4.com/wireguard-tools "$TMP/wg" --depth 1 2>&1|tail -3
      make -C "$TMP/wg/src" -j"$(nproc)" 2>&1|tail -3
      sudo make -C "$TMP/wg/src" install 2>&1|tail -3
      rm -rf "$TMP"
    else
      return 1
    fi
  fi
}

# Check bundled wireguard first
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WG_BUNDLED="$SCRIPT_DIR/wireguard/wg"

if command -v wg &>/dev/null; then
  ok "WireGuard already installed: $(command -v wg)"
elif [[ -f "$WG_BUNDLED" ]]; then
  info "Using bundled wireguard-tools..."
  sudo install -m 755 "$WG_BUNDLED" /usr/local/bin/wg 2>/dev/null||{
    mkdir -p "$HOME/.local/bin"
    install -m 755 "$WG_BUNDLED" "$HOME/.local/bin/wg"
    export PATH="$HOME/.local/bin:$PATH"
  }
  WG_QK="$SCRIPT_DIR/wireguard/wg-quick"
  [[ -f "$WG_QK" ]] && sudo install -m 755 "$WG_QK" /usr/local/bin/wg-quick 2>/dev/null||true
  ok "Bundled WireGuard installed"
else
  info "Installing WireGuard via package manager..."
  if install_wg; then
    ok "WireGuard installed successfully"
  else
    warn "Automatic install failed. Try manually:"
    echo -e "  ${DIM}  Ubuntu/Debian:  sudo apt install wireguard-tools${NC}"
    echo -e "  ${DIM}  Fedora:         sudo dnf install wireguard-tools${NC}"
    echo -e "  ${DIM}  Arch:           sudo pacman -S wireguard-tools${NC}"
    press_enter
  fi
fi

# Enable IPv4 forwarding
sudo sysctl -w net.ipv4.ip_forward=1 &>/dev/null||true
ok "IP forwarding enabled"
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
echo -e "  ${GRN}✅${NC}  VPN is live — switch servers anytime, no reinstall\n"
sep

REDIRECT_PATH="/autosetup?tunnelmode=${TUNNEL_MODE}&hostname=$(hostname -s)"
SIGNIN_URL="${BASE_URL}/sign-in?redirect_url=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$REDIRECT_PATH" 2>/dev/null || echo "$REDIRECT_PATH")"

info "Opening browser: $SIGNIN_URL"
if command -v xdg-open &>/dev/null; then xdg-open "$SIGNIN_URL" &>/dev/null &
elif command -v sensible-browser &>/dev/null; then sensible-browser "$SIGNIN_URL" &>/dev/null &
elif command -v firefox &>/dev/null; then firefox "$SIGNIN_URL" &>/dev/null &
elif command -v google-chrome &>/dev/null; then google-chrome "$SIGNIN_URL" &>/dev/null &
else
  echo -e "\n  ${YLW}Cannot open browser automatically.${NC}"
  echo -e "  ${BLD}Please open this URL in your browser:${NC}"
  echo -e "  ${CYN}$SIGNIN_URL${NC}\n"
fi

DL_DIR="$HOME/Downloads"
ZIP_TARGET="proxhqvpn-all-servers.zip"
WAIT_SEC=600; ELAPSED=0; FOUND_ZIP=""

echo ""
echo -e "  ${DIM}Watching $DL_DIR for $ZIP_TARGET ...${NC}"
echo -e "  ${DIM}Sign in and your configs will download. Nothing else to do.${NC}\n"

SPIN=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
SI=0
while [[ $ELAPSED -lt $WAIT_SEC ]]; do
  sleep 2; ELAPSED=$((ELAPSED+2))
  ZIP_PATH="$DL_DIR/$ZIP_TARGET"
  if [[ -f "$ZIP_PATH" ]]; then
    SZ1=$(stat -c%s "$ZIP_PATH" 2>/dev/null||echo 0)
    sleep 1
    SZ2=$(stat -c%s "$ZIP_PATH" 2>/dev/null||echo 0)
    if [[ "$SZ1" == "$SZ2" && "$SZ1" -gt 0 ]]; then FOUND_ZIP="$ZIP_PATH"; break; fi
  fi
  REMAINING=$((WAIT_SEC-ELAPSED))
  SI=$(( (SI+1) % ${#SPIN[@]} ))
  printf "\r  ${GRN}%s${NC}  Waiting ... %dm %ds remaining     " "${SPIN[$SI]}" "$((REMAINING/60))" "$((REMAINING%60))"
done
echo ""

if [[ -z "$FOUND_ZIP" ]]; then
  warn "Timed out. Download proxhqvpn-all-servers.zip from My VPN and re-run."
  exit 1
fi
ok "Detected: $ZIP_TARGET"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 4 — INSTALL TUNNELS
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 5 "Installing All Tunnels"
echo -e "  ${BLD}Installing all VPN tunnel configs...${NC}\n"

[[ ! -w "$WG_CONF_DIR" ]] && WG_CONF_DIR="$HOME/.config/wireguard"
mkdir -p "$WG_CONF_DIR"

TMP_EXTRACT=$(mktemp -d)
info "Extracting configs..."
unzip -q "$FOUND_ZIP" -d "$TMP_EXTRACT"

mapfile -t CONF_FILES < <(find "$TMP_EXTRACT" -name "proxhqvpn-*.conf" 2>/dev/null)
TOTAL=${#CONF_FILES[@]}
echo -e "  ${DIM}Found $TOTAL config(s)${NC}\n"

if [[ $TOTAL -eq 0 ]]; then
  err "No configs found in downloaded zip. Try re-downloading."
  rm -rf "$TMP_EXTRACT"; exit 1
fi

IDX=0
for CF in "${CONF_FILES[@]}"; do
  IDX=$((IDX+1)); TN=$(basename "$CF" .conf)
  printf "  ${GRN}[%d/%d]${NC} %s ... " "$IDX" "$TOTAL" "$TN"

  if [[ "$TUNNEL_MODE" == "split" ]]; then
    sed -i 's|AllowedIPs = 0\.0\.0\.0/0.*||g' "$CF" 2>/dev/null||true
    if ! grep -q "AllowedIPs" "$CF"; then
      printf "\nAllowedIPs = 10.8.0.0/24\n" >> "$CF"
    fi
  fi

  DEST="$WG_CONF_DIR/$TN.conf"
  cp "$CF" "$DEST"; chmod 600 "$DEST"

  if command -v wg-quick &>/dev/null; then
    sudo wg-quick down "$TN" 2>/dev/null||true
    if sudo wg-quick up "$DEST" 2>/dev/null; then
      echo -e "${GRN}✓ active${NC}"
      CONFS_INSTALLED+=("$TN")
      ACTIVE_TUNNEL="$TN"
    else
      echo -e "${YLW}⚠ saved (not started)${NC}"
      CONFS_INSTALLED+=("$TN")
    fi
  else
    echo -e "${BLU}→ saved${NC}"
    CONFS_INSTALLED+=("$TN")
  fi
done
rm -rf "$TMP_EXTRACT"

# ── Create desktop entry ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWITCH_SRC="$SCRIPT_DIR/SwitchServer-Linux.sh"
SWITCH_DEST="$HOME/Desktop/switch-vpn-server.sh"
if [[ -f "$SWITCH_SRC" ]]; then
  cp "$SWITCH_SRC" "$SWITCH_DEST"; chmod +x "$SWITCH_DEST"
  ok "Switcher saved: ~/Desktop/switch-vpn-server.sh"
fi

# ── Desktop .desktop file ─────────────────────────────────────────────────────
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
chmod +x "$DESKTOP_FILE" 2>/dev/null||true
ok "Desktop shortcut created: ProxhqVPN"

# ── systemd service (optional) ────────────────────────────────────────────────
if command -v systemctl &>/dev/null && [[ ${#CONFS_INSTALLED[@]} -gt 0 ]]; then
  FIRST_TN="${CONFS_INSTALLED[0]}"
  if systemctl is-active --quiet "wg-quick@${FIRST_TN}" 2>/dev/null; then
    ok "wg-quick@${FIRST_TN} service already running"
  else
    sudo systemctl enable "wg-quick@${FIRST_TN}" 2>/dev/null||true
    ok "wg-quick@${FIRST_TN} enabled (starts on boot)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 5 — DONE
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 6 "Done!"
echo ""
echo -e "  ${GRN}${BLD}✓  ${#CONFS_INSTALLED[@]} VPN tunnel(s) installed${NC}"
echo -e "  ${GRN}${BLD}✓  Tunnel mode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "  ${GRN}${BLD}✓  Configs in: $WG_CONF_DIR${NC}\n"
echo -e "  ${BLD}INSTALLED SERVERS:${NC}"
for TN in "${CONFS_INSTALLED[@]}"; do
  STEM="${TN#proxhqvpn-}"
  case "$STEM" in *london*) F="🇬🇧" ;; *chicago*) F="🇺🇸" ;; *los*) F="🇺🇸" ;; *tokyo*) F="🇯🇵" ;; *) F="🌐" ;; esac
  R=$(echo "$STEM"|tr '-' ' '|awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
  echo -e "  $F  ${BLD}$R${NC}  ${DIM}($TN)${NC}"
done
echo ""
echo -e "  ${DIM}Switch servers:  bash ~/Desktop/switch-vpn-server.sh${NC}"
echo -e "  ${DIM}Manual control:  sudo wg-quick up/down <tunnel-name>${NC}"
echo -e "  ${DIM}Status:          sudo wg show${NC}"
echo ""
sep
echo -e "  ${GRN}${BLD}ProxhqVPN is ready. Open your dashboard:${NC}"
echo -e "  ${CYN}${BLD}  https://proxhqvpn.com/dashboard${NC}\n"
if command -v xdg-open &>/dev/null; then
  read -rp "  Open dashboard in browser? [Y/n] " OB
  [[ "${OB:-y}" =~ ^[Yy]$ ]] && xdg-open "${BASE_URL}/dashboard" &>/dev/null &
fi
press_enter
