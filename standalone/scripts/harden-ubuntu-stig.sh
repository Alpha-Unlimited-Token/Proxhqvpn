#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run as root" >&2; exit 1; fi

DAEMON_PORT="${PROXHQ_DAEMON_PORT:-3000}"
WG_PORT="${WG_PORT:-51820}"
ADMIN_IP="${ADMIN_IP:-}"   # optional: your static management IP, whitelist it

log()  { echo "[proxhq-harden] $*"; }
ok()   { echo "[proxhq-harden] ✓ $*"; }
warn() { echo "[proxhq-harden] ⚠ $*"; }

# ─── 1. PACKAGES ──────────────────────────────────────────────────────────────
log "Installing packages..."
apt-get update -qq
apt-get install -y ufw auditd audispd-plugins fail2ban unattended-upgrades \
  chrony openscap-scanner iptables-persistent ipset
ok "Packages installed"

# ─── 2. UFW (coarse rules — fine-grained enforcement is iptables below) ───────
log "Configuring UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
[[ -n "$ADMIN_IP" ]] && ufw allow from "$ADMIN_IP" to any port 22 proto tcp comment "admin SSH"
[[ -z "$ADMIN_IP" ]] && ufw allow 22/tcp comment "SSH"
ufw allow "${WG_PORT}/udp"   comment "WireGuard"
ufw allow "${DAEMON_PORT}/tcp" comment "ProxhqVPN daemon"
ufw --force enable
ok "UFW configured (WireGuard $WG_PORT, daemon $DAEMON_PORT)"

# ─── 3. IPTABLES — SOCKET-LEVEL HARDENING ────────────────────────────────────
# Applied BEFORE fail2ban jails so the kernel drops floods without touching logs.

log "Applying iptables socket-level rules..."

# Flush any existing custom chains
iptables -F INPUT   2>/dev/null || true
iptables -F FORWARD 2>/dev/null || true
ip6tables -F INPUT  2>/dev/null || true
ip6tables -F FORWARD 2>/dev/null || true

# (a) Always allow loopback and established/related
iptables  -A INPUT -i lo -j ACCEPT
iptables  -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
ip6tables -A INPUT -i lo -j ACCEPT
ip6tables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# (b) Drop invalid packets (RST floods, malformed)
iptables  -A INPUT -m conntrack --ctstate INVALID -j DROP
ip6tables -A INPUT -m conntrack --ctstate INVALID -j DROP

# (c) SYN flood mitigation — rate-limit new TCP SYNs per source IP
#     Each source IP allowed: burst of 20, then max 15 new connections/min.
#     Anything above that is silently DROPped (no RST reply = no confirmation).
iptables -A INPUT -p tcp --syn \
  -m hashlimit \
    --hashlimit-name proxhq_syn \
    --hashlimit-mode srcip \
    --hashlimit-upto 15/min \
    --hashlimit-burst 20 \
    --hashlimit-htable-expire 120000 \
  -j ACCEPT
iptables -A INPUT -p tcp --syn -j DROP

# (d) Connection exhaustion — cap simultaneous open connections per source IP
#     Prevents a single host from holding >25 open TCP sockets at once.
iptables  -A INPUT -p tcp -m connlimit --connlimit-above 25 --connlimit-mask 32 -j DROP
ip6tables -A INPUT -p tcp -m connlimit --connlimit-above 25 --connlimit-mask 32 -j DROP

# (e) Port-scan detection — track hits per IP across all ports.
#     If an IP probes >15 distinct ports within 60 seconds, LOG it for
#     fail2ban and then DROP all further packets from that IP.
iptables -N PORT_SCAN 2>/dev/null || iptables -F PORT_SCAN
iptables -A PORT_SCAN -m recent --name portscan --set --rsource
iptables -A PORT_SCAN -m recent --name portscan --rcheck --seconds 60 --hitcount 15 \
  -j LOG --log-prefix "PROXHQ-PORTSCAN: " --log-level 4
iptables -A PORT_SCAN -m recent --name portscan --rcheck --seconds 60 --hitcount 15 \
  -j DROP

