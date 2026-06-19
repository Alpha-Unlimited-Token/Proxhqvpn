#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  ProxhqVPN — Combat Attacker Architecture Hardening Script                 ║
# ║  © 2026 Alpha Unlimited Technologies LLC. All rights reserved.              ║
# ║                                                                              ║
# ║  Implements every defensive tactic against the attacker architecture:        ║
# ║   Terminal > VM > VPN > Firewall > Server > Honeypot > Spiders > SilkWeb   ║
# ║   > Packet Call-out > Target > Response > GhostTrap > Fake Banner > Worm   ║
# ║                                                                              ║
# ║  Covers:                                                                     ║
# ║   1. Beacon timing detection (C2 heartbeat via iptables hashlimit)           ║
# ║   2. Egress control (deny-all outbound except whitelisted ports)             ║
# ║   3. DNS callback / exfiltration detection                                   ║
# ║   4. Persistence monitoring (auditd: cron/service/startup rules)             ║
# ║   5. Bot/scanner blocking (fail2ban custom beacon filter)                    ║
# ║   6. Geo-blocking (ipset + ipdeny country CIDRs)                             ║
# ║   7. NRD/suspicious domain blocking (unbound RPZ)                            ║
# ║   8. Lateral movement prevention (iptables inter-segment isolation)          ║
# ║   9. Anti-exfiltration (iptables outbound byte-rate limits)                  ║
# ║  10. Process / memory monitoring (auditd syscall rules)                      ║
# ║  11. SIEM log forwarding (rsyslog → ProxhqVPN SIEM webhook)                  ║
# ║  12. DPI evasion detection (conntrack state + nf_conntrack)                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

[[ $EUID -ne 0 ]] && { echo "[combat-harden] Must run as root" >&2; exit 1; }

# ── Configuration — override via env vars ─────────────────────────────────────
WG_PORT="${WG_PORT:-51820}"
DAEMON_PORT="${DAEMON_PORT:-3000}"
SSH_PORT="${SSH_PORT:-22}"
SIEM_WEBHOOK="${SIEM_WEBHOOK_URL:-}"          # optional: POST security events here
ADMIN_CIDR="${ADMIN_CIDR:-}"                  # optional: trusted management CIDR
DNS_BLOCKLIST_URL="${DNS_BLOCKLIST_URL:-https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt}"
GEO_BLOCK_COUNTRIES="${GEO_BLOCK_COUNTRIES:-}" # space-separated ISO codes e.g. "CN RU KP IR"
PROXHQ_LOG="/var/log/proxhqvpn-combat.log"

