#!/usr/bin/env bash
# ProxhqVPN — macOS Setup Launcher
# Double-click this file in Finder to start the setup wizard.
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Remove quarantine on everything in this folder
xattr -cr "$DIR" 2>/dev/null || true

# Make wizard executable
chmod +x "$DIR/Install-macOS.sh" 2>/dev/null || true

# Clear Terminal and run wizard
clear 2>/dev/null || true
exec bash "$DIR/Install-macOS.sh"
