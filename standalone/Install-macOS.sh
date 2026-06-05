#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — macOS Setup Wizard  v5.1
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#
#  Double-click "Launch-ProxhqVPN-Setup.command" to run this.
#  Walks through 6 steps — WireGuard, sign in, all tunnels — automatically.
#  Compatible with bash 3.2+ (ships with macOS Catalina and later).
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BASE_URL="https://proxhqvpn.com"
WG_BIN=""
WG_QUICK=""
INSTALL="$HOME/Library/Application Support/ProxhqVPN"
TUNNEL_MODE="split"
CONFS_INSTALLED=()   # entries: "tunnelname|/path/to/tunnel.conf"
ACTIVE_TUNNEL=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; BLU='\033[0;34m'
YLW='\033[1;33m'; CYN='\033[0;36m'; DIM='\033[2m'
BLD='\033[1m';    NC='\033[0m'
ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
info() { echo -e "  ${BLU}→${NC}  $*"; }
warn() { echo -e "  ${YLW}!${NC}  $*"; }
err()  { echo -e "\n  ${RED}✗  ERROR:${NC}  $*\n"; }
sep()  { echo -e "${DIM}──────────────────────────────────────────────────────${NC}"; }

banner(){
  clear 2>/dev/null || true
  echo -e "\n${GRN}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GRN}${BLD}  ║        PROXHQVPN — macOS SETUP WIZARD  v5.1  ║${NC}"
  echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
  echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"
}

# ── osascript helpers ─────────────────────────────────────────────────────────
# dlg_ok: single-button dialog — exits non-zero if user dismisses via Escape
dlg_ok() {
  osascript -e "display dialog \"$1\" buttons {\"$2\"} default button \"$2\" with title \"ProxhqVPN Setup\" with icon note" 2>/dev/null
}

# dlg_yesno: two-button dialog — echoes the button label chosen
dlg_yesno() {
  # $1=message $2=confirm_label $3=cancel_label
  osascript 2>/dev/null <<ASCRIPT
set r to button returned of (display dialog "$1" buttons {"$3","$2"} default button "$2" cancel button "$3" with title "ProxhqVPN Setup" with icon note)
return r
ASCRIPT
}

# dlg_final: final done dialog — echoes "open" or "close"
dlg_final() {
  local result
  result=$(osascript 2>/dev/null <<ASCRIPT
set r to button returned of (display dialog "$1" buttons {"Close","Open ProxhqVPN"} default button "Open ProxhqVPN" with title "ProxhqVPN Setup" with icon note)
return r
ASCRIPT
  ) || true
  echo "$result"
}

# pick: choose-from-list — echoes chosen option or empty string on cancel
pick_mode() {
  osascript 2>/dev/null <<ASCRIPT
set opts to {"Split Tunnel (Recommended)", "Full Tunnel (All traffic)"}
set chosen to choose from list opts with title "ProxhqVPN Setup" with prompt "Choose your VPN tunnel mode:" default items {"Split Tunnel (Recommended)"} without empty selection allowed
if chosen is false then return "split"
return item 1 of chosen
ASCRIPT
}

notify() { osascript -e "display notification \"$1\" with title \"ProxhqVPN\"" 2>/dev/null || true; }

# ── Step progress bar ─────────────────────────────────────────────────────────
show_step(){
  local n=$1 label=$2 total=6
  echo -e "\n${GRN}${BLD}  ┌── Step $n/$total ─────────────────────────────────────┐${NC}"
  echo -e "${GRN}${BLD}  │  $label${NC}"
  local filled=$(( n * 46 / total )) i=0
  printf "${GRN}${BLD}  │  ["
  while (( i < filled )); do printf "█"; (( i++ )); done
  while (( i < 46 ));    do printf "░"; (( i++ )); done
  echo -e "] $(( n * 100 / total ))%%  ${NC}"
  echo -e "${GRN}${BLD}  └────────────────────────────────────────────────────┘${NC}\n"
}

# ── Tunnel-name helpers ───────────────────────────────────────────────────────
region_label() {
  local stem="${1#proxhqvpn-}"
  echo "$stem" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}
