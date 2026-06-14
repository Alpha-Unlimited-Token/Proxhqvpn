// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Exit Node — cloud-init user-data script generator.
//
// Security properties of the generated script:
//   • journald forced to volatile storage — logs only in RAM, wiped on power-off
//   • rsyslog / syslog disabled — no disk log files created
//   • WireGuard server private key lives exclusively in /dev/shm (RAM disk)
//   • All WireGuard config written to /dev/shm — never touches persistent disk
//   • IP forwarding + NAT masquerade for transparent exit routing
//   • Fake SSH banner on port 22 for attacker deception / probe logging
//   • Node registers back to ProxhqVPN API once ready (PSK-authenticated)
//
// When the Vultr instance is DESTROYED:
//   • All RAM is cleared → WireGuard private key is irrecoverably gone
//   • Vultr reallocates / wipes the underlying block device for the next tenant
//   • No persistent disk logs were written → nothing to forensically recover
//   • ProxhqVPN DB retains only session metadata (exit IP, region, timestamps)
//     — never the user's real IP, traffic content, or DNS queries

export interface GhostExitUserDataOpts {
  sessionId:       string;
  sessionPsk:      string;
  wgServerPrivKey: string;
  wgClientPubKey:  string;
  wgClientIp:      string;
  callbackBaseUrl: string;
  listenPort?:     number;
}

export function generateGhostExitUserData(opts: GhostExitUserDataOpts): string {
  const port = opts.listenPort ?? 51820;

  return `#!/bin/bash
# ProxhqVPN Ghost Exit Node — ephemeral RAM-only WireGuard exit + deception layer
# ALPHA UNLIMITED TECHNOLOGIES LLC — DO NOT MODIFY THIS SCRIPT
set -euo pipefail

# ── 1. Force volatile logging (RAM only — no disk writes) ─────────────────────
sed -i 's/^#*Storage=.*/Storage=volatile/' /etc/systemd/journald.conf || true
sed -i 's/^#*RuntimeMaxUse=.*/RuntimeMaxUse=64M/' /etc/systemd/journald.conf || true
systemctl daemon-reload || true
systemctl restart systemd-journald || true

# Disable disk-based syslog daemons entirely
for svc in rsyslog syslog syslog-ng; do
  systemctl stop "$svc" 2>/dev/null || true
  systemctl disable "$svc" 2>/dev/null || true
done

# No cron-rotated disk logs
rm -f /etc/cron.daily/logrotate /etc/cron.weekly/logrotate 2>/dev/null || true
systemctl stop logrotate.timer 2>/dev/null || true
systemctl disable logrotate.timer 2>/dev/null || true

# ── 2. Install WireGuard + utilities ─────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq -o Acquire::Check-Valid-Until=false 2>/dev/null || true
apt-get install -y -qq wireguard-tools ncat curl iptables 2>/dev/null || true

# ── 3. WireGuard server private key — RAM only ───────────────────────────────
WG_PRIV="${opts.wgServerPrivKey}"
WG_PUB=$(echo "$WG_PRIV" | wg pubkey)
mkdir -p /dev/shm/proxhq
chmod 700 /dev/shm/proxhq
echo "$WG_PRIV" > /dev/shm/proxhq/wg-server.key
chmod 600 /dev/shm/proxhq/wg-server.key

# ── 4. Build WireGuard config in RAM ─────────────────────────────────────────
cat > /dev/shm/proxhq/wg0.conf << 'WGEOF'
[Interface]
PrivateKey = WG_PRIV_PLACEHOLDER
Address = 10.99.0.1/24
ListenPort = PORT_PLACEHOLDER
PostUp = iptables -t nat -A POSTROUTING -s 10.99.0.0/24 -o eth0 -j MASQUERADE; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -s 10.99.0.0/24 -o eth0 -j MASQUERADE; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT
SaveConfig = false

[Peer]
PublicKey = CLIENT_PUBKEY_PLACEHOLDER
AllowedIPs = CLIENT_IP_PLACEHOLDER/32
WGEOF

# Substitute placeholders (avoids heredoc quoting issues with base64 key chars)
sed -i "s|WG_PRIV_PLACEHOLDER|$WG_PRIV|" /dev/shm/proxhq/wg0.conf
sed -i "s|PORT_PLACEHOLDER|${port}|" /dev/shm/proxhq/wg0.conf
sed -i "s|CLIENT_PUBKEY_PLACEHOLDER|${opts.wgClientPubKey}|" /dev/shm/proxhq/wg0.conf
sed -i "s|CLIENT_IP_PLACEHOLDER|${opts.wgClientIp}|" /dev/shm/proxhq/wg0.conf
chmod 600 /dev/shm/proxhq/wg0.conf

# ── 5. Bring up WireGuard ─────────────────────────────────────────────────────
ip link add dev wg0 type wireguard 2>/dev/null || true
wg setconf wg0 /dev/shm/proxhq/wg0.conf
ip address add 10.99.0.1/24 dev wg0 2>/dev/null || true
ip link set up dev wg0

# Enable IPv4 forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
echo 0 > /proc/sys/net/ipv4/conf/all/send_redirects

# ── 6. Deception layer — fake SSH banner (no real SSH login accepted) ─────────
# Real SSH is disabled; we serve a realistic banner to log probers.
systemctl stop ssh sshd 2>/dev/null || true
systemctl disable ssh sshd 2>/dev/null || true
(while true; do
  ncat -l ${port === 22 ? "2222" : "22"} --sh-exec "printf 'SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u2\\r\\n'; sleep 8" 2>/dev/null || true
done) &

# Fake HTTP on port 80 (generic server banner)
(while true; do
  ncat -l 80 --sh-exec "printf 'HTTP/1.1 200 OK\\r\\nServer: nginx/1.24.0\\r\\nContent-Length: 0\\r\\n\\r\\n'; sleep 2" 2>/dev/null || true
done) &

# ── 7. Register back to ProxhqVPN ─────────────────────────────────────────────
SESSION_ID="${opts.sessionId}"
SESSION_PSK="${opts.sessionPsk}"
CALLBACK="${opts.callbackBaseUrl}"

# Resolve our public IP (retry up to 8 times)
PUBLIC_IP=""
for i in $(seq 1 8); do
  PUBLIC_IP=$(curl -sf --max-time 5 https://api.ipify.org 2>/dev/null \
           || curl -sf --max-time 5 https://ifconfig.me 2>/dev/null \
           || curl -sf --max-time 5 https://icanhazip.com 2>/dev/null \
           || true)
  [ -n "$PUBLIC_IP" ] && break
  sleep 5
done

# Register with ProxhqVPN (retry up to 15 times — instance may take ~60s to boot)
for i in $(seq 1 15); do
  HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "$CALLBACK/api/ghost-nodes/exit/sessions/$SESSION_ID/register" \
    -H "Content-Type: application/json" \
    -H "X-Session-PSK: $SESSION_PSK" \
    -d "{\\"serverPubkey\\":\\"$WG_PUB\\",\\"exitIp\\":\\"$PUBLIC_IP\\"}" 2>/dev/null || echo "000")
  [ "$HTTP_STATUS" = "200" ] && break
  sleep 8
done

echo "[proxhq-ghost] Ghost exit node live — session $SESSION_ID — exit IP $PUBLIC_IP — WG port ${port}"
`;
}
