#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ProxhqVPN × VPN Gate — One-Command Auto-Connect
#  Usage:
#    ./proxhqvpn-connect.sh                  # auto-pick best server
#    ./proxhqvpn-connect.sh JP               # best server in Japan
#    ./proxhqvpn-connect.sh 123.45.67.89     # connect to specific IP
#    ./proxhqvpn-connect.sh --list           # list top 10 servers
# ─────────────────────────────────────────────────────────────
set -euo pipefail
IFS=$'\n\t'

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

PROXHQVPN_PORT="${PROXHQVPN_PORT:-7474}"
DASHBOARD="http://localhost:${PROXHQVPN_PORT}"
OVPN_FILE="/tmp/proxhqvpn-vpngate-$$.ovpn"
CREDS_FILE="/tmp/proxhqvpn-vpngate-creds-$$.txt"
ARG="${1:-}"

banner() {
  echo -e "${CYAN}"
  echo "  ╔═══════════════════════════════════════════╗"
  echo "  ║     ProxhqVPN × VPN Gate Auto-Connect      ║"
  echo "  ║     University of Tsukuba Academic VPN    ║"
  echo "  ╚═══════════════════════════════════════════╝"
  echo -e "${NC}"
}

cleanup() {
  rm -f "$OVPN_FILE" "$CREDS_FILE" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

install_openvpn() {
  echo -e "${YELLOW}OpenVPN not found. Installing...${NC}"
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y openvpn
  elif command -v yum &>/dev/null; then
    sudo yum install -y openvpn
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y openvpn
  elif command -v pacman &>/dev/null; then
    sudo pacman -Sy --noconfirm openvpn
  elif command -v brew &>/dev/null; then
    brew install openvpn
  else
    echo -e "${RED}Cannot auto-install OpenVPN. Please install manually:${NC}"
    echo "  https://openvpn.net/community-downloads/"
    exit 1
  fi
  echo -e "${GREEN}OpenVPN installed.${NC}"
}

fetch_from_dashboard() {
  local endpoint="$1"
  curl -sf --max-time 8 "${DASHBOARD}${endpoint}" 2>/dev/null
}

fetch_vpngate_direct() {
  curl -sf --max-time 15 "https://www.vpngate.net/api/iphone/" 2>/dev/null
}

list_servers() {
  echo -e "${CYAN}Top 10 VPN Gate Servers:${NC}"
  echo -e "  ${BOLD}IP               Country  Ping   Speed      Score${NC}"
  echo "  ─────────────────────────────────────────────────"
  if RAW=$(fetch_from_dashboard "/api/vpngate/servers?limit=10" 2>/dev/null); then
    echo "$RAW" | grep -o '"ip":"[^"]*"\|"countryCode":"[^"]*"\|"ping":[0-9]*\|"speedMbps":[0-9.]*\|"score":[0-9]*' | \
    paste - - - - - 2>/dev/null | head -10 | while IFS= read -r line; do
      ip=$(echo "$line" | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
      cc=$(echo "$line" | grep -o '"countryCode":"[^"]*"' | cut -d'"' -f4)
      ping=$(echo "$line" | grep -o '"ping":[0-9]*' | cut -d: -f2)
      speed=$(echo "$line" | grep -o '"speedMbps":[0-9.]*' | cut -d: -f2)
      score=$(echo "$line" | grep -o '"score":[0-9]*' | cut -d: -f2)
      printf "  %-17s %-9s %-7s %-11s %s\n" "$ip" "$cc" "${ping}ms" "${speed}Mbps" "$score"
    done
  else
    echo -e "  ${RED}Dashboard not reachable. Start ProxhqVPN first.${NC}"
  fi
  exit 0
}

banner

[ "$ARG" = "--list" ] && list_servers

if ! command -v openvpn &>/dev/null; then install_openvpn; fi

echo -e "${GREEN}→ Finding best VPN Gate server...${NC}"

SERVER_IP=""
COUNTRY_NAME=""
PING_MS=""
SPEED_MBPS=""

if DASHBOARD_UP=$(fetch_from_dashboard "/api/vpngate/servers/best${ARG:+?country=$ARG}" 2>/dev/null) && [ -n "$DASHBOARD_UP" ]; then
  echo -e "  Source: ${CYAN}ProxhqVPN Dashboard${NC} (cached + filtered)"
  SERVER_IP=$(echo "$DASHBOARD_UP" | grep -o '"ip":"[^"]*"' | head -1 | cut -d'"' -f4)
  COUNTRY_NAME=$(echo "$DASHBOARD_UP" | grep -o '"country":"[^"]*"' | head -1 | cut -d'"' -f4)
  PING_MS=$(echo "$DASHBOARD_UP" | grep -o '"ping":[0-9]*' | head -1 | cut -d: -f2)
  SPEED_MBPS=$(echo "$DASHBOARD_UP" | grep -o '"speedMbps":[0-9.]*' | head -1 | cut -d: -f2)

  echo -e "  ${BOLD}Server:${NC} ${GREEN}${SERVER_IP}${NC} — ${COUNTRY_NAME} | ${PING_MS}ms | ${SPEED_MBPS}Mbps"
  fetch_from_dashboard "/api/vpngate/servers/${SERVER_IP}/config" > "$OVPN_FILE"
else
  echo -e "  ${YELLOW}Dashboard not reachable. Fetching directly from VPN Gate...${NC}"
  RAW=$(fetch_vpngate_direct)
  if [ -z "$RAW" ]; then
    echo -e "${RED}Cannot reach VPN Gate. Check internet connection.${NC}"; exit 1
  fi

  if [ -n "$ARG" ] && [[ "$ARG" =~ ^[A-Za-z]{2}$ ]]; then
    FILTER_LINE=$(echo "$RAW" | grep -v "^\*" | tail -n +2 | \
      awk -F',' -v cc="${ARG^^}" 'tolower($7) == tolower(cc) || $7 == cc' | \
      sort -t',' -k3 -nr | head -1)
  elif [ -n "$ARG" ] && [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    FILTER_LINE=$(echo "$RAW" | grep -v "^\*" | tail -n +2 | awk -F',' -v ip="$ARG" '$2 == ip' | head -1)
  else
    FILTER_LINE=$(echo "$RAW" | grep -v "^\*" | tail -n +2 | sort -t',' -k3 -nr | head -1)
  fi

  if [ -z "$FILTER_LINE" ]; then
    echo -e "${RED}No matching server found.${NC}"; exit 1
  fi

  SERVER_IP=$(echo "$FILTER_LINE" | cut -d',' -f2)
  COUNTRY_NAME=$(echo "$FILTER_LINE" | cut -d',' -f6)
  PING_MS=$(echo "$FILTER_LINE" | cut -d',' -f4)
  B64=$(echo "$FILTER_LINE" | awk -F',' '{print $NF}')
  echo "$B64" | base64 -d > "$OVPN_FILE" 2>/dev/null || \
    { echo -e "${RED}Failed to decode OpenVPN config${NC}"; exit 1; }

  echo -e "  ${BOLD}Server:${NC} ${GREEN}${SERVER_IP}${NC} — ${COUNTRY_NAME} | ${PING_MS}ms"
fi

echo "vpn" > "$CREDS_FILE"
echo "vpn" >> "$CREDS_FILE"
chmod 600 "$CREDS_FILE"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Connecting...${NC} Press ${BOLD}Ctrl+C${NC} to disconnect"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

sudo openvpn \
  --config "$OVPN_FILE" \
  --auth-user-pass "$CREDS_FILE" \
  --verb 3

echo ""
echo -e "${YELLOW}Disconnected from VPN Gate.${NC}"
