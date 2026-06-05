#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — macOS Setup Wizard
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#
#  Double-click "Launch-ProxhqVPN-Setup.command" to run this.
#  Walks through 6 steps — WireGuard, sign in, all tunnels — automatically.
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BASE_URL="https://proxhqvpn.com"
WG_BIN=""                         # resolved below
INSTALL="$HOME/Library/Application Support/ProxhqVPN"
TUNNEL_MODE="split"
CONFS_INSTALLED=()
ACTIVE_TUNNEL=""

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
  echo -e "${GRN}${BLD}  ║        PROXHQVPN — macOS SETUP WIZARD  v5.0  ║${NC}"
  echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
  echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"
}

# ── osascript helpers ─────────────────────────────────────────────────────────
dlg()  { osascript -e "display dialog \"$1\" buttons {\"$2\"$([ -n "${3:-}" ] && echo ", \"$3\"")} default button \"$2\" with title \"ProxhqVPN Setup\" with icon note" 2>/dev/null; }
dlg2() { osascript -e "display dialog \"$1\" buttons {\"$2\",\"$3\"} default button \"$2\" cancel button \"$3\" with title \"ProxhqVPN Setup\" with icon note" 2>/dev/null | grep "button returned:" | sed 's/button returned://'; }
pick() { # pick $title $opt1 $opt2 — returns chosen
  osascript -e "choose from list {\"$2\",\"$3\"} with title \"ProxhqVPN Setup\" with prompt \"$1\" default items {\"$2\"}" 2>/dev/null | head -1
}
notify() { osascript -e "display notification \"$1\" with title \"ProxhqVPN\"" 2>/dev/null||true; }

# ── STEP TRACKER ──────────────────────────────────────────────────────────────
show_step(){
  local n=$1 total=6 label=$2
  local pct=$(( n * 100 / total ))
  echo -e "\n${GRN}${BLD}  ┌── Step $n/$total ─────────────────────────────────────┐${NC}"
  echo -e "${GRN}${BLD}  │  $label${NC}"
  printf   "${GRN}${BLD}  │  ["; local filled=$(( n * 46 / total ))
  for((i=0;i<filled;i++)); do printf "█"; done
  for((i=filled;i<46;i++)); do printf "░"; done
  echo -e "] $pct%%  ${NC}"
  echo -e "${GRN}${BLD}  └────────────────────────────────────────────────────┘${NC}\n"
}

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 0 — WELCOME
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 1 "Welcome"
echo -e "  ${BLD}Welcome to ProxhqVPN${NC}"
echo -e "  ${DIM}All 4 server tunnels install at once — switch anytime.${NC}\n"
echo -e "  ${GRN}⚡${NC}  WireGuard installed automatically (no manual download)"
echo -e "  ${GRN}🌍${NC}  4 servers: Los Angeles · Chicago · London · Tokyo"
echo -e "  ${GRN}🔄${NC}  Switch servers at any time from the included switcher"
echo -e "  ${GRN}🛡${NC}  Split Tunnel (recommended) or Full Tunnel mode"
echo -e "  ${GRN}🌐${NC}  Sign in once → all configs install automatically"
echo -e "  ${GRN}🧹${NC}  Zero-logs policy — no traffic stored or monitored\n"
sep

dlg "Welcome to ProxhqVPN\n\nAll 4 VPN servers install at once — Los Angeles, Chicago, London, Tokyo.\n\nWireGuard installs automatically. Sign in once and your tunnels configure themselves.\n\nClick Continue to begin." "Continue" "Cancel" || { echo -e "\n  Setup cancelled.\n"; exit 0; }

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 1 — LICENSE + TUNNEL MODE
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 2 "License Agreement"
echo -e "  ${BLD}ProxhqVPN End User License Agreement${NC}\n"
echo -e "  ${DIM}1. LICENSE GRANT — Personal use on devices you own.${NC}"
echo -e "  ${DIM}2. WIREGUARD CONSENT — ProxhqVPN installs WireGuard (GPLv2).${NC}"
echo -e "  ${DIM}3. ZERO LOGS — No traffic, browsing, or connection times stored.${NC}"
echo -e "  ${DIM}4. LIABILITY — ALPHA UNLIMITED TECHNOLOGIES LLC not liable for indirect damages.${NC}"
echo -e "  ${DIM}WireGuard® is a registered trademark of Jason A. Donenfeld.${NC}\n"
sep

