#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ProxhqVPN — Linux Uninstaller  v5.1
#  © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
#
#  Run:  bash Uninstall-Linux.sh
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

INSTALL="$HOME/.config/proxhqvpn"
WG_CONF_DIRS=("/etc/wireguard" "$HOME/.config/wireguard")

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
ok()      { echo -e "  ${GRN}✓${NC}  $*"; }
warn()    { echo -e "  ${YLW}!${NC}  $*"; }
confirm() { read -rp "  $1 [y/N] " _c; [[ "${_c:-n}" =~ ^[Yy]$ ]]; }

clear 2>/dev/null || true
echo -e "\n${RED}${BLD}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BLD}  ║      PROXHQVPN — LINUX UNINSTALLER  v5.1       ║${NC}"
echo -e "${RED}${BLD}  ╚══════════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC${NC}\n"
echo -e "  This will remove:\n"
echo -e "  ${YLW}•${NC}  All ProxhqVPN WireGuard tunnel configs"
echo -e "  ${YLW}•${NC}  Systemd wg-quick@proxhqvpn-* service entries"
echo -e "  ${YLW}•${NC}  ProxhqVPN Desktop shortcuts"
echo -e "  ${YLW}•${NC}  ProxhqVPN install data and logs"
echo -e "  ${DIM}  WireGuard itself will NOT be removed${NC}\n"
echo -e "────────────────────────────────────────────────────────\n"

confirm "Continue with uninstall?" || { echo -e "\n  Uninstall cancelled.\n"; exit 0; }
echo ""

# ── 1. Bring down + disable systemd services ─────────────────────────────────
echo -e "  ${BLD}[1/5]${NC} Stopping tunnels and disabling services..."
TUNNELS_REMOVED=0

for CONF_DIR in "${WG_CONF_DIRS[@]}"; do
  [[ -d "$CONF_DIR" ]] || continue
  while IFS= read -r -d '' cf; do
    TN=$(basename "$cf" .conf)

    # Stop and disable systemd service
    if command -v systemctl &>/dev/null; then
      sudo systemctl disable --now "wg-quick@${TN}" 2>/dev/null && \
        ok "Disabled service: wg-quick@${TN}" || true
    fi

    # Bring down tunnel via wg-quick
    if command -v wg-quick &>/dev/null; then
      sudo wg-quick down "$TN" 2>/dev/null && ok "Stopped: $TN" || true
    fi

    # Remove conf file
    sudo rm -f "$cf" 2>/dev/null && ok "Removed: $cf" || warn "Could not remove: $cf"
    TUNNELS_REMOVED=$(( TUNNELS_REMOVED + 1 ))
  done < <(find "$CONF_DIR" -name "proxhqvpn-*.conf" -print0 2>/dev/null)
done

if [[ $TUNNELS_REMOVED -eq 0 ]]; then
  warn "No ProxhqVPN tunnel configs found"
else
  ok "$TUNNELS_REMOVED tunnel config(s) removed"
fi

# ── 2. Remove Desktop shortcuts ───────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[2/5]${NC} Removing Desktop shortcuts..."
for f in \
  "$HOME/Desktop/ProxhqVPN.desktop" \
  "$HOME/Desktop/switch-vpn-server.sh" \
  "$HOME/.local/share/applications/ProxhqVPN.desktop"; do
  if [[ -f "$f" ]]; then
    rm -f "$f" && ok "Removed: $f"
  fi
done

# Update desktop database if available
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# ── 3. Remove install data ────────────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[3/5]${NC} Removing install data..."
if [[ -d "$INSTALL" ]]; then
  rm -rf "$INSTALL" && ok "Removed: $INSTALL"
else
  warn "Install dir not found: $INSTALL"
fi

# ── 4. Clean up empty conf dirs ───────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[4/5]${NC} Cleaning up config directories..."
for CONF_DIR in "${WG_CONF_DIRS[@]}"; do
  [[ -d "$CONF_DIR" ]] || continue
  if [[ -z "$(ls -A "$CONF_DIR" 2>/dev/null)" ]]; then
    rmdir "$CONF_DIR" 2>/dev/null && ok "Removed empty dir: $CONF_DIR" || true
  else
    warn "Directory not empty (other configs present) — skipping: $CONF_DIR"
  fi
done

# ── 5. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BLD}[5/5]${NC} Done."
echo -e "\n────────────────────────────────────────────────────────"
echo -e "\n  ${GRN}${BLD}✓  ProxhqVPN has been removed.${NC}\n"
echo -e "  ${DIM}WireGuard is still installed (not removed — used by other VPNs).${NC}"
echo -e "  ${DIM}To remove WireGuard:${NC}"
echo -e "  ${DIM}  Ubuntu/Debian:  sudo apt remove wireguard-tools${NC}"
echo -e "  ${DIM}  Fedora:         sudo dnf remove wireguard-tools${NC}"
echo -e "  ${DIM}  Arch:           sudo pacman -R wireguard-tools${NC}\n"