region_flag() {
  case "$1" in *london*) echo "🇬🇧";; *chicago*) echo "🇺🇸";; *los*) echo "🇺🇸";; *tokyo*) echo "🇯🇵";; *) echo "🌐";; esac
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
echo -e "  ${GRN}🔄${NC}  Switch servers any time from the Desktop switcher"
echo -e "  ${GRN}🛡${NC}  Split Tunnel (recommended) or Full Tunnel mode"
echo -e "  ${GRN}🌐${NC}  Sign in once → all configs install automatically"
echo -e "  ${GRN}🧹${NC}  Zero-logs policy — no traffic stored or monitored\n"
sep

dlg_ok "Welcome to ProxhqVPN\n\nAll 4 VPN servers install at once — Los Angeles, Chicago, London, Tokyo.\n\nWireGuard installs automatically. Sign in once and your tunnels configure themselves.\n\nClick Continue to begin." "Continue" || { echo -e "\n  Setup cancelled.\n"; exit 0; }

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 1 — LICENSE + TUNNEL MODE
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 2 "License Agreement"
echo -e "  ${DIM}1. LICENSE — Personal use on devices you own.${NC}"
echo -e "  ${DIM}2. WIREGUARD CONSENT — ProxhqVPN installs WireGuard (GPLv2).${NC}"
echo -e "  ${DIM}3. ZERO LOGS — No traffic or connection times stored.${NC}"
echo -e "  ${DIM}4. LIABILITY — ALPHA UNLIMITED TECHNOLOGIES LLC not liable for indirect damages.${NC}"
echo -e "  ${DIM}WireGuard® is a trademark of Jason A. Donenfeld.${NC}\n"
sep

RES=$(dlg_yesno "PROXHQVPN END USER LICENSE AGREEMENT\n© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC\n\n• Personal use on devices you own\n• WireGuard (GPLv2) installs automatically\n• Zero-logs policy — no traffic stored\n• No liability for indirect damages\n\nDo you accept and consent to WireGuard installation?" "I Accept" "Cancel") || true
if [[ "$RES" != "I Accept" ]]; then
  echo -e "\n  You must accept the license to continue.\n"; exit 0
fi
ok "License accepted"

banner
show_step 2 "Tunnel Mode"
echo -e "  ${BLD}Choose your VPN tunnel mode${NC}\n"
echo -e "  ${GRN}⚡ Split Tunnel${NC} ${DIM}(Recommended)${NC} — only VPN traffic tunnelled, apps unaffected"
echo -e "  ${YLW}🔒 Full Tunnel${NC} — ALL internet traffic via ProxhqVPN, maximum privacy\n"
sep

CHOICE=$(pick_mode) || CHOICE="split"
if [[ "$CHOICE" == *"Full"* ]]; then
  TUNNEL_MODE="full"; warn "Full Tunnel selected — all traffic will route through ProxhqVPN"
else
  TUNNEL_MODE="split"; ok "Split Tunnel selected (recommended)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 2 — WIREGUARD INSTALL
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 3 "Installing WireGuard"
echo -e "  ${BLD}Installing WireGuard${NC}"
echo -e "  ${DIM}Checking for existing installation...${NC}\n"

# Locate existing wg binary (arm64 Homebrew = /opt/homebrew, x64 = /usr/local)
for loc in /opt/homebrew/bin/wg /usr/local/bin/wg /usr/bin/wg; do
  [[ -x "$loc" ]] && WG_BIN="$loc" && break
done

if [[ -n "$WG_BIN" ]]; then
  ok "WireGuard already installed: $WG_BIN"