RES=$(dlg2 "PROXHQVPN END USER LICENSE AGREEMENT\n© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC\n\n• Personal use on devices you own\n• WireGuard (GPLv2) installs automatically\n• Zero-logs policy\n• No liability for indirect damages\n\nDo you accept the license agreement and consent to WireGuard installation?" "I Accept" "Cancel")
if [[ "$RES" != *"I Accept"* ]]; then echo -e "\n  You must accept the license to continue.\n"; exit 0; fi
ok "License accepted"

banner
show_step 2 "Tunnel Mode"
echo -e "  ${BLD}Choose your VPN tunnel mode${NC}\n"
echo -e "  ${GRN}⚡ Split Tunnel${NC} ${DIM}(Recommended)${NC}"
echo -e "     Only ProxhqVPN traffic routes through the VPN."
echo -e "     Apps, streaming, and gaming work at full speed.\n"
echo -e "  ${YLW}🔒 Full Tunnel${NC}"
echo -e "     ALL internet traffic routes through ProxhqVPN."
echo -e "     Maximum privacy — may slow some apps.\n"
sep

CHOICE=$(pick "Choose your VPN tunnel mode:" "⚡ Split Tunnel  (Recommended — apps work normally)" "🔒 Full Tunnel  (All traffic, maximum privacy)")
if [[ "$CHOICE" == *"Full"* ]]; then TUNNEL_MODE="full"; warn "Full Tunnel selected — all traffic will route through ProxhqVPN"
else TUNNEL_MODE="split"; ok "Split Tunnel selected"; fi

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 2 — WIREGUARD INSTALL
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 3 "Installing WireGuard"
echo -e "  ${BLD}Installing WireGuard${NC}"
echo -e "  ${DIM}Checking for existing installation...${NC}\n"

# Check for existing wg installation
WG_BIN=""
for loc in /usr/local/bin/wg /opt/homebrew/bin/wg /usr/bin/wg; do
  if [[ -x "$loc" ]]; then WG_BIN="$loc"; break; fi
done

if [[ -n "$WG_BIN" ]]; then
  ok "WireGuard already installed: $WG_BIN"
  WG_QUICK="${WG_BIN%wg}wg-quick"
