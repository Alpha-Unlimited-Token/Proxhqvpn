#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — Linux Server Switcher
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#  Run:  bash switch-vpn-server.sh
# ══════════════════════════════════════════════════════════════════════════════

GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'
BLU='\033[0;34m'; CYN='\033[0;36m'; DIM='\033[2m'; BLD='\033[1m'; NC='\033[0m'

clear 2>/dev/null||true
echo -e "\n${GRN}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GRN}${BLD}  ║      PROXHQVPN — Switch VPN Server           ║${NC}"
echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"

WG_CONF_DIR="/etc/wireguard"
[[ ! -d "$WG_CONF_DIR" ]] && WG_CONF_DIR="$HOME/.config/wireguard"

if ! command -v wg-quick &>/dev/null; then
  echo -e "  ${RED}✗${NC}  wg-quick not found. Run the ProxhqVPN installer first.\n"
  read -rp "  Press Enter to close..." && exit 1
fi

mapfile -t CONFIGS < <(find "$WG_CONF_DIR" -name "proxhqvpn-*.conf" 2>/dev/null | sort)
if [[ ${#CONFIGS[@]} -eq 0 ]]; then
  echo -e "  ${RED}✗${NC}  No ProxhqVPN tunnels found in $WG_CONF_DIR\n"
  read -rp "  Press Enter to close..." && exit 1
fi

ACTIVE=$(sudo wg show interfaces 2>/dev/null | tr ' ' '\n' | grep "proxhqvpn" | head -1 || true)

echo -e "  ${BLD}Select a server to connect:${NC}\n"
IDX=1
declare -a NAMES PATHS
for CF in "${CONFIGS[@]}"; do
  TN=$(basename "$CF" .conf); STEM="${TN#proxhqvpn-}"
  case "$STEM" in *london*) F="🇬🇧";; *chicago*) F="🇺🇸";; *los*) F="🇺🇸";; *tokyo*) F="🇯🇵";; *) F="🌐";; esac
  R=$(echo "$STEM"|tr '-' ' '|awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
  EP=$(grep -i "^Endpoint" "$CF" | head -1 | sed 's/Endpoint *= *//' || echo "")
  if [[ "$TN" == "$ACTIVE" ]]; then
    echo -e "  ${GRN}${BLD}[$IDX]${NC}  $F  ${BLD}$R${NC}  ${GRN}← ACTIVE${NC}  ${DIM}$EP${NC}"
  else
    echo -e "  ${DIM}[$IDX]${NC}  $F  ${BLD}$R${NC}  ${DIM}$EP${NC}"
  fi
  NAMES+=("$TN"); PATHS+=("$CF"); IDX=$((IDX+1))
done
echo ""
[[ -n "$ACTIVE" ]] && echo -e "  ${DIM}[0]  Disconnect (stop $ACTIVE)${NC}\n"
read -rp "  Enter number (or 0 to disconnect, q to quit): " CHOICE

[[ "$CHOICE" == "q" || "$CHOICE" == "Q" ]] && { echo -e "\n  Cancelled.\n"; exit 0; }

if [[ "$CHOICE" == "0" ]]; then
  [[ -n "$ACTIVE" ]] && sudo wg-quick down "$ACTIVE" 2>/dev/null && echo -e "\n  ${GRN}✓${NC}  Disconnected."
  echo ""; read -rp "  Press Enter to close..." && exit 0
fi

if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [[ "$CHOICE" -lt 1 || "$CHOICE" -gt ${#NAMES[@]} ]]; then
  echo -e "\n  ${RED}Invalid choice.${NC}\n"; read -rp "  Press Enter..." && exit 1
fi

SEL_IDX=$(( CHOICE-1 ))
SEL_NAME="${NAMES[$SEL_IDX]}"; SEL_PATH="${PATHS[$SEL_IDX]}"

echo -e "\n  ${YLW}→${NC}  Stopping all ProxhqVPN tunnels..."
for N in "${NAMES[@]}"; do sudo wg-quick down "$N" 2>/dev/null||true; done
sleep 0.5

echo -e "  ${YLW}→${NC}  Connecting to $SEL_NAME..."
if sudo wg-quick up "$SEL_PATH" 2>/dev/null; then
  echo -e "\n  ${GRN}${BLD}✓  Connected: $SEL_NAME${NC}"
  echo -e "  ${DIM}Status: sudo wg show${NC}"
else
  echo -e "\n  ${RED}✗  Failed. Run as root or check: sudo wg-quick up $SEL_PATH${NC}"
fi
echo ""; read -rp "  Press Enter to close..."