else
  info "WireGuard not found — installing now..."
  notify "Installing WireGuard for macOS..."

  # 1. Try Homebrew (auto-detects arm64 vs x64 prefix)
  BREW_BIN=""
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [[ -x "$b" ]] && BREW_BIN="$b" && break
  done

  if [[ -n "$BREW_BIN" ]]; then
    info "Installing via Homebrew: brew install wireguard-tools"
    "$BREW_BIN" install wireguard-tools 2>&1 | while IFS= read -r line; do echo "  ${DIM}$line${NC}"; done || true
    for loc in /opt/homebrew/bin/wg /usr/local/bin/wg; do
      [[ -x "$loc" ]] && WG_BIN="$loc" && break
    done
    [[ -n "$WG_BIN" ]] && ok "WireGuard installed via Homebrew: $WG_BIN" || warn "Homebrew ran but wg not found — trying fallback..."
  fi

  # 2. Try bundled binary (included in the zip)
  if [[ -z "$WG_BIN" && -f "$SCRIPT_DIR/wireguard/wg" ]]; then
    info "Using bundled wireguard-tools..."
    if sudo install -m 755 "$SCRIPT_DIR/wireguard/wg" /usr/local/bin/wg 2>/dev/null; then
      [[ -f "$SCRIPT_DIR/wireguard/wg-quick" ]] && sudo install -m 755 "$SCRIPT_DIR/wireguard/wg-quick" /usr/local/bin/wg-quick 2>/dev/null || true
      WG_BIN="/usr/local/bin/wg"
    else
      mkdir -p "$HOME/.local/bin"
      install -m 755 "$SCRIPT_DIR/wireguard/wg" "$HOME/.local/bin/wg"
      [[ -f "$SCRIPT_DIR/wireguard/wg-quick" ]] && install -m 755 "$SCRIPT_DIR/wireguard/wg-quick" "$HOME/.local/bin/wg-quick" || true
      export PATH="$HOME/.local/bin:$PATH"
      WG_BIN="$HOME/.local/bin/wg"
    fi
    ok "Bundled WireGuard installed: $WG_BIN"
  fi

  # 3. Download WireGuard.app from wireguard.com
  if [[ -z "$WG_BIN" ]]; then
    info "Downloading WireGuard.app from wireguard.com..."
    WG_TMP=$(mktemp -d)
    if curl -fsSL "https://download.wireguard.com/mac-client/WireGuard-macos.dmg" -o "$WG_TMP/wg.dmg" 2>/dev/null; then
      hdiutil attach "$WG_TMP/wg.dmg" -quiet -nobrowse -mountpoint "$WG_TMP/mnt" 2>/dev/null || true
      if [[ -d "$WG_TMP/mnt/WireGuard.app" ]]; then
        sudo cp -r "$WG_TMP/mnt/WireGuard.app" /Applications/ 2>/dev/null || true
        hdiutil detach "$WG_TMP/mnt" -quiet 2>/dev/null || true
        ok "WireGuard.app installed to /Applications"
      fi
    fi
    rm -rf "$WG_TMP"
    # Re-check after .app install
    for loc in /opt/homebrew/bin/wg /usr/local/bin/wg; do
      [[ -x "$loc" ]] && WG_BIN="$loc" && break
    done
  fi

  if [[ -z "$WG_BIN" ]]; then
    warn "wg CLI not found — tunnels will be saved but not started automatically."
    warn "Open WireGuard.app from /Applications to activate tunnels manually."
    WG_BIN="none"
  else
    ok "WireGuard installed: $WG_BIN"
  fi
fi

# Resolve wg-quick path alongside wg
if [[ "$WG_BIN" != "none" ]]; then
  WG_QUICK="${WG_BIN%wg}wg-quick"
  [[ ! -x "$WG_QUICK" ]] && WG_QUICK=""
fi

ok "WireGuard ready ✓"
echo ""
dlg_ok "WireGuard is installed and ready.\n\nTunnel mode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')\n\nNext: your browser will open for sign-in. Nothing else to do — this installer watches for the download and finishes automatically." "Continue"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 3 — SIGN IN
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 4 "Sign In — Automatic Download"
echo -e "  ${BLD}Sign in once — everything else is automatic${NC}\n"
echo -e "  ${GRN}🔑${NC}  Sign in to ProxhqVPN in the browser that opens"
echo -e "  ${GRN}⚙${NC}   ProxhqVPN generates your personal keys for all 4 servers"
echo -e "  ${GRN}📦${NC}  Configs download automatically — this wizard detects them"
echo -e "  ${GRN}✅${NC}  VPN live — switch servers anytime, no reinstall\n"
sep

