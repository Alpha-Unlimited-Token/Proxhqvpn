#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — Easy Setup (run this if you downloaded the zip manually)
#
#  HOW TO USE:
#    1. Extract the zip file
#    2. Open Terminal in the extracted folder
#    3. Run:  bash proxhqvpn-setup.sh
#
#  That's it. ProxhqVPN will start and open in your browser automatically.
# ══════════════════════════════════════════════════════════════════════════════

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# ── Colours ───────────────────────────────────────────────────────────────────
GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'; BLD='\033[1m'
ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
info() { echo -e "  →  $*"; }
warn() { echo -e "  ${YLW}!${NC}  $*"; }
err()  { echo -e "\n  ${RED}✗  $*${NC}\n"; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${GRN}${BLD}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${GRN}${BLD}  ║       PROXHQVPN — EASY SETUP             ║${NC}"
echo -e "${GRN}${BLD}  ╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Detect OS ────────────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Linux)  OS_LABEL="Linux ($ARCH)" ;;
  Darwin) OS_LABEL="macOS ($ARCH)" ;;
  *)      err "Unknown OS: $OS. On Windows, run start.bat instead." ;;
esac
ok "Detected: $OS_LABEL"

# ── Fix quarantine (macOS only) ───────────────────────────────────────────────
if [[ "$OS" == "Darwin" ]]; then
  xattr -cr "$DIR" 2>/dev/null && ok "macOS quarantine removed" || true
fi

# ── Make executables runnable ─────────────────────────────────────────────────
chmod +x "$DIR/ProxhqVPN"  2>/dev/null && ok "ProxhqVPN executable ready" || true
chmod +x "$DIR/start.sh"  2>/dev/null || true
chmod +x "$DIR/ghostd.py" 2>/dev/null || true

# ── Pick an open port ─────────────────────────────────────────────────────────
PORT=7474
for try_port in 7474 7475 7476 7477 8080 8081; do
  if ! (command -v lsof &>/dev/null && lsof -iTCP:"$try_port" -sTCP:LISTEN &>/dev/null 2>&1); then
    PORT=$try_port
    break
  fi
done
ok "Port $PORT is available"

# ── Tell the user what's about to happen ──────────────────────────────────────
echo ""
echo -e "  ${BLD}ProxhqVPN is ready to start.${NC}"
echo ""
echo "  Dashboard:  http://localhost:$PORT"
echo "  Location:   $DIR"
echo ""
echo -e "  ${YLW}Press Ctrl+C at any time to stop ProxhqVPN.${NC}"
echo ""
echo "  Starting in 3 seconds..."
sleep 3

# ── Open browser after 2s ────────────────────────────────────────────────────
(sleep 2 && {
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:${PORT}" &>/dev/null &
  elif command -v open &>/dev/null; then
    open "http://localhost:${PORT}" &>/dev/null &
  fi
}) &

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GRN}  ● ProxhqVPN running at http://localhost:${PORT}${NC}"
echo ""
PORT="$PORT" "$DIR/ProxhqVPN"
