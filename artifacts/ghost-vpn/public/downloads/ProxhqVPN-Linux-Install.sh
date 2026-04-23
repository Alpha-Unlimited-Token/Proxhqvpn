#!/usr/bin/env bash
# ProxhqVPN Linux Installer — GUI Wizard
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Make executable: chmod +x ProxhqVPN-Linux-Install.sh
# Then double-click in file manager or run: ./ProxhqVPN-Linux-Install.sh

set -euo pipefail

BRAND="ProxhqVPN"
URL="https://proxhqvpn.com"
INSTALL_DIR="$HOME/.local/share/proxhqvpn"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/Desktop"
APP_DIR="$HOME/.local/share/applications"
ICON_URL="https://proxhqvpn.com/icon-final2.png"
ICON_PATH="$HOME/.local/share/proxhqvpn/icon.png"

# ─── GUI backend detection ────────────────────────────────────────────────────
GUI=""
if command -v zenity   &>/dev/null; then GUI="zenity";  fi
if command -v kdialog  &>/dev/null && [ -z "$GUI" ]; then GUI="kdialog"; fi
if command -v yad      &>/dev/null; then GUI="yad";     fi   # yad overrides if available

# ─── GUI helpers ──────────────────────────────────────────────────────────────
info()    { local t="$1" m="$2"
  case "$GUI" in
    yad)     yad --title="$BRAND Setup" --text="$m" --button="OK:0" --width=420 --image=dialog-information 2>/dev/null ;;
    zenity)  zenity --info --title="$BRAND Setup" --text="$m" --width=400 2>/dev/null ;;
    kdialog) kdialog --title="$BRAND Setup" --msgbox "$m" 2>/dev/null ;;
    *)       echo -e "\n[INFO] $m\n" ;;
  esac
}

question() { local t="$1" m="$2"
  case "$GUI" in
    yad)     yad --title="$BRAND Setup" --text="$m" --button="Yes:0" --button="No:1" --width=420 2>/dev/null; return $? ;;
    zenity)  zenity --question --title="$BRAND Setup" --text="$m" --width=400 2>/dev/null; return $? ;;
    kdialog) kdialog --title="$BRAND Setup" --yesno "$m" 2>/dev/null; return $? ;;
    *)       read -rp "$m [y/N] " ans; [[ "$ans" =~ ^[Yy] ]]; return $? ;;
  esac
}

progress_start() {
  case "$GUI" in
    yad)
      FIFO=$(mktemp -u); mkfifo "$FIFO"
      yad --progress --title="$BRAND Setup — Installing" \
          --text="Installing ProxhqVPN..." --percentage=0 \
          --auto-close --width=420 --no-cancel < "$FIFO" &
      YAD_PID=$!
      exec 3>"$FIFO"
      ;;
    zenity)
      FIFO=$(mktemp -u); mkfifo "$FIFO"
      zenity --progress --title="$BRAND Setup — Installing" \
             --text="Installing ProxhqVPN..." --percentage=0 \
             --auto-close --width=400 < "$FIFO" &
      ZEN_PID=$!
      exec 3>"$FIFO"
      ;;
    *)
      echo "Installing ProxhqVPN..."
      ;;
  esac
}

progress_step() { local pct="$1" label="$2"
  case "$GUI" in
    yad|zenity) echo "$pct" >&3; echo "# $label" >&3 ;;
    *)          echo "  [$pct%] $label" ;;
  esac
}

progress_done() {
  case "$GUI" in
    yad|zenity)
      echo "100" >&3; echo "# Done!" >&3
      exec 3>&-
      sleep 0.3
      rm -f "$FIFO"
      ;;
    *) echo "Done." ;;
  esac
}

license_dialog() {
  local lic
  lic=$(cat <<'LICENSE'
PROXHQVPN END USER LICENSE AGREEMENT
Copyright (c) 2026 ALPHA UNLIMITED TECHNOLOGIES LLC. All rights reserved.

1. LICENSE GRANT
   A limited, non-exclusive, non-transferable license to install and
   use ProxhqVPN on devices you own or control.

2. THIRD-PARTY SOFTWARE CONSENT
   ProxhqVPN requires WireGuard (open-source, GPLv2, by Jason A. Donenfeld).
   By proceeding you authorize WireGuard to be installed on your device.

3. PRIVACY - ZERO LOGS
   We do not log, store, or monitor your VPN traffic, browsing activity,
   or connection timestamps.

4. LIMITATION OF LIABILITY
   ALPHA UNLIMITED TECHNOLOGIES LLC shall not be liable for indirect,
   incidental, or consequential damages.

5. GOVERNING LAW
   Governed by the laws of the jurisdiction in which ALPHA UNLIMITED
   TECHNOLOGIES LLC is registered.

WireGuard(R) is a registered trademark of Jason A. Donenfeld.
LICENSE
)
  case "$GUI" in
    yad)
      echo "$lic" | yad --text-info --title="$BRAND — License Agreement" \
        --width=540 --height=360 --fontname="Monospace 9" \
        --button="I Accept:0" --button="Cancel:1" 2>/dev/null
      return $?
      ;;
    zenity)
      echo "$lic" | zenity --text-info --title="$BRAND — License Agreement" \
        --width=520 --height=340 --checkbox="I accept the terms" 2>/dev/null
      return $?
      ;;
    kdialog)
      echo "$lic" | kdialog --title "$BRAND — License Agreement" \
        --textinputbox "License Agreement" 2>/dev/null
      question "License" "Do you accept the license agreement?"
      return $?
      ;;
    *)
      echo ""; echo "LICENSE AGREEMENT:"; echo "$lic"; echo ""
      read -rp "Type 'accept' to continue: " ans
      [[ "$ans" == "accept" ]]; return $?
      ;;
  esac
}