# URL-encode the redirect path using python3 (always available on macOS 10.15+)
REDIRECT_PATH="/autosetup?tunnelmode=${TUNNEL_MODE}&hostname=$(hostname -s)"
ENCODED_REDIRECT=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$REDIRECT_PATH" 2>/dev/null || printf '%s' "$REDIRECT_PATH" | sed 's| |%20|g; s|?|%3F|g; s|=|%3D|g; s|&|%26|g')
SIGNIN_URL="${BASE_URL}/sign-in?redirect_url=${ENCODED_REDIRECT}"

info "Opening browser for sign-in..."
open "$SIGNIN_URL" 2>/dev/null || true
notify "Sign in to ProxhqVPN — configs download automatically"

DL_DIR="$HOME/Downloads"
ZIP_TARGET="proxhqvpn-all-servers.zip"
WAIT_SEC=600
ELAPSED=0
FOUND_ZIP=""

echo -e "  ${DIM}Watching $DL_DIR for $ZIP_TARGET ...${NC}"
echo -e "  ${DIM}Sign in and configs download themselves. Nothing else to do.${NC}\n"

while [[ $ELAPSED -lt $WAIT_SEC ]]; do
  sleep 2
  ELAPSED=$(( ELAPSED + 2 ))
  REMAINING=$(( WAIT_SEC - ELAPSED ))
  ZIP_PATH="$DL_DIR/$ZIP_TARGET"

  if [[ -f "$ZIP_PATH" ]]; then
    SZ1=$(stat -f%z "$ZIP_PATH" 2>/dev/null || echo 0)
    sleep 1
    SZ2=$(stat -f%z "$ZIP_PATH" 2>/dev/null || echo 0)
    if [[ "$SZ1" -gt 0 && "$SZ1" == "$SZ2" ]]; then
      FOUND_ZIP="$ZIP_PATH"; break
    fi
  fi

  printf "\r  ${GRN}◉${NC}  Waiting for download... %dm %ds remaining   " \
    "$(( REMAINING / 60 ))" "$(( REMAINING % 60 ))"
done
echo ""

if [[ -z "$FOUND_ZIP" ]]; then
  warn "Timed out — no config pack detected after 10 minutes."
  dlg_ok "Timed out waiting for config download.\n\nTo try again:\n1. Sign in at $BASE_URL\n2. Go to My VPN → Download All Servers Pack\n3. Re-run this installer" "OK" || true
  exit 1
fi
ok "Detected: $ZIP_TARGET"

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 4 — INSTALL TUNNELS
# ═════════════════════════════════════════════════════════════════════════════
banner
show_step 5 "Installing All Tunnels"
echo -e "  ${BLD}Installing all VPN tunnel configs...${NC}\n"

# Resolve config dir — prefer /etc/wireguard, fall back to user dir
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
ok "Extracted to temp dir"

# ── FIX: bash 3.2-compatible file collection (no mapfile) ────────────────────
CONF_FILES=()
while IFS= read -r -d '' f; do
  CONF_FILES+=("$f")
done < <(find "$TMP_EXTRACT" -name "proxhqvpn-*.conf" -print0 2>/dev/null)