# Hook port-scan chain on TCP/UDP to any port not already allowed
iptables -A INPUT -p tcp -m conntrack --ctstate NEW -j PORT_SCAN
iptables -A INPUT -p udp -j PORT_SCAN

# (f) ICMP rate-limit (allow ping but prevent ICMP flood)
iptables  -A INPUT -p icmp --icmp-type echo-request -m limit --limit 5/s --limit-burst 10 -j ACCEPT
iptables  -A INPUT -p icmp --icmp-type echo-request -j DROP
ip6tables -A INPUT -p ipv6-icmp -m limit --limit 10/s --limit-burst 20 -j ACCEPT
ip6tables -A INPUT -p ipv6-icmp -j DROP

# (g) Explicit ACCEPT for our services (after the rate gates above)
iptables  -A INPUT -p tcp --dport 22              -j ACCEPT
iptables  -A INPUT -p udp --dport "$WG_PORT"      -j ACCEPT
iptables  -A INPUT -p tcp --dport "$DAEMON_PORT"  -j ACCEPT
ip6tables -A INPUT -p tcp --dport 22              -j ACCEPT
ip6tables -A INPUT -p udp --dport "$WG_PORT"      -j ACCEPT
ip6tables -A INPUT -p tcp --dport "$DAEMON_PORT"  -j ACCEPT

# (h) Default policy: DROP everything else
iptables  -P INPUT DROP
ip6tables -P INPUT DROP
iptables  -P FORWARD DROP
ip6tables -P FORWARD DROP

# Persist across reboots
netfilter-persistent save
ok "iptables socket-level rules applied and saved"

# ─── 4. FAIL2BAN — AGGRESSIVE JAILS ──────────────────────────────────────────
log "Writing fail2ban configuration..."

# Custom filter: ProxhqVPN daemon — repeated bad PSK / 401 responses
cat >/etc/fail2ban/filter.d/proxhq-daemon.conf <<'FILTER'
[INCLUDES]
before = common.conf

[Definition]
# Matches pino-http log lines: "statusCode": 401 or 403 on the daemon port
failregex = ^.*"url":"[^"]*","statusCode":40[13][^}]*"remoteAddress":"<HOST>".*$
            ^.*<HOST>.*POST.*401.*$
            ^.*<HOST>.*POST.*403.*$
ignoreregex =
FILTER

# Custom filter: port scan (reads kernel LOG lines written by iptables rule above)
cat >/etc/fail2ban/filter.d/proxhq-portscan.conf <<'FILTER'
[INCLUDES]
before = common.conf

[Definition]
failregex = ^.*PROXHQ-PORTSCAN:.*SRC=<HOST>.*$
ignoreregex =
FILTER

# Main jail.local — overrides all defaults
cat >/etc/fail2ban/jail.local <<JAIL
[DEFAULT]
# ── Timing ──────────────────────────────────────────────────────────────────
# First offence: 2-hour ban (was 10 minutes)
bantime  = 2h
# Only 3 failures allowed (was 5)
maxretry = 3
# All 3 failures must happen within 5 minutes (was 10 minutes)
findtime = 5m

# ── Action: DROP (silent) not REJECT ────────────────────────────────────────
# Using DROP means the attacker gets no confirmation they're banned.
# iptables-allports bans across ALL ports, not just the one being probed.
banaction     = iptables-allports[name=%(__name__)s, protocol=all, chain=INPUT]
banaction_allports = iptables-allports[name=%(__name__)s, protocol=all, chain=INPUT]

# ── Whitelist ────────────────────────────────────────────────────────────────
# Add your management IP here if needed: ignoreip = 127.0.0.1/8 1.2.3.4
ignoreip = 127.0.0.1/8 ::1

# ── Backend ─────────────────────────────────────────────────────────────────
backend = auto