welcome_dialog() {
  local msg
  msg="Welcome to ProxhqVPN Setup\n\nThis wizard will install ProxhqVPN on your Linux computer.\n\nFeatures:\n  ● Military-grade WireGuard encryption\n  ● Zero-logs privacy policy\n  ● Instant kill switch protection\n  ● Double-hop anonymity routing\n  ● Command Center security toolkit\n\nClick OK to continue."
  case "$GUI" in
    yad)
      yad --info --title="$BRAND Setup" --text="$msg" \
          --button="Next:0" --button="Cancel:1" --width=440 --image=dialog-information 2>/dev/null
      return $?
      ;;
    zenity)
      zenity --info --title="$BRAND Setup — Welcome" --text="$msg" \
             --width=420 --ok-label="Next" 2>/dev/null
      return $?
      ;;
    *)
      echo -e "$msg"; read -rp "Press Enter to continue or Ctrl+C to cancel..."
      ;;
  esac
}

# ─── Install WireGuard ────────────────────────────────────────────────────────
install_wireguard() {
  local msg="WireGuard is required for ProxhqVPN encrypted connections.\n\nInstall WireGuard now?\n(Requires sudo/admin password)"
  if question "WireGuard" "$msg"; then
    # Detect package manager and install
    if command -v apt-get &>/dev/null; then
      x-terminal-emulator -e "sudo apt-get install -y wireguard && echo 'WireGuard installed!' && sleep 2" 2>/dev/null \
        || gnome-terminal -- bash -c "sudo apt-get install -y wireguard; echo 'Done - press Enter'; read" 2>/dev/null \
        || sudo apt-get install -y wireguard
    elif command -v dnf &>/dev/null; then
      gnome-terminal -- bash -c "sudo dnf install -y wireguard-tools; echo 'Done - press Enter'; read" 2>/dev/null \
        || sudo dnf install -y wireguard-tools
    elif command -v pacman &>/dev/null; then
      gnome-terminal -- bash -c "sudo pacman -S --noconfirm wireguard-tools; echo 'Done - press Enter'; read" 2>/dev/null \
        || sudo pacman -S --noconfirm wireguard-tools
    elif command -v zypper &>/dev/null; then
      sudo zypper install -y wireguard-tools
    else
      info "WireGuard" "Please visit wireguard.com to install WireGuard for your distribution."
      xdg-open "https://www.wireguard.com/install/" &>/dev/null || true
    fi
  fi
}

# ─── Main flow ────────────────────────────────────────────────────────────────
main() {

  # 1. Welcome
  welcome_dialog || exit 0

  # 2. License
  license_dialog || { info "Cancelled" "Installation cancelled."; exit 0; }

  # 3. Install files
  progress_start

  progress_step 10 "Creating program folder..."
  mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APP_DIR"

  progress_step 25 "Writing launcher..."
  cat > "$BIN_DIR/proxhqvpn" << 'LAUNCHER'
#!/usr/bin/env bash
xdg-open "https://proxhqvpn.com" &>/dev/null \
  || sensible-browser "https://proxhqvpn.com" &>/dev/null \
  || google-chrome "https://proxhqvpn.com" &>/dev/null \
  || firefox "https://proxhqvpn.com" &>/dev/null \
  || echo "Open https://proxhqvpn.com in your browser"
LAUNCHER
  chmod +x "$BIN_DIR/proxhqvpn"

  progress_step 45 "Downloading icon..."
  curl -sL "$ICON_URL" -o "$ICON_PATH" 2>/dev/null || true

  progress_step 62 "Creating desktop shortcut..."
  cat > "$DESKTOP_DIR/ProxhqVPN.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=ProxhqVPN
Comment=Military-grade WireGuard VPN by ALPHA UNLIMITED TECHNOLOGIES LLC
Exec=$BIN_DIR/proxhqvpn
Icon=$ICON_PATH
Terminal=false
Categories=Network;Security;
StartupNotify=true
DESKTOP
  chmod +x "$DESKTOP_DIR/ProxhqVPN.desktop"

  progress_step 78 "Registering application..."
  cp "$DESKTOP_DIR/ProxhqVPN.desktop" "$APP_DIR/ProxhqVPN.desktop"
  update-desktop-database "$APP_DIR" &>/dev/null || true

  progress_step 92 "Writing uninstaller..."
  cat > "$INSTALL_DIR/uninstall.sh" << UNINSTALL
#!/usr/bin/env bash
rm -f "$BIN_DIR/proxhqvpn"
rm -f "$DESKTOP_DIR/ProxhqVPN.desktop"
rm -f "$APP_DIR/ProxhqVPN.desktop"
rm -rf "$INSTALL_DIR"
echo "ProxhqVPN uninstalled."
UNINSTALL
  chmod +x "$INSTALL_DIR/uninstall.sh"

  progress_step 100 "Done!"
  progress_done

  # 4. WireGuard
  install_wireguard

  # 5. Finish
  local fin_msg="✓ ProxhqVPN Installed Successfully!\n\nA desktop shortcut has been created.\nRun 'proxhqvpn' in terminal or click the desktop icon.\n\nSign in at proxhqvpn.com to download your WireGuard config\nand start your encrypted connection.\n\nTo uninstall: run ~/.local/share/proxhqvpn/uninstall.sh"
  if question "Launch" "$fin_msg\n\nOpen ProxhqVPN now?"; then
    xdg-open "https://proxhqvpn.com" &>/dev/null &
  fi
}

main "$@"