else
  info "WireGuard not found — installing now..."
  echo ""
  notify "Installing WireGuard for macOS..."

  # Try Homebrew first (most common macOS method)
  if command -v brew &>/dev/null; then
    step "Installing via Homebrew..."
    echo -e "  ${DIM}Running: brew install wireguard-tools${NC}\n"
    if brew install wireguard-tools 2>&1 | while IFS= read -r line; do echo "  ${DIM}$line${NC}"; done; then
      for loc in /usr/local/bin/wg /opt/homebrew/bin/wg; do
        if [[ -x "$loc" ]]; then WG_BIN="$loc"; break; fi
      done
      if [[ -n "$WG_BIN" ]]; then ok "WireGuard installed via Homebrew: $WG_BIN"
      else warn "Homebrew install ran but wg not found — trying fallback..."; fi
    fi
  fi

  # If still not installed, use direct binary from our CDN
  if [[ -z "$WG_BIN" ]]; then
    ARCH="$(uname -m)"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    WG_BUNDLED="$SCRIPT_DIR/wireguard/wg"

    if [[ -f "$WG_BUNDLED" ]]; then
      info "Using bundled wireguard-tools..."
      sudo install -m 755 "$WG_BUNDLED" /usr/local/bin/wg 2>/dev/null || {
        mkdir -p "$HOME/.local/bin"
        install -m 755 "$WG_BUNDLED" "$HOME/.local/bin/wg"
        export PATH="$HOME/.local/bin:$PATH"
      }
      WG_BUNDLED_QK="$SCRIPT_DIR/wireguard/wg-quick"
      [[ -f "$WG_BUNDLED_QK" ]] && sudo install -m 755 "$WG_BUNDLED_QK" /usr/local/bin/wg-quick 2>/dev/null||true
    else
      info "Downloading WireGuard tools..."
      WG_TMP=$(mktemp -d)
      if curl -fsSL "https://download.wireguard.com/mac-client/WireGuard-macos.dmg" -o "$WG_TMP/wg.dmg" 2>/dev/null; then
        hdiutil attach "$WG_TMP/wg.dmg" -quiet -mountpoint "$WG_TMP/wg_mount" 2>/dev/null||true
        if [[ -d "$WG_TMP/wg_mount" ]]; then
          sudo cp -r "$WG_TMP/wg_mount/WireGuard.app" /Applications/ 2>/dev/null||true
          hdiutil detach "$WG_TMP/wg_mount" -quiet 2>/dev/null||true
          ok "WireGuard.app installed to /Applications"
        fi
      fi
      rm -rf "$WG_TMP"
      # Try one more time
      for loc in /usr/local/bin/wg /opt/homebrew/bin/wg; do
        if [[ -x "$loc" ]]; then WG_BIN="$loc"; break; fi
      done
    fi
    for loc in /usr/local/bin/wg /opt/homebrew/bin/wg "$HOME/.local/bin/wg"; do
      if [[ -x "$loc" ]]; then WG_BIN="$loc"; break; fi
    done
  fi

  if [[ -z "$WG_BIN" ]]; then
    warn "Could not install wg CLI — will use WireGuard.app GUI for tunnel activation"
    WG_BIN="app"
  else
    ok "WireGuard installed: $WG_BIN"
  fi
fi

WG_QUICK="${WG_BIN%wg}wg-quick"
[[ ! -x "$WG_QUICK" ]] && WG_QUICK=""
ok "WireGuard ready ✓"
echo ""
dlg "WireGuard is installed and ready.\n\nTunnel mode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')\n\nNext: sign in to ProxhqVPN — your browser will open automatically." "Continue"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 3 — SIGN IN
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 4 "Sign In — Automatic Download"
echo -e "  ${BLD}Sign in once — everything else is automatic${NC}\n"
echo -e "  ${GRN}🔑${NC}  Sign in to ProxhqVPN in the browser"
echo -e "  ${GRN}⚙${NC}   ProxhqVPN generates your personal keys for all 4 servers"
echo -e "  ${GRN}📦${NC}  Configs download automatically — this installer detects them"
echo -e "  ${GRN}✅${NC}  VPN is live — switch servers anytime, no reinstall\n"
sep

REDIRECT_PATH="/autosetup?tunnelmode=${TUNNEL_MODE}&hostname=$(hostname -s)"
SIGNIN_URL="${BASE_URL}/sign-in?redirect_url=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$REDIRECT_PATH" 2>/dev/null || echo "$REDIRECT_PATH")"

info "Opening your browser for sign-in..."
open "$SIGNIN_URL"
notify "Sign in to ProxhqVPN — configs will download automatically"

# Watch ~/Downloads for proxhqvpn-all-servers.zip
DL_DIR="$HOME/Downloads"
ZIP_TARGET="proxhqvpn-all-servers.zip"
WAIT_SEC=600
ELAPSED=0
FOUND_ZIP=""

echo -e "  ${DIM}Watching $DL_DIR for $ZIP_TARGET ...${NC}\n"
echo -e "  ${DIM}Sign in, then your configs will download. Nothing else to do.${NC}\n"

