#!/usr/bin/env bash
# ProxhqVPN — Linux Setup Launcher
# Run:  bash Launch-ProxhqVPN-Setup.sh
# Or double-click in your file manager and choose "Run in Terminal"
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$DIR/Install-Linux.sh" 2>/dev/null || true
exec bash "$DIR/Install-Linux.sh"
