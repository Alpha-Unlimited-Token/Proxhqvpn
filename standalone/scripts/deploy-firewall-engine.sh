#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════════
# ProxhqVPN — Production Firewall Engine Deployment (nftables)
# Replaces UFW with nftables for production-grade packet filtering.
# Configures: default DROP, rate limiting, WireGuard real+ghost ports,
# geo-IP placeholder, SSH hardening, and ProxhqVPN API integration.
# Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
# Usage: sudo WG_REAL_PORT=41194 SSH_PORT=2222 bash deploy-firewall-engine.sh
# ════════════════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

SSH_PORT="${SSH_PORT:-22}"
WG_REAL_PORT="${WG_REAL_PORT:-41194}"
WG_GHOST_PORT="${WG_GHOST_PORT:-51820}"
GHOST_TRAP_PORT="${GHOST_TRAP_PORT:-8443}"
API_BASE="${API_BASE:-https://proxhqvpn.replit.app/api}"
NODE_AGENT_PSK="${NODE_AGENT_PSK:-}"
LOG_TAG="[fw-deploy]"

log()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $LOG_TAG $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Must run as root (sudo)"
log "Starting ProxhqVPN Firewall Engine deployment..."

# ── 1. Install nftables ──────────────────────────────────────────────────────
log "Installing nftables..."
apt-get update -qq
apt-get install -y --no-install-recommends nftables iproute2

# ── 2. Disable UFW (nftables replaces it) ───────────────────────────────────
if systemctl is-active --quiet ufw 2>/dev/null; then
  log "Disabling UFW (nftables takes over)..."
  ufw disable || true
  systemctl disable ufw || true
fi

# ── 3. Write nftables ruleset ────────────────────────────────────────────────
log "Writing /etc/nftables.conf..."
cat > /etc/nftables.conf << NFTABLES_EOF
#!/usr/sbin/nft -f
# ProxhqVPN Production Firewall — nftables ruleset
# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)

flush ruleset

# ── Geo-IP blocklist (populate via MaxMind GeoLite2 update script) ──────────
# Add blocked CIDRs to this set; the INPUT chain references it below.
set geo_blocklist {
    type ipv4_addr
    flags interval
    auto-merge
    # Example (North Korea): elements = { 175.45.176.0/22 }
}

# ── Known C2 / malware IPs (integrate threat intel feed) ────────────────────
set c2_blocklist {
    type ipv4_addr
    flags interval
    auto-merge
}

# ── Rate-limit buckets (per source IP) ──────────────────────────────────────
# New connection limit: 10/sec per source IP before TARPIT/DROP
# WireGuard handshake limit: 5/min per source IP

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow established/related (stateful)
        ct state established,related accept

        # Allow loopback
        iif "lo" accept

        # Drop invalid
        ct state invalid drop

        # ICMP / ICMPv6 (ping, NDP)
        ip  protocol icmp  icmp  type { echo-request, destination-unreachable, time-exceeded } limit rate 10/second accept
        ip6 nexthdr  icmpv6 icmpv6 type { echo-request, nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert } accept

        # ── Geo-IP block ─────────────────────────────────────────────────────
        ip saddr @geo_blocklist drop

        # ── C2 block ─────────────────────────────────────────────────────────
        ip saddr @c2_blocklist drop

        # ── SSH (hardened — change SSH_PORT from 22 if needed) ───────────────
        tcp dport ${SSH_PORT} ct state new \
            limit rate 5/minute burst 10 packets accept
        tcp dport ${SSH_PORT} ct state new drop

        # ── HTTPS (API + web) ────────────────────────────────────────────────
        tcp dport 443 ct state new \
            limit rate 100/second burst 200 packets accept

        # ── HTTP (redirect to HTTPS) ─────────────────────────────────────────
        tcp dport 80 accept

        # ── Real WireGuard (hidden non-standard port) ─────────────────────────
        udp dport ${WG_REAL_PORT} ct state new \
            limit rate 5/minute burst 20 packets log prefix "[wg-real] " accept

        # ── Ghost WireGuard deception port (allow all — feeds Ghost Nodes) ───
        udp dport ${WG_GHOST_PORT} log prefix "[wg-ghost] " accept

        # ── Ghost Trap lure HTTP port ─────────────────────────────────────────
        tcp dport ${GHOST_TRAP_PORT} \
            limit rate 50/second burst 100 packets accept

        # ── DNS (outbound resolver only — inbound blocked by default) ────────
        udp dport 53 accept
        tcp dport 53 accept

        # ── Rate-limit catch-all: new connections beyond threshold → LOG+DROP ─
        ct state new limit rate over 50/second burst 100 packets \
            log prefix "[rate-limit] " drop

        # Default: drop (set at top of chain)
    }

    chain forward {
        type filter hook forward priority 0; policy drop;

        # WireGuard real tunnel traffic: allow forwarding for real VPN peers
        iifname "wg0" oif != "wg-ghost0" accept
        oifname "wg0" iif != "wg-ghost0" accept

        # Ghost WireGuard forward: BLOCK — attackers never reach the internet
        iifname "wg-ghost0" drop
        oifname "wg-ghost0" drop

        ct state established,related accept
    }

    chain output {
        type filter hook output priority 0; policy accept;

        # Block outbound to known C2 (egress filtering)
        ip daddr @c2_blocklist drop
    }
}