DOTS=0
while [[ $ELAPSED -lt $WAIT_SEC ]]; do
  sleep 2
  ELAPSED=$((ELAPSED+2))
  REMAINING=$((WAIT_SEC-ELAPSED))

  ZIP_PATH="$DL_DIR/$ZIP_TARGET"
  if [[ -f "$ZIP_PATH" ]]; then
    SZ1=$(stat -f%z "$ZIP_PATH" 2>/dev/null||echo 0)
    sleep 1
    SZ2=$(stat -f%z "$ZIP_PATH" 2>/dev/null||echo 0)
    if [[ "$SZ1" == "$SZ2" && "$SZ1" -gt 0 ]]; then
      FOUND_ZIP="$ZIP_PATH"; break
    fi
  fi

  DOTS=$(( (DOTS+1) % 4 ))
  SPIN=("⠋" "⠙" "⠹" "⠸")
  printf "\r  ${GRN}%s${NC}  Waiting for sign-in ... %dm %ds remaining   " "${SPIN[$DOTS]}" "$((REMAINING/60))" "$((REMAINING%60))"
done
echo ""

if [[ -z "$FOUND_ZIP" ]]; then
  warn "Timed out — no config pack detected. Try again or download manually from My VPN."
  dlg "Timed out waiting for config download.\n\nYou can try again:\n1. Sign in at $BASE_URL\n2. Go to My VPN → Download All Servers Pack\n3. Run this installer again" "OK"
  exit 1
fi

ok "Detected: $ZIP_TARGET"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 4 — INSTALL TUNNELS
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 5 "Installing All Tunnels"
echo -e "  ${BLD}Installing all VPN tunnel configs...${NC}\n"

WG_CONF_DIR="/etc/wireguard"
if [[ ! -w "$WG_CONF_DIR" ]]; then
  WG_CONF_DIR="$HOME/Library/Application Support/ProxhqVPN/tunnels"
fi
mkdir -p "$WG_CONF_DIR"
mkdir -p "$INSTALL"

# Extract zip
info "Extracting $ZIP_TARGET..."
TMP_EXTRACT=$(mktemp -d)
unzip -q "$FOUND_ZIP" -d "$TMP_EXTRACT"
ok "Extracted"

