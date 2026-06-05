#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — macOS Uninstaller  v5.1
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#
#  Double-click to run, or: bash Uninstall-macOS.sh
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

INSTALL="$HOME/Library/Application Support/ProxhqVPN"
WG_CONF_DIRS=("/etc/wireguard" "$HOME/Library/Application Support/ProxhqVPN/tunnels")

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
warn() { echo -e "  ${YLW}!${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC}  $*"; }
sep()  { echo -e "${DIM}──────────────────────────────────────────────────────${NC}"; }

notify() { osascript -e "display notification \"$1\" with title \"ProxhqVPN\"" 2>/dev/null || true; }
confirm_dialog() {
  osascript 2>/dev/null <<ASCRIPT || true
set r to button returned of (display dialog "$1" buttons {"Cancel","Uninstall"} default button "Uninstall" cancel button "Cancel" with title "ProxhqVPN Uninstaller" with icon caution)
return r
ASCRIPT
}

clear 2>/dev/null || true
echo -e "\n${RED}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BLD}  ║      PROXHQVPN — macOS UNINSTALLER  v5.1       ║${NC}"
echo -e "${RED}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"

echo -e "  This will remove:\n"
echo -e "  ${YLW}•${NC}  All ProxhqVPN WireGuard tunnel configs"
echo -e "  ${YLW}•${NC}  ProxhqVPN Desktop shortcuts"
echo -e "  ${YLW}•${NC}  ProxhqVPN install data and logs"
echo -e "  ${DIM}  WireGuard itself will NOT be removed (you may use it for other VPNs)${NC}\n"
sep

# Confirm via GUI dialog
BTN=$(confirm_dialog "This will remove all ProxhqVPN tunnels, configs, and shortcuts from your Mac.\n\nWireGuard itself will NOT be removed.\n\nAre you sure you want to uninstall ProxhqVPN?") || true
if [[ "$BTN" != "Uninstall" ]]; then
  echo -e "\n  Uninstall cancelled.\n"; exit 0
fi

echo ""
echo -e "${BLD}  Removing ProxhqVPN...${NC}\n"

# ── 1. Bring down all active tunnels ─────────────────────────────────────────
echo -e "  ${BLD}[1/5]${NC} Stopping active tunnels..."
WG_QUICK=""
for loc in /opt/homebrew/bin/wg-quick /usr/local/bin/wg-quick; do
  [[ -x "$loc" ]] && WG_QUICK="$loc" && break
done

TUNNELS_REMOVED=0
for CONF_DIR in "${WG_CONF_DIRS[@]}"; do
  if [[ -d "$CONF_DIR" ]]; then
    while IFS= read -r -d '' cf; do
      TN=$(basename "$cf" .conf)
      if [[ -n "$WG_QUICK" ]]; then
        sudo "$WG_QUICK" down "$TN" 2>/dev/null && ok "Stopped tunnel: $TN" || true
      fi
      sudo rm -f "$cf" 2>/dev/null && ok "Removed: $cf" || warn "Could not remove: $cf"
      TUNNELS_REMOVED=$(( TUNNELS_REMOVED + 1 ))
    done < <(find "$CONF_DIR" -name "proxhqvpn-*.conf" -print0 2>/dev/null)
  fi
done

if [[ $TUNNELS_REMOVED -eq 0 ]]; then
  warn "No ProxhqVPN tunnel configs found (may already be removed)"
else
  ok "$TUNNELS_REMOVED tunnel config(s) removed"
fi

# ── 2. Remove Desktop shortcuts ───────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[2/5]${NC} Removing Desktop shortcuts..."
for f in \
  "$HOME/Desktop/Switch VPN Server.command" \
  "$HOME/Desktop/ProxhqVPN.command" \
  "$HOME/Desktop/Uninstall ProxhqVPN.command"; do
  if [[ -f "$f" ]]; then
    rm -f "$f" && ok "Removed: $(basename "$f")"
  fi
done

# ── 3. Remove install data ────────────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[3/5]${NC} Removing install data..."
if [[ -d "$INSTALL" ]]; then
  rm -rf "$INSTALL" && ok "Removed: $INSTALL"
else
  warn "Install dir not found: $INSTALL"
fi

# ── 4. Remove tunnel conf dirs (if empty) ────────────────────────────────────
echo ""
echo -e "  ${BLD}[4/5]${NC} Cleaning up config directories..."
for CONF_DIR in "${WG_CONF_DIRS[@]}"; do
  if [[ -d "$CONF_DIR" ]]; then
    # Only remove if directory is now empty (don't nuke other VPN configs)
    if [[ -z "$(ls -A "$CONF_DIR" 2>/dev/null)" ]]; then
      rmdir "$CONF_DIR" 2>/dev/null && ok "Removed empty dir: $CONF_DIR" || true
    else
      warn "Directory not empty (other configs present) — skipping: $CONF_DIR"
    fi
  fi
done

# ── 5. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[5/5]${NC} Finalizing..."
notify "ProxhqVPN uninstalled"
sep
echo ""
echo -e "  ${GRN}${BLD}✓  ProxhqVPN has been removed from your Mac.${NC}\n"
echo -e "  ${DIM}WireGuard is still installed (used by other VPNs — not removed).${NC}"
echo -e "  ${DIM}To remove WireGuard: brew uninstall wireguard-tools${NC}"
echo -e "  ${DIM}              or:     trash /Applications/WireGuard.app${NC}\n"

osascript -e "display dialog \"ProxhqVPN has been successfully removed.\n\nWireGuard was NOT removed — you may use it for other VPNs.\nTo remove WireGuard: brew uninstall wireguard-tools\" buttons {\"OK\"} default button \"OK\" with title \"ProxhqVPN Uninstaller\" with icon note" 2>/dev/null || true