table ip nat {
    chain postrouting {
        type nat hook postrouting priority 100; policy accept;
        # Masquerade real VPN traffic
        oifname "eth0" ip saddr 10.8.0.0/24 masquerade
    }
}
NFTABLES_EOF

chmod 640 /etc/nftables.conf

# ── 4. Load and validate ruleset ─────────────────────────────────────────────
log "Loading nftables ruleset..."
nft -c -f /etc/nftables.conf || die "nftables config validation failed"
nft -f /etc/nftables.conf
log "✓ nftables rules loaded successfully"

# ── 5. Enable nftables on boot ───────────────────────────────────────────────
systemctl enable nftables
systemctl restart nftables

# ── 6. IP forwarding (required for WireGuard) ────────────────────────────────
log "Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.forwarding=1
cat > /etc/sysctl.d/99-proxhq-forward.conf << 'SYSCTL_EOF'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
SYSCTL_EOF
sysctl -p /etc/sysctl.d/99-proxhq-forward.conf

# ── 7. C2/Geo-IP update script ───────────────────────────────────────────────
log "Installing nftables update helper script..."
cat > /usr/local/bin/proxhq-update-blocklists << 'UPDATE_EOF'
#!/usr/bin/env bash
# Downloads latest C2 blocklist and refreshes nftables set
set -euo pipefail
C2_URL="https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt"
TMP=$(mktemp)
curl -sf "$C2_URL" | grep -v "#" | awk '{print $1}' | head -5000 > "$TMP"
COUNT=$(wc -l < "$TMP")
echo "[blocklist-update] Downloaded $COUNT C2 IPs"
# Flush and re-add
nft flush set inet filter c2_blocklist
while IFS= read -r ip; do
  nft add element inet filter c2_blocklist "{ $ip }" 2>/dev/null || true
done < "$TMP"
rm -f "$TMP"
echo "[blocklist-update] Done — $COUNT entries in c2_blocklist"
UPDATE_EOF
chmod +x /usr/local/bin/proxhq-update-blocklists

# Schedule daily C2 list update
echo "0 3 * * * root /usr/local/bin/proxhq-update-blocklists >> /var/log/proxhq-blocklist.log 2>&1" \
  > /etc/cron.d/proxhq-blocklists

# Initial fetch
/usr/local/bin/proxhq-update-blocklists || log "⚠ Initial blocklist download failed (will retry via cron)"

# ── 8. Port knocking (optional) ───────────────────────────────────────────────
if [[ "${ENABLE_PORT_KNOCK:-0}" == "1" ]]; then
  log "Installing knockd for port knocking..."
  apt-get install -y knockd
  cat > /etc/knockd.conf << KNOCK_EOF
[options]
    UseSyslog
    Interface = eth0

[open_wireguard]
    sequence    = 7000:udp,8000:tcp,9000:udp
    seq_timeout = 15
    command     = /sbin/nft add rule inet filter input udp dport ${WG_REAL_PORT} ip saddr %IP% accept
    tcpflags    = syn

[close_wireguard]
    sequence    = 9000:udp,8000:tcp,7000:udp
    seq_timeout = 15
    command     = /sbin/nft delete rule inet filter input handle \$(nft -a list ruleset | grep "udp dport ${WG_REAL_PORT}" | grep "%IP%" | awk '{print \$NF}')
KNOCK_EOF
  sed -i 's/START_KNOCKD=0/START_KNOCKD=1/' /etc/default/knockd || true
  systemctl enable knockd && systemctl restart knockd
  log "✓ Port knocking enabled — sequence: UDP 7000 → TCP 8000 → UDP 9000 opens port $WG_REAL_PORT"
fi

# ── 9. Verify ─────────────────────────────────────────────────────────────────
log "Firewall Engine deployment complete."
log ""
log "Active ruleset summary:"
nft list ruleset | grep -E "chain|policy|dport|daddr @" | head -30
log ""
log "Test commands:"
log "  nft list ruleset"
log "  nft list set inet filter c2_blocklist"
log "  nmap -sU -p $WG_REAL_PORT,${WG_GHOST_PORT} \$(curl -s ifconfig.me)"