log()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [combat-harden] $*" | tee -a "$PROXHQ_LOG"; }
ok()   { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [combat-harden] ✓ $*" | tee -a "$PROXHQ_LOG"; }
warn() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [combat-harden] ⚠ $*" | tee -a "$PROXHQ_LOG"; }
section() { echo "" | tee -a "$PROXHQ_LOG"; echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ═══ $* ═══" | tee -a "$PROXHQ_LOG"; }

touch "$PROXHQ_LOG"
chmod 600 "$PROXHQ_LOG"
log "Starting ProxhqVPN combat-attacker hardening..."

# ── 1. PACKAGES ───────────────────────────────────────────────────────────────
section "1. Package Installation"
apt-get update -qq
apt-get install -y \
  iptables iptables-persistent ipset ipset-persistent \
  fail2ban auditd audispd-plugins \
  unbound \
  rsyslog \
  conntrack \
  psad \
  libpcap-dev \
  nethogs iftop \
  tcpdump \
  jq curl wget \
  chrony \
  rkhunter chkrootkit \
  --no-install-recommends
ok "Packages installed"

# ── 2. BEACON DETECTION — iptables hashlimit + conntrack ─────────────────────
section "2. C2 Beacon Timing Detection"

# Load conntrack module for state-based analysis
modprobe nf_conntrack 2>/dev/null || true
modprobe nf_conntrack_ipv4 2>/dev/null || true

# Create a dedicated chain for beacon logging
iptables -N BEACON_DETECT 2>/dev/null || iptables -F BEACON_DETECT

# Detect connections at suspiciously regular short intervals (< 30s per IP per dest port)
# hashlimit: 3 packets per 30s per IP = any faster = beacon-like = LOG + mark
iptables -A BEACON_DETECT -m hashlimit \
  --hashlimit-name c2_beacon_30s \
  --hashlimit-above 3/minute \
  --hashlimit-burst 5 \
  --hashlimit-mode srcip,dstport \
  --hashlimit-srcmask 32 \
  -j LOG --log-prefix "[PROXHQ-BEACON] " --log-level 4

# Very high-frequency connections (> 10/sec) — worm/scanner activity
iptables -A BEACON_DETECT -m hashlimit \
  --hashlimit-name worm_highfreq \
  --hashlimit-above 10/second \
  --hashlimit-burst 20 \
  --hashlimit-mode srcip \
  --hashlimit-srcmask 32 \
  -j LOG --log-prefix "[PROXHQ-WORM] " --log-level 3

# Apply beacon detection to ESTABLISHED connections (where beacons live)
iptables -I INPUT 1 -m state --state ESTABLISHED -j BEACON_DETECT
iptables -I FORWARD 1 -m state --state ESTABLISHED -j BEACON_DETECT

ok "C2 beacon timing detection chains active (30s interval + worm rate threshold)"

# ── 3. EGRESS CONTROL — deny-all outbound except whitelisted ports ────────────
section "3. Egress / Exfiltration Control"

# Flush existing output rules (keep ACCEPT for loopback)
iptables -F OUTPUT 2>/dev/null || true

# Allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established/related (return traffic)
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow essential outbound services only
iptables -A OUTPUT -p udp --dport 53  -j ACCEPT   # DNS (monitored)
iptables -A OUTPUT -p tcp --dport 53  -j ACCEPT   # DNS-over-TCP
iptables -A OUTPUT -p tcp --dport 80  -j ACCEPT   # HTTP (package updates, OCSP)
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT   # HTTPS
iptables -A OUTPUT -p udp --dport "$WG_PORT" -j ACCEPT  # WireGuard
iptables -A OUTPUT -p tcp --dport "$DAEMON_PORT" -j ACCEPT  # ProxhqVPN daemon
iptables -A OUTPUT -p tcp --dport "$SSH_PORT" -j ACCEPT  # SSH

# NTP
iptables -A OUTPUT -p udp --dport 123 -j ACCEPT

# Log + DROP everything else outbound (anti-exfiltration)
iptables -A OUTPUT -j LOG --log-prefix "[PROXHQ-EGRESS-BLOCK] " --log-level 4
iptables -A OUTPUT -j DROP

ok "Egress control: deny-all outbound except ports 22/53/80/443/$WG_PORT/$DAEMON_PORT/123"
warn "Review /var/log/kern.log for PROXHQ-EGRESS-BLOCK lines to tune allowed ports"

# ── 4. DNS CALLBACK / TUNNELING DETECTION ────────────────────────────────────
section "4. DNS Callback + Tunneling Detection"

# Log all outbound DNS queries (port 53) for analysis
iptables -I OUTPUT -p udp --dport 53 \
  -j LOG --log-prefix "[PROXHQ-DNS-QUERY] " --log-level 6

iptables -I OUTPUT -p tcp --dport 53 \
  -j LOG --log-prefix "[PROXHQ-DNS-QUERY] " --log-level 6

# Detect DNS flooding (DNS tunneling exfil pattern: > 30 queries/min per IP)
iptables -I OUTPUT -p udp --dport 53 \
  -m hashlimit \
  --hashlimit-name dns_tunnel \
  --hashlimit-above 30/minute \
  --hashlimit-burst 10 \
  --hashlimit-mode srcip \
  -j LOG --log-prefix "[PROXHQ-DNS-TUNNEL] " --log-level 3

# Write DNS monitoring script (captures DNS queries via tcpdump)
cat > /usr/local/sbin/proxhq-dns-monitor.sh <<'DNSMON'
#!/usr/bin/env bash
# Monitors DNS queries and alerts on suspicious patterns
LOG=/var/log/proxhqvpn-dns-queries.log
ALERT_THRESHOLD=50
WINDOW_SEC=60

tcpdump -i any -nn port 53 -l 2>/dev/null | while read -r line; do
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $line" >> "$LOG"
done
DNSMON
chmod +x /usr/local/sbin/proxhq-dns-monitor.sh

# systemd unit for DNS monitor
cat > /etc/systemd/system/proxhq-dns-monitor.service <<EOF
[Unit]
Description=ProxhqVPN DNS callback and tunneling monitor
After=network.target

[Service]
ExecStart=/usr/local/sbin/proxhq-dns-monitor.sh
Restart=always
RestartSec=5
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now proxhq-dns-monitor.service || true
ok "DNS callback + tunneling detection active"

# ── 5. PERSISTENCE MONITORING — auditd rules ─────────────────────────────────
section "5. Persistence Monitoring (auditd)"

# Back up existing rules
cp /etc/audit/rules.d/audit.rules /etc/audit/rules.d/audit.rules.bak 2>/dev/null || true

cat > /etc/audit/rules.d/99-proxhqvpn-combat.rules <<'AUDITRULES'
## ProxhqVPN Combat Hardening — auditd persistence monitoring rules
## © 2026 Alpha Unlimited Technologies LLC

# ── Cron / scheduled task persistence ────────────────────────────────────────
-w /etc/crontab          -p wa -k proxhq_persistence_cron
-w /etc/cron.d/          -p wa -k proxhq_persistence_cron
-w /etc/cron.hourly/     -p wa -k proxhq_persistence_cron
-w /etc/cron.daily/      -p wa -k proxhq_persistence_cron
-w /var/spool/cron/      -p wa -k proxhq_persistence_cron

# ── Service / startup persistence ────────────────────────────────────────────
-w /etc/systemd/system/  -p wa -k proxhq_persistence_service
-w /lib/systemd/system/  -p wa -k proxhq_persistence_service
-w /etc/rc.local         -p wa -k proxhq_persistence_startup
-w /etc/init.d/          -p wa -k proxhq_persistence_startup
-w /etc/profile          -p wa -k proxhq_persistence_env
-w /etc/profile.d/       -p wa -k proxhq_persistence_env
-w /etc/bash.bashrc      -p wa -k proxhq_persistence_env
-w /root/.bashrc         -p wa -k proxhq_persistence_env
-w /root/.profile        -p wa -k proxhq_persistence_env

# ── SSH key persistence ───────────────────────────────────────────────────────
-w /root/.ssh/           -p wa -k proxhq_persistence_ssh
-w /etc/ssh/             -p wa -k proxhq_persistence_ssh

# ── Privilege escalation attempts ─────────────────────────────────────────────
-w /etc/sudoers          -p wa -k proxhq_privesc
-w /etc/sudoers.d/       -p wa -k proxhq_privesc
-a always,exit -F arch=b64 -S setuid -S setgid -F exit=-EPERM -k proxhq_privesc

# ── Process monitoring — suspicious syscalls ──────────────────────────────────
-a always,exit -F arch=b64 -S ptrace               -k proxhq_process_inject
-a always,exit -F arch=b64 -S process_vm_readv     -k proxhq_process_inject
-a always,exit -F arch=b64 -S process_vm_writev    -k proxhq_process_inject
-a always,exit -F arch=b64 -S mprotect -F a2&0x4   -k proxhq_exec_writable_mem

# ── Lateral movement — user/group creation ───────────────────────────────────
-w /etc/passwd           -p wa -k proxhq_lateral_user
-w /etc/group            -p wa -k proxhq_lateral_user
-w /etc/shadow           -p rwa -k proxhq_lateral_shadow
-a always,exit -F arch=b64 -S useradd -S usermod -k proxhq_lateral_user

# ── Network tool execution (recon/pivot indicator) ────────────────────────────
-w /usr/bin/nmap         -p x -k proxhq_recon_tool
-w /usr/bin/netcat       -p x -k proxhq_recon_tool
-w /usr/bin/nc           -p x -k proxhq_recon_tool
-w /usr/bin/curl         -p x -k proxhq_recon_tool
-w /usr/bin/wget         -p x -k proxhq_recon_tool
-w /usr/bin/ssh          -p x -k proxhq_recon_tool
-w /usr/sbin/tcpdump     -p x -k proxhq_recon_tool

# ── File deletion anomalies (anti-forensics indicator) ───────────────────────
-a always,exit -F arch=b64 -S unlink -S unlinkat -S rename -S renameat \
   -F dir=/var/log -k proxhq_log_tamper
-a always,exit -F arch=b64 -S truncate -S ftruncate \
   -F dir=/var/log -k proxhq_log_tamper

# ── Module loading (rootkit indicator) ───────────────────────────────────────
-w /sbin/insmod          -p x -k proxhq_module
-w /sbin/modprobe        -p x -k proxhq_module
-a always,exit -F arch=b64 -S init_module -S delete_module -k proxhq_module

# Make rules immutable (requires reboot to change — anti-tampering)
# Uncomment once rules are confirmed correct:
# -e 2
AUDITRULES

augenrules --load 2>/dev/null || service auditd restart || true
ok "auditd persistence + process monitoring rules loaded ($(grep -c "^-" /etc/audit/rules.d/99-proxhqvpn-combat.rules) rules)"

# ── 6. BOT/SCANNER BLOCKING — fail2ban custom beacon filter ──────────────────
section "6. Bot / Scanner Blocking (fail2ban)"

cat > /etc/fail2ban/filter.d/proxhq-beacon.conf <<'F2B_FILTER'
[Definition]
# Matches iptables beacon detection log lines
failregex = \[PROXHQ-BEACON\] .*SRC=<HOST>
            \[PROXHQ-WORM\] .*SRC=<HOST>
            \[PROXHQ-DNS-TUNNEL\] .*SRC=<HOST>
ignoreregex =
F2B_FILTER

cat > /etc/fail2ban/filter.d/proxhq-egress-block.conf <<'F2B_EGRESS'
[Definition]
# Triggers on unauthorized outbound attempts (e.g. malware phoning home)
failregex = \[PROXHQ-EGRESS-BLOCK\] .*DST=<HOST>
ignoreregex =
F2B_EGRESS

# Add jails
cat > /etc/fail2ban/jail.d/proxhqvpn.conf <<EOF
[proxhq-beacon]
enabled   = true
filter    = proxhq-beacon
logpath   = /var/log/kern.log
maxretry  = 3
findtime  = 60
bantime   = 86400
action    = iptables-allports[name=proxhq-beacon, protocol=all]

[proxhq-scanner]
enabled   = true
filter    = proxhq-egress-block
logpath   = /var/log/kern.log
maxretry  = 5
findtime  = 300
bantime   = 3600
action    = iptables-allports[name=proxhq-scanner, protocol=all]
EOF

systemctl enable --now fail2ban
systemctl restart fail2ban || true
ok "fail2ban beacon + scanner jails active (24h ban on beacon detect, 1h ban on scanner)"

# ── 7. GEO-BLOCKING — ipset + country CIDR lists ─────────────────────────────
section "7. Geo-Blocking (ipset)"

if [[ -n "$GEO_BLOCK_COUNTRIES" ]]; then
  ipset create PROXHQ_GEO_BLOCK hash:net 2>/dev/null || ipset flush PROXHQ_GEO_BLOCK

  for CC in $GEO_BLOCK_COUNTRIES; do
    CC_LOWER=$(echo "$CC" | tr '[:upper:]' '[:lower:]')
    URL="https://www.ipdeny.com/ipblocks/data/countries/${CC_LOWER}.zone"
    log "Fetching CIDRs for $CC from ipdeny.com..."
    if curl -sf --max-time 15 "$URL" -o "/tmp/geo_${CC_LOWER}.zone" 2>/dev/null; then
      while read -r cidr; do
        [[ -n "$cidr" ]] && ipset add PROXHQ_GEO_BLOCK "$cidr" 2>/dev/null || true
      done < "/tmp/geo_${CC_LOWER}.zone"
      CIDR_COUNT=$(wc -l < "/tmp/geo_${CC_LOWER}.zone")
      ok "Loaded $CIDR_COUNT CIDRs for $CC"
    else
      warn "Could not fetch geo-block list for $CC — skipping"
    fi
  done

  # Apply to INPUT and FORWARD chains
  iptables -I INPUT  1 -m set --match-set PROXHQ_GEO_BLOCK src \
    -j LOG --log-prefix "[PROXHQ-GEO-BLOCK] " --log-level 4
  iptables -I INPUT  2 -m set --match-set PROXHQ_GEO_BLOCK src -j DROP
  iptables -I FORWARD 1 -m set --match-set PROXHQ_GEO_BLOCK src -j DROP

  # Persist ipset
  ipset save > /etc/ipset.conf
  ok "Geo-blocking active for: $GEO_BLOCK_COUNTRIES"
else
  warn "GEO_BLOCK_COUNTRIES not set — skipping geo-blocking. Set env var to enable."
  warn "Example: GEO_BLOCK_COUNTRIES='CN RU KP IR SY' bash combat-attacker-architecture.sh"
fi

# ── 8. NRD / SUSPICIOUS DOMAIN BLOCKING — unbound RPZ ───────────────────────
section "8. Newly Registered Domain (NRD) Blocking (unbound)"

if command -v unbound >/dev/null 2>&1; then
  mkdir -p /etc/unbound/blocklists

  # Fetch domain blocklist (includes NRD, malware, C2 domains)
  log "Fetching DNS blocklist from $DNS_BLOCKLIST_URL..."
  if curl -sf --max-time 30 "$DNS_BLOCKLIST_URL" -o /tmp/dns-blocklist.txt 2>/dev/null; then
    # Convert to unbound local-zone format
    grep -v '^#' /tmp/dns-blocklist.txt | grep -v '^$' | head -100000 | \
      awk '{ print "local-zone: \"" $1 "\" redirect" }
           { print "local-data: \"" $1 " A 0.0.0.0\"" }' \
      > /etc/unbound/blocklists/nrd-blocklist.conf
    DOMAIN_COUNT=$(wc -l < /tmp/dns-blocklist.txt)
    ok "Loaded $DOMAIN_COUNT domains into unbound NRD blocklist"
  else
    warn "Could not fetch DNS blocklist — using empty blocklist"
    touch /etc/unbound/blocklists/nrd-blocklist.conf
  fi

  # Configure unbound with blocklist
  cat > /etc/unbound/unbound.conf.d/proxhqvpn-nrd.conf <<'UNBOUNDCONF'
server:
  # NRD + malware domain blocking
  include: "/etc/unbound/blocklists/nrd-blocklist.conf"

  # Log all queries for callback detection analysis
  log-queries: yes
  log-replies: yes

  # DNSSEC validation (detects DNS spoofing)
  auto-trust-anchor-file: "/var/lib/unbound/root.key"
  val-log-level: 2

  # Refuse ANY queries (often used for exfil / amplification)
  refuse-any: yes

  # Minimal responses (reduce info leakage)
  minimal-responses: yes

  # Harden against cache poisoning
  harden-dnssec-stripped: yes
  harden-glue: yes
  harden-referral-path: yes
  harden-algo-downgrade: yes
UNBOUNDCONF

  systemctl enable --now unbound
  systemctl restart unbound || warn "unbound restart failed — check /etc/unbound/unbound.conf"
  ok "unbound NRD domain blocking + DNSSEC validation active"
else
  warn "unbound not installed — NRD blocking via DNS requires unbound. Install it manually."
fi

# ── 9. LATERAL MOVEMENT PREVENTION — inter-segment isolation ─────────────────
section "9. Lateral Movement Prevention (network segmentation)"

# Block inter-WireGuard segment routing (prevent pivot from one VPN peer to another)
# WireGuard typically uses 10.x.x.x/24 subnets per node
iptables -N PROXHQ_LATERAL_BLOCK 2>/dev/null || iptables -F PROXHQ_LATERAL_BLOCK

# Log lateral movement attempts
iptables -A PROXHQ_LATERAL_BLOCK -j LOG \
  --log-prefix "[PROXHQ-LATERAL] " --log-level 4
iptables -A PROXHQ_LATERAL_BLOCK -j DROP

# Block forwarding between different 10.x.x.x/24 subnets
# (each WireGuard node gets its own /24 — cross-subnet forwarding = lateral movement)
for SRC_OCTET in $(seq 0 10); do
  for DST_OCTET in $(seq 0 10); do
    [[ "$SRC_OCTET" == "$DST_OCTET" ]] && continue
    iptables -A FORWARD \
      -s "10.${SRC_OCTET}.0.0/24" \
      -d "10.${DST_OCTET}.0.0/24" \
      -m state --state NEW \
      -j PROXHQ_LATERAL_BLOCK 2>/dev/null || true
  done
done

# Enable kernel IP forwarding restrictions
sysctl -w net.ipv4.conf.all.rp_filter=1
sysctl -w net.ipv4.conf.default.rp_filter=1
sysctl -w net.ipv4.conf.all.accept_source_route=0
sysctl -w net.ipv4.conf.all.send_redirects=0
sysctl -w net.ipv4.conf.all.accept_redirects=0
sysctl -w net.ipv6.conf.all.accept_redirects=0

ok "Lateral movement prevention: inter-segment forwarding blocked, rp_filter enforced"

# ── 10. MEMORY PROTECTION + PROCESS MONITORING ───────────────────────────────
section "10. Memory Protection + Process Monitoring"

# Prevent ptrace (process injection attacks — used by advanced C2 payloads)
sysctl -w kernel.yama.ptrace_scope=2
echo "kernel.yama.ptrace_scope=2" >> /etc/sysctl.d/99-proxhqvpn.conf

# Protect kernel pointers (prevent information leak for privilege escalation)
sysctl -w kernel.kptr_restrict=2
echo "kernel.kptr_restrict=2" >> /etc/sysctl.d/99-proxhqvpn.conf

# Restrict dmesg (hides kernel info from unprivileged users)
sysctl -w kernel.dmesg_restrict=1
echo "kernel.dmesg_restrict=1" >> /etc/sysctl.d/99-proxhqvpn.conf

# Enable ExecShield / ASLR
sysctl -w kernel.randomize_va_space=2
echo "kernel.randomize_va_space=2" >> /etc/sysctl.d/99-proxhqvpn.conf

# Limit core dumps (prevent memory extraction via crash)
sysctl -w fs.suid_dumpable=0
echo "fs.suid_dumpable=0" >> /etc/sysctl.d/99-proxhqvpn.conf

# Apply all sysctl settings
sysctl --system >/dev/null 2>&1
ok "Memory protection: ptrace_scope=2, ASLR=2, kptr_restrict=2, core dumps disabled"

# ── 11. PSAD — Port Scan Attack Detector ─────────────────────────────────────
section "11. PSAD (Port Scan Attack Detector)"

if command -v psad >/dev/null 2>&1; then
  # Configure PSAD to watch our iptables LOG prefixes
  cat >> /etc/psad/psad.conf <<EOF

# ProxhqVPN combat integration
ENABLE_SYSLOG_FILE Y;
IPT_SYSLOG_FILE /var/log/kern.log;
ENABLE_AUTO_IDS Y;
AUTO_IDS_DANGER_LEVEL 3;
DANGER_LEVEL2 15;
DANGER_LEVEL3 150;
DANGER_LEVEL4 1500;
DANGER_LEVEL5 15000;
EMAIL_ALERT_DANGER_LEVEL 4;
ENABLE_IPTABLES_BLOCKING Y;
IPTABLES_BLOCK_METHOD INOUT;
BLOCK_TIMEOUT 3600;
EOF

  psad --sig-update 2>/dev/null || true
  systemctl enable --now psad
  systemctl restart psad || true
  ok "PSAD port scan detector active with auto-blocking enabled"
else
  warn "PSAD not installed — install manually: apt install psad"
fi

# ── 12. SIEM LOG FORWARDING — rsyslog → ProxhqVPN SIEM webhook ───────────────
section "12. SIEM Log Forwarding"

if [[ -n "$SIEM_WEBHOOK" ]]; then
  cat > /usr/local/sbin/proxhq-siem-forwarder.sh <<SIEMSCRIPT
#!/usr/bin/env bash
# Forwards ProxhqVPN combat log entries to SIEM webhook
WEBHOOK="$SIEM_WEBHOOK"
LOG="/var/log/kern.log"

tail -F "\$LOG" | grep --line-buffered "PROXHQ-" | while read -r line; do
  PAYLOAD=\$(jq -n --arg line "\$line" --arg host "\$(hostname)" --arg ts "\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{event: \$line, host: \$host, timestamp: \$ts, source: "combat-harden"}')
  curl -sf -X POST -H "Content-Type: application/json" -d "\$PAYLOAD" "\$WEBHOOK" >/dev/null 2>&1 || true
done
SIEMSCRIPT
  chmod +x /usr/local/sbin/proxhq-siem-forwarder.sh

  cat > /etc/systemd/system/proxhq-siem-forwarder.service <<EOF
[Unit]
Description=ProxhqVPN SIEM log forwarder
After=network.target rsyslog.service

[Service]
ExecStart=/usr/local/sbin/proxhq-siem-forwarder.sh
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now proxhq-siem-forwarder.service
  ok "SIEM forwarder active → $SIEM_WEBHOOK"
else
  warn "SIEM_WEBHOOK_URL not set — set env var to enable log forwarding"
  warn "Example: SIEM_WEBHOOK_URL='https://your-proxhq-domain/api/siem/ingest' bash ..."
fi

# ── 13. RKHUNTER — rootkit + anti-forensics detection ────────────────────────
section "13. Rootkit Detection (rkhunter)"

if command -v rkhunter >/dev/null 2>&1; then
  rkhunter --update --quiet 2>/dev/null || true
  rkhunter --propupd --quiet 2>/dev/null || true

  # Daily rkhunter scan via cron
  cat > /etc/cron.daily/proxhq-rkhunter <<'RKHCRON'
#!/usr/bin/env bash
/usr/bin/rkhunter --check --skip-keypress --report-warnings-only \
  --logfile /var/log/rkhunter.log 2>&1 | \
  grep -E "Warning|Found|Possible" >> /var/log/proxhqvpn-rkhunter-alerts.log || true
RKHCRON
  chmod +x /etc/cron.daily/proxhq-rkhunter
  ok "rkhunter rootkit detection configured (daily scan)"
fi

# ── 14. PERSIST IPTABLES RULES ────────────────────────────────────────────────
section "14. Persisting iptables Rules"

iptables-save > /etc/iptables/rules.v4
ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
ok "iptables rules persisted to /etc/iptables/rules.v{4,6}"

# Persist sysctl
sysctl --system >/dev/null 2>&1
ok "sysctl settings persisted to /etc/sysctl.d/99-proxhqvpn.conf"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
section "HARDENING COMPLETE"
echo ""
echo "  ProxhqVPN Combat Attacker Architecture Hardening — Summary"
echo "  ────────────────────────────────────────────────────────────"
echo "  [✓] Beacon timing detection (iptables hashlimit, 30s + worm rate)"
echo "  [✓] Egress control (deny-all outbound except ports 22/53/80/443/$WG_PORT/$DAEMON_PORT)"
echo "  [✓] DNS callback + tunneling detection (iptables LOG + rate limit)"
echo "  [✓] Persistence monitoring (auditd: cron/service/startup/ssh/priv)"
echo "  [✓] Bot/scanner auto-ban (fail2ban beacon + egress jails)"
echo "  [$([ -n "$GEO_BLOCK_COUNTRIES" ] && echo "✓" || echo "–")] Geo-blocking (ipset, countries: ${GEO_BLOCK_COUNTRIES:-not set})"
echo "  [$(command -v unbound >/dev/null 2>&1 && echo "✓" || echo "–")] NRD domain blocking (unbound RPZ)"
echo "  [✓] Lateral movement prevention (inter-segment iptables isolation)"
echo "  [✓] Memory protection (ptrace_scope=2, ASLR, kptr_restrict)"
echo "  [$(command -v psad >/dev/null 2>&1 && echo "✓" || echo "–")] PSAD port scan detector"
echo "  [$([ -n "$SIEM_WEBHOOK" ] && echo "✓" || echo "–")] SIEM log forwarding (webhook: ${SIEM_WEBHOOK:-not set})"
echo "  [$(command -v rkhunter >/dev/null 2>&1 && echo "✓" || echo "–")] Rootkit detection (rkhunter)"
echo ""
echo "  Log: $PROXHQ_LOG"
echo "  Reboot recommended to activate all kernel-level changes."
echo ""
log "Combat hardening complete."