# ────────────────────────────────────────────────────────────────────────────
# SSH — tight
# ────────────────────────────────────────────────────────────────────────────
[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s
maxretry = 3
findtime = 5m
bantime  = 2h

# SSH aggressive: if they fail 10 times in 1 hour, ban for 24 hours
[sshd-aggressive]
enabled   = true
filter    = sshd
port      = ssh
logpath   = %(sshd_log)s
maxretry  = 10
findtime  = 1h
bantime   = 24h

# ────────────────────────────────────────────────────────────────────────────
# Recidive — repeat offenders get 1-week ban
# Anyone banned 3+ times within 24 hours is locked out for a full week.
# ────────────────────────────────────────────────────────────────────────────
[recidive]
enabled  = true
logpath  = /var/log/fail2ban.log
banaction = iptables-allports[name=recidive, protocol=all, chain=INPUT]
bantime  = 1w
findtime = 1d
maxretry = 3

# ────────────────────────────────────────────────────────────────────────────
# Port scan — reads iptables LOG lines from rule (e) above
# Ban immediately on the first logged port-scan burst
# ────────────────────────────────────────────────────────────────────────────
[proxhq-portscan]
enabled  = true
filter   = proxhq-portscan
logpath  = /var/log/kern.log
           /var/log/syslog
maxretry = 1
findtime = 1m
bantime  = 24h

# ────────────────────────────────────────────────────────────────────────────
# ProxhqVPN daemon API — repeated bad-PSK / 401 attempts
# ────────────────────────────────────────────────────────────────────────────
[proxhq-daemon]
enabled  = true
filter   = proxhq-daemon
port     = ${DAEMON_PORT}
logpath  = /var/log/proxhqvpn/*.log
maxretry = 5
findtime = 2m
bantime  = 6h

JAIL

ok "fail2ban jail.local written"

# ─── 5. AUDITD RULES ──────────────────────────────────────────────────────────
log "Writing auditd rules..."
cat >/etc/audit/rules.d/proxhqvpn.rules <<'RULES'
-w /etc/wireguard -p wa -k wireguard_config_change
-w /opt/proxhqvpn -p wa -k proxhq_app_change
-w /etc/ssh/sshd_config -p wa -k ssh_config_change
-a always,exit -F arch=b64 -S execve -k command_exec
RULES
augenrules --load
ok "auditd rules loaded"

# ─── 6. SSH HARDENING ─────────────────────────────────────────────────────────
log "Hardening SSH..."
sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/'  /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin .*/PermitRootLogin no/'                /etc/ssh/sshd_config
sed -i 's/^#*MaxAuthTries .*/MaxAuthTries 3/'                       /etc/ssh/sshd_config
sed -i 's/^#*LoginGraceTime .*/LoginGraceTime 30/'                  /etc/ssh/sshd_config
sed -i 's/^#*ClientAliveCountMax .*/ClientAliveCountMax 2/'         /etc/ssh/sshd_config

# Add settings that may not exist yet
grep -q '^MaxSessions'        /etc/ssh/sshd_config || echo 'MaxSessions 3'        >>/etc/ssh/sshd_config
grep -q '^TCPKeepAlive'       /etc/ssh/sshd_config || echo 'TCPKeepAlive yes'     >>/etc/ssh/sshd_config
grep -q '^AllowAgentForwarding' /etc/ssh/sshd_config || echo 'AllowAgentForwarding no' >>/etc/ssh/sshd_config
grep -q '^X11Forwarding'      /etc/ssh/sshd_config || echo 'X11Forwarding no'     >>/etc/ssh/sshd_config
systemctl reload ssh || true
ok "SSH hardened"

# ─── 7. KERNEL TUNING (extended) ──────────────────────────────────────────────
log "Applying sysctl hardening..."
cat >/etc/sysctl.d/99-proxhqvpn.conf <<'SYSCTL'
# WireGuard routing
net.ipv4.ip_forward=1

# Reverse path filtering (stop spoofed-source attacks)
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1

# No ICMP redirects
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv6.conf.all.accept_redirects=0
net.ipv6.conf.default.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.default.send_redirects=0

# SYN cookie — primary SYN flood defense
net.ipv4.tcp_syncookies=1

# SYN backlog — hold more half-open connections in queue before dropping
net.ipv4.tcp_max_syn_backlog=2048
net.ipv4.tcp_synack_retries=2
net.ipv4.tcp_syn_retries=2

# TIME_WAIT socket reuse — reclaim sockets faster after connections close
net.ipv4.tcp_fin_timeout=15
net.ipv4.tcp_tw_reuse=1

# Limit local port range used for outbound connections
net.ipv4.ip_local_port_range=1024 65535

# Source route rejection
net.ipv4.conf.all.accept_source_route=0
net.ipv4.conf.default.accept_source_route=0

# Kernel pointer / dmesg hardening
kernel.kptr_restrict=2
kernel.dmesg_restrict=1

# Filesystem hardening
fs.protected_hardlinks=1
fs.protected_symlinks=1

# Increase socket buffer sizes for high-throughput VPN
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216

# BBR congestion control — better throughput on high-latency / lossy VPN paths
# Requires Linux kernel 4.9+ (all modern Ubuntu LTS qualify)
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
SYSCTL
sysctl --system
ok "sysctl tuning applied"

# ─── 8. UNBOUND DNS RESOLVER (local caching + DNS-over-TLS) ──────────────────
log "Installing and configuring Unbound..."
apt-get install -y unbound

cat > /etc/unbound/unbound.conf.d/proxhqvpn.conf << 'UNBOUND'
server:
  interface: 127.0.0.1
  port: 5353
  do-ip4: yes
  do-ip6: no
  do-udp: yes
  do-tcp: yes
  access-control: 127.0.0.0/8 allow
  hide-identity: yes
  hide-version: yes
  harden-glue: yes
  harden-dnssec-stripped: yes
  use-caps-for-id: yes
  val-permissive-mode: no
  cache-min-ttl: 60
  cache-max-ttl: 86400
  prefetch: yes
  num-threads: 2
  so-reuseport: yes

  # DNS-over-TLS upstream (Cloudflare)
  forward-zone:
    name: "."
    forward-tls-upstream: yes
    forward-addr: 1.1.1.1@853#cloudflare-dns.com
    forward-addr: 1.0.0.1@853#cloudflare-dns.com
UNBOUND

systemctl enable --now unbound
# Point local DNS at Unbound
echo "nameserver 127.0.0.1" > /etc/resolv.conf.proxhqvpn
# Only override resolv.conf if systemd-resolved is not managing it
if ! systemctl is-active --quiet systemd-resolved; then
  cp /etc/resolv.conf.proxhqvpn /etc/resolv.conf
fi
ok "Unbound DNS-over-TLS resolver installed on 127.0.0.1:5353"

# ─── 9. START SERVICES ────────────────────────────────────────────────────────
log "Starting services..."
systemctl enable --now auditd fail2ban chrony unattended-upgrades
systemctl restart fail2ban
ok "Services started"

# ─── 10. LOG DIR ──────────────────────────────────────────────────────────────
mkdir -p /var/log/proxhqvpn && chmod 750 /var/log/proxhqvpn

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ProxhqVPN Node Hardening — COMPLETE                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  fail2ban jails active:                                      ║"
echo "║    [sshd]             3 retries / 5min window → 2h ban       ║"
echo "║    [sshd-aggressive]  10 retries / 1h window  → 24h ban      ║"
echo "║    [recidive]         3 bans in 24h           → 1 week ban   ║"
echo "║    [proxhq-portscan]  1 portscan burst        → 24h ban      ║"
echo "║    [proxhq-daemon]    5 bad PSK / 2min        → 6h ban       ║"
echo "║                                                               ║"
echo "║  iptables socket rules:                                       ║"
echo "║    SYN rate limit:    15 new conns/min, burst 20 (DROP)       ║"
echo "║    Connection cap:    max 25 open TCP sockets per IP (DROP)   ║"
echo "║    Port scan detect:  >15 ports in 60s → LOG + DROP → f2b    ║"
echo "║    Invalid packets:   all INVALID state → DROP                ║"
echo "║    ICMP rate limit:   5 pings/s allowed, rest DROP            ║"
echo "║                                                               ║"
echo "║  Next step: Run OpenSCAP and remediate distro-specific        ║"
echo "║             findings, then verify with: fail2ban-client status ║"
echo "╚══════════════════════════════════════════════════════════════╝"
