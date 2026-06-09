#!/usr/bin/env bash
set -euo pipefail
WG_IFACE=${WG_IFACE:-wg0}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/proxhqvpn/wireguard}
mkdir -p "$BACKUP_DIR"
cp "/etc/wireguard/${WG_IFACE}.conf" "$BACKUP_DIR/${WG_IFACE}.conf.$(date -u +%Y%m%d%H%M%S)"
NEW_PRIVATE=$(wg genkey)
NEW_PUBLIC=$(printf '%s' "$NEW_PRIVATE" | wg pubkey)
umask 077
printf '%s
' "$NEW_PRIVATE" > "/etc/wireguard/${WG_IFACE}.private.next"
printf '%s
' "$NEW_PUBLIC" > "/etc/wireguard/${WG_IFACE}.public.next"
echo "Generated next WireGuard keypair. Publish public key through control plane, then atomically activate during maintenance window."