# Find all .conf files
mapfile -t CONF_FILES < <(find "$TMP_EXTRACT" -name "proxhqvpn-*.conf" 2>/dev/null)
TOTAL=${#CONF_FILES[@]}
echo -e "  ${DIM}Found $TOTAL server config(s)${NC}\n"

if [[ $TOTAL -eq 0 ]]; then
  err "No proxhqvpn-*.conf files found in the downloaded zip."
  rm -rf "$TMP_EXTRACT"
  exit 1
fi

IDX=0
for CF in "${CONF_FILES[@]}"; do
  IDX=$((IDX+1))
  TN=$(basename "$CF" .conf)
  PCT=$(( IDX * 100 / TOTAL ))

  printf "  ${GRN}[%d/%d]${NC} Installing ${BLD}%s${NC} ... " "$IDX" "$TOTAL" "$TN"

  # Apply tunnel mode
  if [[ "$TUNNEL_MODE" == "split" ]]; then
    sed -i '' 's|AllowedIPs = 0\.0\.0\.0/0[^,]*||g; s|, ::\/0||g; s|AllowedIPs = $|AllowedIPs = 10.8.0.0/24|g' "$CF" 2>/dev/null||true
    if ! grep -q "AllowedIPs" "$CF"; then
      echo "" >> "$CF"
      echo "AllowedIPs = 10.8.0.0/24" >> "$CF"
    fi
  fi

  # Copy config
  DEST="$WG_CONF_DIR/$TN.conf"
  cp "$CF" "$DEST"
  chmod 600 "$DEST"

  # Install tunnel
  if [[ -n "$WG_QUICK" && -x "$WG_QUICK" ]]; then
    sudo "$WG_QUICK" down "$TN" 2>/dev/null||true
    if sudo "$WG_QUICK" up "$DEST" 2>/dev/null; then
      echo -e "${GRN}✓${NC}"
      CONFS_INSTALLED+=("$TN|$DEST")
      ACTIVE_TUNNEL="$TN"
    else
      echo -e "${YLW}⚠ (installed, not started)${NC}"
      CONFS_INSTALLED+=("$TN|$DEST")
    fi
  else
    echo -e "${BLU}→ (saved, use WireGuard.app to activate)${NC}"
    CONFS_INSTALLED+=("$TN|$DEST")
  fi
done

rm -rf "$TMP_EXTRACT"

# ── Save config JSON ──────────────────────────────────────────────────────────
mkdir -p "$INSTALL"
cat > "$INSTALL/config.json" <<EOF
{
  "tunnelMode": "$TUNNEL_MODE",
  "hostname": "$(hostname -s)",
  "version": "5.0",
  "installedTunnels": $(printf '"%s",' "${CONFS_INSTALLED[@]}" | sed 's/,$//' | xargs -I{} echo "[{}]")
}
EOF

# ── Create SwitchServer.command on Desktop ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWITCH_SRC="$SCRIPT_DIR/SwitchServer-macOS.sh"
SWITCH_DEST="$HOME/Desktop/Switch VPN Server.command"
if [[ -f "$SWITCH_SRC" ]]; then
  cp "$SWITCH_SRC" "$SWITCH_DEST"
  chmod +x "$SWITCH_DEST"
  xattr -d com.apple.quarantine "$SWITCH_DEST" 2>/dev/null||true
  ok "Desktop shortcut created: 'Switch VPN Server.command'"
fi

# ── Create ProxhqVPN.command shortcut ────────────────────────────────────────
cat > "$HOME/Desktop/ProxhqVPN.command" <<'CMDEOF'
#!/usr/bin/env bash
open "https://proxhqvpn.com/dashboard"
CMDEOF
chmod +x "$HOME/Desktop/ProxhqVPN.command"
xattr -d com.apple.quarantine "$HOME/Desktop/ProxhqVPN.command" 2>/dev/null||true
ok "Desktop shortcut created: 'ProxhqVPN.command'"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 5 — DONE
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 6 "Done!"
echo ""
echo -e "  ${GRN}${BLD}✓  ${#CONFS_INSTALLED[@]} VPN tunnel(s) installed successfully${NC}"
echo -e "  ${GRN}${BLD}✓  Tunnel mode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')${NC}"
echo -e "  ${GRN}${BLD}✓  Configs saved to: $WG_CONF_DIR${NC}"
echo ""
echo -e "  ${BLD}INSTALLED SERVERS:${NC}"
for ENTRY in "${CONFS_INSTALLED[@]}"; do
  TN="${ENTRY%%|*}"
  STEM="${TN#proxhqvpn-}"
  case "$STEM" in
    *london*)  FLAG="🇬🇧" ;;
    *chicago*) FLAG="🇺🇸" ;;
    *los*)     FLAG="🇺🇸" ;;
    *tokyo*)   FLAG="🇯🇵" ;;
    *)         FLAG="🌐" ;;
  esac
  REGION=$(echo "$STEM" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
  echo -e "  ${FLAG}  ${BLD}$REGION${NC}  ${DIM}($TN)${NC}"
done
echo ""
echo -e "  ${DIM}Switch servers anytime:${NC}"
echo -e "  ${DIM}  • Use 'Switch VPN Server.command' on your Desktop${NC}"
echo -e "  ${DIM}  • Or: sudo wg-quick up/down <tunnel-name>${NC}"
echo ""
sep
notify "ProxhqVPN installed — ${#CONFS_INSTALLED[@]} servers ready"

dlg "✓  All done!\n\n${#CONFS_INSTALLED[@]} VPN tunnel(s) installed.\nTunnel mode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')\n\nTo switch servers: use 'Switch VPN Server.command' on your Desktop.\n\nClick Open ProxhqVPN to go to your dashboard." "Open ProxhqVPN" "Close"
RESULT=$?
if [[ "$RESULT" == "0" ]]; then
  open "${BASE_URL}/dashboard"
fi