TOTAL=${#CONF_FILES[@]}
echo -e "  ${DIM}Found $TOTAL server config(s)${NC}\n"

if [[ $TOTAL -eq 0 ]]; then
  err "No proxhqvpn-*.conf files found in the downloaded zip."
  rm -rf "$TMP_EXTRACT"; exit 1
fi

IDX=0
for CF in "${CONF_FILES[@]}"; do
  IDX=$(( IDX + 1 ))
  TN=$(basename "$CF" .conf)
  printf "  ${GRN}[%d/%d]${NC} Installing ${BLD}%s${NC} ... " "$IDX" "$TOTAL" "$TN"

  # ── FIX: apply split tunnel — replace the WHOLE AllowedIPs line ─────────────
  if [[ "$TUNNEL_MODE" == "split" ]]; then
    # Replace any line starting with "AllowedIPs = 0.0.0.0..." with split-tunnel range
    sed -i '' 's|^[[:space:]]*AllowedIPs[[:space:]]*=.*0\.0\.0\.0/0.*|AllowedIPs = 10.8.0.0/24|' "$CF" 2>/dev/null || true
    # If AllowedIPs is still 0.0.0.0 (edge case) or missing, set explicitly
    if grep -qE '^[[:space:]]*AllowedIPs[[:space:]]*=.*0\.0\.0\.0/0' "$CF" 2>/dev/null; then
      sed -i '' 's|^[[:space:]]*AllowedIPs[[:space:]]*=.*|AllowedIPs = 10.8.0.0/24|' "$CF" 2>/dev/null || true
    fi
    if ! grep -qE '^[[:space:]]*AllowedIPs' "$CF" 2>/dev/null; then
      printf '\nAllowedIPs = 10.8.0.0/24\n' >> "$CF"
    fi
  fi

  # Copy to WireGuard conf dir
  DEST="$WG_CONF_DIR/$TN.conf"
  cp "$CF" "$DEST"
  chmod 600 "$DEST"

  # Activate tunnel
  if [[ -n "$WG_QUICK" && -x "$WG_QUICK" ]]; then
    sudo "$WG_QUICK" down "$TN" 2>/dev/null || true
    if sudo "$WG_QUICK" up "$DEST" 2>/dev/null; then
      echo -e "${GRN}✓ active${NC}"
      CONFS_INSTALLED+=("$TN|$DEST")
      ACTIVE_TUNNEL="$TN"
    else
      echo -e "${YLW}⚠ saved (activate via WireGuard.app)${NC}"
      CONFS_INSTALLED+=("$TN|$DEST")
    fi
  else
    echo -e "${BLU}→ saved (open WireGuard.app to activate)${NC}"
    CONFS_INSTALLED+=("$TN|$DEST")
  fi
done

rm -rf "$TMP_EXTRACT"

# ── FIX: config.json — build JSON properly without xargs pipeline ─────────────
JSON_TUNNELS="["
for entry in "${CONFS_INSTALLED[@]}"; do
  JSON_TUNNELS+="\"${entry}\","
done
JSON_TUNNELS="${JSON_TUNNELS%,}]"

mkdir -p "$INSTALL"
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
SWITCH_SRC="$SCRIPT_DIR/SwitchServer-macOS.sh"
SWITCH_DEST="$HOME/Desktop/Switch VPN Server.command"
if [[ -f "$SWITCH_SRC" ]]; then
  cp "$SWITCH_SRC" "$SWITCH_DEST"
  chmod +x "$SWITCH_DEST"
  xattr -d com.apple.quarantine "$SWITCH_DEST" 2>/dev/null || true
  ok "Desktop shortcut: 'Switch VPN Server.command'"
fi

cat > "$HOME/Desktop/ProxhqVPN.command" <<'CMDEOF'
#!/usr/bin/env bash
open "https://proxhqvpn.com/dashboard"
CMDEOF
chmod +x "$HOME/Desktop/ProxhqVPN.command"
xattr -d com.apple.quarantine "$HOME/Desktop/ProxhqVPN.command" 2>/dev/null || true
ok "Desktop shortcut: 'ProxhqVPN.command'"

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
  FLAG=$(region_flag "$STEM")
  REGION=$(region_label "$TN")
  echo -e "  ${FLAG}  ${BLD}${REGION}${NC}  ${DIM}(${TN})${NC}"
done
echo ""
echo -e "  ${DIM}Switch servers:  'Switch VPN Server.command' on your Desktop${NC}"
echo -e "  ${DIM}Manual control:  sudo wg-quick up/down <tunnel-name>${NC}"
echo ""
sep
notify "ProxhqVPN installed — ${#CONFS_INSTALLED[@]} servers ready"

# ── FIX: capture button name — do NOT use $? to detect which button was pressed
FINAL=$(dlg_final "✓  All done!\n\n${#CONFS_INSTALLED[@]} VPN tunnel(s) installed.\nMode: $(echo "$TUNNEL_MODE" | tr '[:lower:]' '[:upper:]')\n\nSwitch servers anytime via 'Switch VPN Server.command' on your Desktop.") || true
if [[ "$FINAL" == "Open ProxhqVPN" ]]; then
  open "${BASE_URL}/dashboard"
fi
