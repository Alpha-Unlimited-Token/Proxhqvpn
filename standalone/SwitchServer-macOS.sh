#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — macOS Server Switcher
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#  Double-click "Switch VPN Server.command" on your Desktop to run this.
# ══════════════════════════════════════════════════════════════════════════════

GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'
BLU='\033[0;34m'; DIM='\033[2m'; BLD='\033[1m'; NC='\033[0m'

clear 2>/dev/null||true
echo -e "\n${GRN}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GRN}${BLD}  ║      PROXHQVPN — Switch VPN Server           ║${NC}"
echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"

WG_CONF_DIR="/etc/wireguard"
[[ ! -d "$WG_CONF_DIR" ]] && WG_CONF_DIR="$HOME/Library/Application Support/ProxhqVPN/tunnels"

# Find wg-quick
WG_QUICK=""
for loc in /usr/local/bin/wg-quick /opt/homebrew/bin/wg-quick; do
  [[ -x "$loc" ]] && WG_QUICK="$loc" && break
done

if [[ -z "$WG_QUICK" ]]; then
  echo -e "  ${RED}✗${NC}  wg-quick not found. Run the ProxhqVPN installer first.\n"
  read -rp "  Press Enter to close..." && exit 1
fi

# Find all installed configs
mapfile -t CONFIGS < <(find "$WG_CONF_DIR" -name "proxhqvpn-*.conf" 2>/dev/null | sort)

if [[ ${#CONFIGS[@]} -eq 0 ]]; then
  echo -e "  ${RED}✗${NC}  No ProxhqVPN tunnels found in $WG_CONF_DIR"
  echo -e "  ${DIM}Run the ProxhqVPN installer first.${NC}\n"
  read -rp "  Press Enter to close..." && exit 1
fi

# Get active tunnel
ACTIVE=""
if command -v wg &>/dev/null; then
  ACTIVE=$(sudo wg show interfaces 2>/dev/null | tr ' ' '\n' | grep "proxhqvpn" | head -1 || true)
fi

echo -e "  ${BLD}Select a server to connect:${NC}\n"
IDX=1
declare -a NAMES PATHS
for CF in "${CONFIGS[@]}"; do
  TN=$(basename "$CF" .conf)
  STEM="${TN#proxhqvpn-}"
  case "$STEM" in
    *london*)  FLAG="🇬🇧" ;;
    *chicago*) FLAG="🇺🇸" ;;
    *los*)     FLAG="🇺🇸" ;;
    *tokyo*)   FLAG="🇯🇵" ;;
    *)         FLAG="🌐" ;;
  esac
  REGION=$(echo "$STEM" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
  ENDPOINT=$(grep -i "^Endpoint" "$CF" | head -1 | sed 's/Endpoint *= *//' || echo "")
  if [[ "$TN" == "$ACTIVE" ]]; then
    echo -e "  ${GRN}${BLD}[$IDX]${NC}  $FLAG  ${BLD}$REGION${NC}  ${GRN}← ACTIVE${NC}  ${DIM}$ENDPOINT${NC}"
  else
    echo -e "  ${DIM}[$IDX]${NC}  $FLAG  ${BLD}$REGION${NC}  ${DIM}$ENDPOINT${NC}"
  fi
  NAMES+=("$TN")
  PATHS+=("$CF")
  IDX=$((IDX+1))
done

echo ""
if [[ -n "$ACTIVE" ]]; then
  echo -e "  ${DIM}[0]  Disconnect (stop $ACTIVE)${NC}"
fi
echo ""
read -rp "  Enter number (or 0 to disconnect, q to quit): " CHOICE

if [[ "$CHOICE" == "q" || "$CHOICE" == "Q" ]]; then
  echo -e "\n  Cancelled.\n"; exit 0
fi

if [[ "$CHOICE" == "0" ]]; then
  if [[ -n "$ACTIVE" ]]; then
    echo -e "\n  ${YLW}→${NC}  Stopping $ACTIVE..."
    sudo "$WG_QUICK" down "$ACTIVE" 2>/dev/null && echo -e "  ${GRN}✓${NC}  Disconnected." || echo -e "  ${YLW}!${NC}  Could not stop tunnel."
  else
    echo -e "\n  ${DIM}No active tunnel to disconnect.${NC}"
  fi
  echo ""
  read -rp "  Press Enter to close..." && exit 0
fi

if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [[ "$CHOICE" -lt 1 || "$CHOICE" -gt ${#NAMES[@]} ]]; then
  echo -e "\n  ${RED}Invalid choice.${NC}\n"; read -rp "  Press Enter to close..." && exit 1
fi

SEL_IDX=$(( CHOICE - 1 ))
SEL_NAME="${NAMES[$SEL_IDX]}"
SEL_PATH="${PATHS[$SEL_IDX]}"

echo -e "\n  ${YLW}→${NC}  Stopping all ProxhqVPN tunnels..."
for N in "${NAMES[@]}"; do
  sudo "$WG_QUICK" down "$N" 2>/dev/null||true
done
sleep 0.5

echo -e "  ${YLW}→${NC}  Connecting to $SEL_NAME..."
if sudo "$WG_QUICK" up "$SEL_PATH" 2>/dev/null; then
  echo -e "\n  ${GRN}${BLD}✓  Connected: $SEL_NAME${NC}"
  osascript -e "display notification \"Connected to $SEL_NAME\" with title \"ProxhqVPN\"" 2>/dev/null||true
else
  echo -e "\n  ${RED}✗  Failed to connect.${NC} Try running as administrator."
fi

echo ""
read -rp "  Press Enter to close..."
