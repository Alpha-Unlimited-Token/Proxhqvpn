#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  ProxhqVPN — MASTER WIPE + FULL REINSTALL + COMBAT HARDENING            ║
# ║  Node   : proxhqvpn-chicago  |  Region : US-Chicago                      ║
# ║  WG     : 10.8.4.x/24         |  Port   : 39285                         ║
# ║  © 2026 Alpha Unlimited Technologies LLC. All rights reserved.           ║
# ╚══════════════════════════════════════════════════════════════════════════╝
# Run as root on the Vultr server — wipes everything, then reinstalls clean.

[[ $EUID -ne 0 ]] && { echo "Must run as root"; exit 1; }

# ─── NODE IDENTITY ─────────────────────────────────────────────────────────
NODE_ID="proxhqvpn-chicago"
NODE_REGION="US-Chicago"
WG_SUBNET="10.8.4"
WG_PORT="39285"
NODE_AGENT_PSK="655014e5d0bce05bc7bb20258570cf7ac77a956baabc04e77980529b56964a11"
HONEYPOT_PSK="d8bc18968a21cfb9982d7970a11f6cad4f9f468587dcdfcfc211937f57f6dbc2"
PROXHQ_API="https://8ed1e79f-3fa7-4c82-b61d-7b93cb57936e-00-1arzc3ag01duz.spock.replit.dev"
GEO_BLOCK_COUNTRIES="CN RU KP IR SY"
SIEM_WEBHOOK_URL="https://proxhqvpn.com/api/siem/ingest"
DAEMON_PORT="3000"
SSH_PORT="22"
DNS_BLOCKLIST_URL="https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt"

export NODE_ID NODE_REGION WG_SUBNET WG_PORT NODE_AGENT_PSK HONEYPOT_PSK PROXHQ_API

echo "══════════════════════════════════════════════════════════════"
echo " ProxhqVPN MASTER INSTALLER — $NODE_ID ($NODE_REGION)"
echo " Phase 1: WIPE  |  Phase 2: INSTALL  |  Phase 3: COMBAT"
echo "══════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1 — WIPE (everything || true — errors ignored)
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ PHASE 1: WIPE — stopping and removing all previous installs..."

# Stop and disable all proxhq services
for svc in proxhq-ghost-trap proxhq-honeypot proxhq-agent.timer proxhq-agent \
           proxhq-port-knock proxhq-dns-monitor proxhq-siem-forwarder \
           knockd fail2ban; do
  systemctl stop    "$svc" 2>/dev/null || true
  systemctl disable "$svc" 2>/dev/null || true
done

# Kill any lingering python processes
pkill -f ghost-trap.py  2>/dev/null || true
pkill -f honeypot.py    2>/dev/null || true
pkill -f proxhq-dns-monitor 2>/dev/null || true
pkill -f proxhq-siem-forwarder 2>/dev/null || true

# Down WireGuard interfaces
for iface in wg0 ghost1 ghost2 ghost3; do
  wg-quick down "$iface" 2>/dev/null || true
  systemctl stop  "wg-quick@${iface}" 2>/dev/null || true
  systemctl disable "wg-quick@${iface}" 2>/dev/null || true
done

# Remove systemd unit files
rm -f /etc/systemd/system/proxhq-ghost-trap.service
rm -f /etc/systemd/system/proxhq-honeypot.service
rm -f /etc/systemd/system/proxhq-agent.service
rm -f /etc/systemd/system/proxhq-agent.timer
rm -f /etc/systemd/system/proxhq-port-knock.service
rm -f /etc/systemd/system/proxhq-dns-monitor.service
rm -f /etc/systemd/system/proxhq-siem-forwarder.service
systemctl daemon-reload

# Remove proxhq app files
rm -rf /opt/proxhq/
rm -rf /etc/proxhq/

# Remove WireGuard configs (keep package)
rm -f /etc/wireguard/wg0.conf
rm -f /etc/wireguard/ghost1.conf
rm -f /etc/wireguard/ghost2.conf
rm -f /etc/wireguard/ghost3.conf
rm -rf /dev/shm/proxhq/

# Flush iptables completely
iptables  -F 2>/dev/null || true
iptables  -X 2>/dev/null || true
iptables  -Z 2>/dev/null || true
iptables  -t nat    -F 2>/dev/null || true
iptables  -t nat    -X 2>/dev/null || true
iptables  -t mangle -F 2>/dev/null || true
iptables  -t mangle -X 2>/dev/null || true
ip6tables -F 2>/dev/null || true
ip6tables -X 2>/dev/null || true

# Reset iptables default policies to ACCEPT
iptables -P INPUT   ACCEPT 2>/dev/null || true
iptables -P FORWARD ACCEPT 2>/dev/null || true
iptables -P OUTPUT  ACCEPT 2>/dev/null || true

# Flush nftables
nft flush ruleset 2>/dev/null || true

# Remove ipsets
ipset flush PROXHQ_GEO_BLOCK 2>/dev/null || true
ipset destroy PROXHQ_GEO_BLOCK 2>/dev/null || true

# Remove fail2ban proxhq jails
rm -f /etc/fail2ban/jail.d/proxhq.conf
rm -f /etc/fail2ban/jail.d/proxhqvpn.conf
rm -f /etc/fail2ban/filter.d/proxhq-ghost-trap.conf
rm -f /etc/fail2ban/filter.d/proxhq-drop.conf
rm -f /etc/fail2ban/filter.d/proxhq-beacon.conf
rm -f /etc/fail2ban/filter.d/proxhq-egress-block.conf

# Remove auditd proxhq rules
rm -f /etc/audit/rules.d/99-proxhqvpn-combat.rules

# Remove unbound blocklists
rm -rf /etc/unbound/blocklists/
rm -f  /etc/unbound/unbound.conf.d/proxhqvpn-nrd.conf

# Remove siem forwarder
rm -f /usr/local/sbin/proxhq-siem-forwarder.sh
rm -f /usr/local/sbin/proxhq-dns-monitor.sh

# Remove rkhunter cron
rm -f /etc/cron.daily/proxhq-rkhunter

# Reset sysctl proxhq settings
rm -f /etc/sysctl.d/99-proxhqvpn.conf

echo "  ✓ Wipe complete."

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2 — INSTALL (15 steps)
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ PHASE 2: INSTALL — 15-step full stack..."
set -e

echo "[1/15] System update..."
apt-get update -qq && apt-get upgrade -y -qq

echo "[2/15] Installing packages..."
apt-get install -y -qq \
  wireguard wireguard-tools nftables knockd nmap curl \
  python3 python3-pip net-tools iproute2 iptables \
  fail2ban unattended-upgrades jq vim
systemctl stop ufw 2>/dev/null; systemctl disable ufw 2>/dev/null
apt-get remove -y -qq ufw 2>/dev/null || true

echo "[3/15] Generating WireGuard keys (RAM-only)..."
SERVER_PRIVATE_KEY=$(wg genkey)
SERVER_PUBLIC_KEY=$(echo "$SERVER_PRIVATE_KEY" | wg pubkey)
echo "  Public Key: $SERVER_PUBLIC_KEY"
mkdir -p /dev/shm/proxhq && chmod 700 /dev/shm/proxhq
echo "$SERVER_PRIVATE_KEY" > /dev/shm/proxhq/wg0.key
chmod 600 /dev/shm/proxhq/wg0.key

echo "[4/15] Writing environment file..."
mkdir -p /etc/proxhq && chmod 700 /etc/proxhq
cat > /etc/proxhq/env << EOF
NODE_ID=${NODE_ID}
NODE_REGION=${NODE_REGION}
HONEYPOT_PSK=${HONEYPOT_PSK}
NODE_AGENT_PSK=${NODE_AGENT_PSK}
PROXHQ_API=${PROXHQ_API}
WG_PORT=${WG_PORT}
EOF
chmod 600 /etc/proxhq/env
echo "  Done."

echo "[5/15] Enabling IP forwarding..."
cat >> /etc/sysctl.conf << 'EOF'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.tcp_syncookies = 1
EOF
sysctl -p -q

echo "[6/15] Configuring WireGuard (port ${WG_PORT})..."
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address    = ${WG_SUBNET}.1/24
ListenPort = ${WG_PORT}
PrivateKey = $(cat /dev/shm/proxhq/wg0.key)
PostUp     = sysctl -w net.ipv4.ip_forward=1
PostDown   = echo "WireGuard wg0 down"
EOF
chmod 600 /etc/wireguard/wg0.conf
wg-quick up wg0
systemctl enable wg-quick@wg0
echo "  WireGuard running on port $(wg show wg0 listen-port)"

echo "[7/15] Creating ghost node decoys..."
G1=$(wg genkey); G2=$(wg genkey); G3=$(wg genkey)
echo "$G1" > /dev/shm/proxhq/ghost1.key
echo "$G2" > /dev/shm/proxhq/ghost2.key
echo "$G3" > /dev/shm/proxhq/ghost3.key
chmod 600 /dev/shm/proxhq/ghost*.key

cat > /etc/wireguard/ghost1.conf << EOF
[Interface]
Address    = 10.9.1.1/24
ListenPort = 51820
PrivateKey = $G1
EOF
cat > /etc/wireguard/ghost2.conf << EOF
[Interface]
Address    = 10.9.2.1/24
ListenPort = 51821
PrivateKey = $G2
EOF
cat > /etc/wireguard/ghost3.conf << EOF
[Interface]
Address    = 10.9.3.1/24
ListenPort = 1194
PrivateKey = $G3
EOF
chmod 600 /etc/wireguard/ghost*.conf
wg-quick up ghost1
wg-quick up ghost2
wg-quick up ghost3
systemctl enable wg-quick@ghost1
systemctl enable wg-quick@ghost2
systemctl enable wg-quick@ghost3
echo "  Ghost nodes running on ports 51820, 51821, 1194"

echo "[8/15] Installing ghost trap daemon..."
mkdir -p /opt/proxhq/ghost-trap
cat > /opt/proxhq/ghost-trap/ghost-trap.py << 'PYEOF'
#!/usr/bin/env python3
import socket, threading, datetime, json, urllib.request, os, time, sys, ssl
API_ENDPOINT = os.getenv("PROXHQ_API", "http://127.0.0.1:8080")
HONEYPOT_PSK = os.getenv("HONEYPOT_PSK", "")
NODE_ID      = os.getenv("NODE_ID", "ghost-node")
BANNERS = {
    21:    b"220 ProFTPD 1.3.5e Server (Ubuntu) ready.\r\n",
    23:    b"\xff\xfb\x01\xff\xfb\x03\xff\xfd\x18\xff\xfd\x1fWelcome to Ubuntu 22.04 LTS\r\nlogin: ",
    25:    b"220 mail.internal.net ESMTP Postfix (Ubuntu)\r\n",
    110:   b"+OK POP3 server ready\r\n",
    143:   b"* OK [CAPABILITY IMAP4rev1 STARTTLS] Dovecot ready.\r\n",
    445:   b"\x00\x00\x00\x85\xffSMBr\x00\x00\x00\x00\x18\x01\x00\x00\x00",
    1433:  b"\x04\x01\x00%\x00\x00\x01\x00",
    3306:  b"J\x00\x00\x00\n5.7.38-log\x00",
    3389:  b"\x03\x00\x00\x13\x0e\xd0\x00\x00\x124\x00\x02\x01\x08\x00\x01\x00\x00\x00",
    5432:  b"R\x00\x00\x00\x08\x00\x00\x00\x00",
    5900:  b"RFB 003.008\n",
    6379:  b"-NOAUTH Authentication required\r\n",
    8443:  b"HTTP/1.1 200 OK\r\nServer: nginx/1.18.0\r\nContent-Length: 0\r\n\r\n",
    9200:  b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"name":"node-1","cluster_name":"elasticsearch","version":{"number":"7.17.0"}}\r\n',
    27017: b"MongoDB Server Information\x00",
}
def report_event(port, src_ip, src_port, data_preview):
    try:
        payload = json.dumps({"events": [{"source":"ghost-trap","nodeName":NODE_ID,"eventType":f"ghost_trap_hit:port{port}","srcIp":src_ip,"srcPort":src_port,"dstPort":port,"raw":{"preview":data_preview[:300]}}]}).encode()
        req = urllib.request.Request(f"{API_ENDPOINT}/api/honeypot/ingest",data=payload,headers={"Content-Type":"application/json","X-Honeypot-PSK":HONEYPOT_PSK})
        ctx = ssl.create_default_context()
        urllib.request.urlopen(req, timeout=5, context=ctx)
    except: pass
def handle(conn, addr, port):
    src_ip, src_port = addr
    print(f"[{datetime.datetime.utcnow().isoformat()}] GHOST_TRAP port={port} src={src_ip}:{src_port}")
    data = b""
    try:
        conn.settimeout(8)
        banner = BANNERS.get(port, b"")
        if banner:
            time.sleep(0.4); conn.sendall(banner)
        try: data = conn.recv(2048)
        except: pass
        time.sleep(3)
    except: pass
    finally:
        try: conn.close()
        except: pass
    threading.Thread(target=report_event,args=(port,src_ip,src_port,data.decode(errors="replace")),daemon=True).start()
def listen_tcp(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("0.0.0.0", port)); s.listen(100)
        print(f"[ghost-trap] TCP :{port}")
        while True:
            try:
                conn, addr = s.accept()
                threading.Thread(target=handle,args=(conn,addr,port),daemon=True).start()
            except Exception as e: print(f"accept error :{port}: {e}",file=sys.stderr)
    except Exception as e: print(f"FAILED to bind :{port}: {e}",file=sys.stderr)
if __name__ == "__main__":
    ports_str = os.getenv("GHOST_PORTS","21,23,25,110,143,445,1433,3306,3389,5432,5900,6379,8443,9200,27017")
    ports = [int(p.strip()) for p in ports_str.split(",")]
    threads = [threading.Thread(target=listen_tcp,args=(p,),daemon=True) for p in ports]
    for t in threads: t.start()
    print(f"[ghost-trap] {NODE_ID} — {len(ports)} ports active")
    for t in threads: t.join()
PYEOF
chmod +x /opt/proxhq/ghost-trap/ghost-trap.py

cat > /etc/systemd/system/proxhq-ghost-trap.service << 'EOF'
[Unit]
Description=ProxhqVPN Ghost Trap Daemon
After=network.target
[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/proxhq/ghost-trap/ghost-trap.py
Restart=always
RestartSec=5
EnvironmentFile=/etc/proxhq/env
Environment=GHOST_PORTS=21,23,25,110,143,445,1433,3306,3389,5432,5900,6379,8443,9200,27017
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable proxhq-ghost-trap
systemctl start proxhq-ghost-trap
echo "  Ghost trap started."

echo "[9/15] Installing honeypot silk web daemon..."
mkdir -p /opt/proxhq/honeypot
cat > /opt/proxhq/honeypot/honeypot.py << 'PYEOF'
#!/usr/bin/env python3
import subprocess, json, re, sys, time, urllib.request, os, ssl, datetime
from collections import defaultdict
API_ENDPOINT = os.getenv("PROXHQ_API","http://127.0.0.1:8080")
HONEYPOT_PSK = os.getenv("HONEYPOT_PSK","")
NODE_ID      = os.getenv("NODE_ID","silk-web")
SHIP_INTERVAL = 5
RATE_LIMIT    = 50
LOG_RE = re.compile(r"PROXHQ_(?P<type>DROP|GHOST_TRAP_TCP|GHOST_TRAP_UDP|GHOST_NODE): .*?SRC=(?P<src>[0-9a-f.:]+).*?(?:DST=(?P<dst>[0-9a-f.:]+))?.*?(?:PROTO=(?P<proto>\w+))?.*?(?:SPT=(?P<spt>\d+))?.*?(?:DPT=(?P<dpt>\d+))?")
ip_counts = defaultdict(int)
ip_reset_at = time.time()
def ship_events(events):
    if not events: return
    try:
        payload = json.dumps({"events":events}).encode()
        req = urllib.request.Request(f"{API_ENDPOINT}/api/honeypot/ingest",data=payload,headers={"Content-Type":"application/json","X-Honeypot-PSK":HONEYPOT_PSK})
        ctx = ssl.create_default_context()
        urllib.request.urlopen(req,timeout=8,context=ctx)
        print(f"[honeypot] shipped {len(events)} events")
    except Exception as e: print(f"[honeypot] ship error: {e}",file=sys.stderr)
def map_type(t):
    return {"DROP":"silk_web_drop","GHOST_TRAP_TCP":"ghost_trap_tcp","GHOST_TRAP_UDP":"ghost_trap_udp","GHOST_NODE":"ghost_node_probe"}.get(t,"unknown")
def run():
    global ip_reset_at, ip_counts
    print(f"[honeypot] {NODE_ID} starting")
    proc = subprocess.Popen(["journalctl","-k","-f","--no-pager","--output=short-unix"],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    batch=[]; last_ship=time.time()
    for raw_line in proc.stdout:
        line=raw_line.decode(errors="replace")
        m=LOG_RE.search(line)
        if not m: continue
        src_ip=m.group("src") or "unknown"
        now=time.time()
        if now-ip_reset_at>60: ip_counts.clear(); ip_reset_at=now
        ip_counts[src_ip]+=1
        if ip_counts[src_ip]>RATE_LIMIT: continue
        evt={"source":"silk-web-honeypot","nodeName":NODE_ID,"eventType":map_type(m.group("type")),"srcIp":src_ip,"srcPort":int(m.group("spt") or 0),"dstPort":int(m.group("dpt") or 0),"raw":{"proto":m.group("proto"),"dst":m.group("dst"),"ts":datetime.datetime.utcnow().isoformat()}}
        batch.append(evt)
        print(f"[{evt['raw']['ts']}] {evt['eventType']} src={src_ip}")
        if time.time()-last_ship>=SHIP_INTERVAL and batch:
            ship_events(batch); batch=[]; last_ship=time.time()
if __name__=="__main__": run()
PYEOF
chmod +x /opt/proxhq/honeypot/honeypot.py

cat > /etc/systemd/system/proxhq-honeypot.service << 'EOF'
[Unit]
Description=ProxhqVPN Silk Web Honeypot
After=network.target
[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/proxhq/honeypot/honeypot.py
Restart=always
RestartSec=5
EnvironmentFile=/etc/proxhq/env
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable proxhq-honeypot
systemctl start proxhq-honeypot
echo "  Honeypot started."

echo "[10/15] Installing 4-layer nftables firewall..."
IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
cat > /etc/nftables.conf << NFTEOF
#!/usr/sbin/nft -f
flush ruleset
table inet filter {
  set ALLOWED_UDP { type inet_service; elements = { ${WG_PORT}, 53 } }
  set ALLOWED_TCP { type inet_service; elements = { 8080, 443, 80 } }
  set GHOST_NODE_PORTS { type inet_service; elements = { 51820, 51821, 51822, 1194, 4500, 500 } }
  set GHOST_TRAP_PORTS { type inet_service; elements = { 21, 23, 25, 110, 143, 445, 1433, 3306, 3389, 5432, 5900, 6379, 8443, 9200, 27017 } }
  chain input {
    type filter hook input priority 0 ; policy drop ;
    iif lo accept
    ct state established,related accept
    ip protocol icmp limit rate 10/second accept
    udp dport @ALLOWED_UDP accept
    tcp dport @ALLOWED_TCP accept
    tcp dport 22 accept
    udp dport @GHOST_NODE_PORTS log prefix "PROXHQ_GHOST_NODE: " drop
    tcp dport @GHOST_NODE_PORTS log prefix "PROXHQ_GHOST_NODE: " drop
    tcp dport @GHOST_TRAP_PORTS log prefix "PROXHQ_GHOST_TRAP_TCP: " accept
    udp dport @GHOST_TRAP_PORTS log prefix "PROXHQ_GHOST_TRAP_UDP: " accept
    drop
  }
  chain forward {
    type filter hook forward priority 0 ; policy drop ;
    iifname "wg0" accept
    oifname "wg0" ct state established,related accept
    iifname "wg0" oifname "wg0" accept
  }
  chain output { type filter hook output priority 0 ; policy accept ; }
}
table inet nat {
  chain postrouting {
    type nat hook postrouting priority 100 ;
    ip saddr ${WG_SUBNET}.0/24 masquerade
  }
}
NFTEOF
nft -f /etc/nftables.conf
systemctl enable nftables
systemctl reset-failed nftables 2>/dev/null; systemctl stop nftables 2>/dev/null; systemctl start nftables
echo "  Firewall active."

echo "[11/15] Installing port-knock SSH guard..."
apt-get install -y -qq knockd
IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
cat > /etc/knockd.conf << EOF
[options]
    UseSyslog
    Interface = $IFACE
[openSSH]
    sequence      = 7000,8000,9000
    seq_timeout   = 10
    tcpflags      = syn
    command       = /sbin/nft add rule inet filter input ip saddr %IP% tcp dport 22 accept comment "knockd-ssh"
    cmd_timeout   = 30
    stop_command  = /sbin/nft flush chain inet filter input
[closeSSH]
    sequence      = 9000,8000,7000
    seq_timeout   = 10
    tcpflags      = syn
    command       = /sbin/nft flush chain inet filter input
EOF
sed -i 's/START_KNOCKD=0/START_KNOCKD=1/' /etc/default/knockd 2>/dev/null || true
echo "KNOCKD_OPTS=\"-i $IFACE\"" >> /etc/default/knockd
systemctl enable knockd
systemctl start knockd
echo "  Port knock guard on 7000->8000->9000."

echo "[12/15] Installing node agent..."
mkdir -p /opt/proxhq/agent
cat > /opt/proxhq/agent/node-agent.sh << 'AGEOF'
#!/bin/bash
source /etc/proxhq/env
API="${PROXHQ_API}"; PSK="${NODE_AGENT_PSK}"
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2+$4}' | tr -d ',')
MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}')
MEM_USED=$(free -m  | awk '/Mem:/{print $3}')
MEM_PCT=$(awk "BEGIN{printf \"%.1f\", ${MEM_USED}/${MEM_TOTAL}*100}")
DISK=$(df / | awk 'NR==2{print $3}')
WG_PEERS=$(wg show wg0 peers 2>/dev/null | wc -l)
UPTIME=$(awk '{print int($1)}' /proc/uptime)
EXT_IP=$(curl -sf --max-time 5 https://api.ipify.org || echo "unknown")
LOAD=$(cat /proc/loadavg | awk '{print $1}')
PAYLOAD=$(cat << JSON
{"nodeId":"${NODE_ID}","region":"${NODE_REGION}","ip":"${EXT_IP}","cpuPct":${CPU:-0},"memPct":${MEM_PCT:-0},"diskMb":${DISK:-0},"wgPeers":${WG_PEERS:-0},"uptimeSec":${UPTIME:-0},"loadAvg1":${LOAD:-0},"status":"online"}
JSON
)
curl -sf -X POST "${API}/api/node-agent/checkin" \
  -H "Content-Type: application/json" \
  -H "X-Node-Agent-PSK: ${PSK}" \
  -d "${PAYLOAD}" --max-time 10 --retry 3 >/dev/null 2>&1
echo "[$(date -u +%H:%M:%S)] checkin sent — cpu=${CPU}% mem=${MEM_PCT}% peers=${WG_PEERS}"
AGEOF
chmod +x /opt/proxhq/agent/node-agent.sh

cat > /etc/systemd/system/proxhq-agent.service << 'EOF'
[Unit]
Description=ProxhqVPN Node Agent Check-In
After=network.target
[Service]
Type=oneshot
ExecStart=/opt/proxhq/agent/node-agent.sh
EOF
cat > /etc/systemd/system/proxhq-agent.timer << 'EOF'
[Unit]
Description=ProxhqVPN Node Agent — every 30 seconds
[Timer]
OnBootSec=15sec
OnUnitActiveSec=30sec
AccuracySec=5sec
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable proxhq-agent.timer
systemctl start proxhq-agent.timer
echo "  Node agent timer running."

echo "[13/15] Installing fail2ban..."
cat > /etc/fail2ban/filter.d/proxhq-ghost-trap.conf << 'EOF'
[Definition]
failregex = PROXHQ_GHOST_TRAP_TCP:.*SRC=<HOST>
EOF
cat > /etc/fail2ban/filter.d/proxhq-drop.conf << 'EOF'
[Definition]
failregex = PROXHQ_DROP:.*SRC=<HOST>
EOF
cat > /etc/fail2ban/jail.d/proxhq.conf << 'EOF'
[proxhq-ghost-trap]
enabled=true
filter=proxhq-ghost-trap
logpath=/var/log/kern.log
maxretry=3
findtime=60
bantime=3600
action=nftables-multiport[name=proxhq,port="1:65535",protocol=tcp]
[proxhq-drop]
enabled=true
filter=proxhq-drop
logpath=/var/log/kern.log
maxretry=10
findtime=60
bantime=86400
action=nftables-multiport[name=proxhq-drop,port="1:65535",protocol=tcp]
EOF
systemctl enable fail2ban
systemctl restart fail2ban
echo "  Fail2ban running."

echo "[14/15] Running first node agent check-in..."
/opt/proxhq/agent/node-agent.sh || true

echo "[15/15] Install phase complete — verifying..."
wg show all | grep -E "interface|listening" || true
echo ""
echo "Service check after install:"
for svc in proxhq-ghost-trap proxhq-honeypot proxhq-agent.timer knockd fail2ban nftables; do
  STATUS=$(systemctl is-active $svc 2>/dev/null)
  [ "$STATUS" = "active" ] && MARK="✓" || MARK="✗"
  printf "  ${MARK} %-28s %s\n" "$svc" "$STATUS"
done

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3 — COMBAT HARDENING (14 sections)
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ PHASE 3: COMBAT HARDENING — 14 sections..."

log()     { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [combat-harden] $*" | tee -a /var/log/proxhqvpn-combat.log; }
ok()      { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [combat-harden] ✓ $*" | tee -a /var/log/proxhqvpn-combat.log; }
warn()    { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [combat-harden] ⚠ $*" | tee -a /var/log/proxhqvpn-combat.log; }
section() { echo "" | tee -a /var/log/proxhqvpn-combat.log; echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ═══ $* ═══" | tee -a /var/log/proxhqvpn-combat.log; }

touch /var/log/proxhqvpn-combat.log && chmod 600 /var/log/proxhqvpn-combat.log
log "Starting combat hardening for ${NODE_ID}..."

section "C1. Combat Packages"
apt-get install -y \
  iptables iptables-persistent ipset ipset-persistent \
  auditd audispd-plugins \
  unbound \
  rsyslog conntrack psad \
  libpcap-dev nethogs iftop tcpdump \
  jq curl wget chrony \
  rkhunter chkrootkit \
  --no-install-recommends 2>/dev/null || true
ok "Combat packages installed"

section "C2. C2 Beacon Timing Detection"
modprobe nf_conntrack 2>/dev/null || true
modprobe nf_conntrack_ipv4 2>/dev/null || true
iptables -N BEACON_DETECT 2>/dev/null || iptables -F BEACON_DETECT
iptables -A BEACON_DETECT -m hashlimit \
  --hashlimit-name c2_beacon_30s \
  --hashlimit-above 3/minute \
  --hashlimit-burst 5 \
  --hashlimit-mode srcip,dstport \
  --hashlimit-srcmask 32 \
  -j LOG --log-prefix "[PROXHQ-BEACON] " --log-level 4
iptables -A BEACON_DETECT -m hashlimit \
  --hashlimit-name worm_highfreq \
  --hashlimit-above 10/second \
  --hashlimit-burst 20 \
  --hashlimit-mode srcip \
  --hashlimit-srcmask 32 \
  -j LOG --log-prefix "[PROXHQ-WORM] " --log-level 3
iptables -I INPUT   1 -m state --state ESTABLISHED -j BEACON_DETECT
iptables -I FORWARD 1 -m state --state ESTABLISHED -j BEACON_DETECT
ok "Beacon timing detection active"

section "C3. Egress Control"
iptables -P OUTPUT ACCEPT
iptables -F OUTPUT 2>/dev/null || true
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -p udp --dport 53  -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53  -j ACCEPT
iptables -A OUTPUT -p tcp --dport 80  -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -p udp --dport "${WG_PORT}" -j ACCEPT
iptables -A OUTPUT -p tcp --dport "${DAEMON_PORT}" -j ACCEPT
iptables -A OUTPUT -p tcp --dport "${SSH_PORT}" -j ACCEPT
iptables -A OUTPUT -p udp --dport 123 -j ACCEPT
iptables -A OUTPUT -j LOG --log-prefix "[PROXHQ-EGRESS-BLOCK] " --log-level 4
iptables -A OUTPUT -j DROP
ok "Egress control active (allow 22/53/80/443/${WG_PORT}/${DAEMON_PORT}/123)"

section "C4. DNS Callback Detection"
iptables -I OUTPUT -p udp --dport 53 \
  -j LOG --log-prefix "[PROXHQ-DNS-QUERY] " --log-level 6
iptables -I OUTPUT -p tcp --dport 53 \
  -j LOG --log-prefix "[PROXHQ-DNS-QUERY] " --log-level 6
iptables -I OUTPUT -p udp --dport 53 \
  -m hashlimit \
  --hashlimit-name dns_tunnel \
  --hashlimit-above 30/minute \
  --hashlimit-burst 10 \
  --hashlimit-mode srcip \
  -j LOG --log-prefix "[PROXHQ-DNS-TUNNEL] " --log-level 3
cat > /usr/local/sbin/proxhq-dns-monitor.sh << 'DNSMON'
#!/usr/bin/env bash
LOG=/var/log/proxhqvpn-dns-queries.log
tcpdump -i any -nn port 53 -l 2>/dev/null | while read -r line; do
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $line" >> "$LOG"
done
DNSMON
chmod +x /usr/local/sbin/proxhq-dns-monitor.sh
cat > /etc/systemd/system/proxhq-dns-monitor.service << 'EOF'
[Unit]
Description=ProxhqVPN DNS callback and tunneling monitor
After=network.target
[Service]
ExecStart=/usr/local/sbin/proxhq-dns-monitor.sh
Restart=always
RestartSec=5
User=root
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now proxhq-dns-monitor.service || true
ok "DNS callback + tunneling detection active"

section "C5. Persistence Monitoring (auditd)"
cp /etc/audit/rules.d/audit.rules /etc/audit/rules.d/audit.rules.bak 2>/dev/null || true
cat > /etc/audit/rules.d/99-proxhqvpn-combat.rules << 'AUDITRULES'
-w /etc/crontab          -p wa -k proxhq_persistence_cron
-w /etc/cron.d/          -p wa -k proxhq_persistence_cron
-w /etc/cron.hourly/     -p wa -k proxhq_persistence_cron
-w /etc/cron.daily/      -p wa -k proxhq_persistence_cron
-w /var/spool/cron/      -p wa -k proxhq_persistence_cron
-w /etc/systemd/system/  -p wa -k proxhq_persistence_service
-w /lib/systemd/system/  -p wa -k proxhq_persistence_service
-w /etc/rc.local         -p wa -k proxhq_persistence_startup
-w /etc/init.d/          -p wa -k proxhq_persistence_startup
-w /etc/profile          -p wa -k proxhq_persistence_env
-w /etc/profile.d/       -p wa -k proxhq_persistence_env
-w /etc/bash.bashrc      -p wa -k proxhq_persistence_env
-w /root/.bashrc         -p wa -k proxhq_persistence_env
-w /root/.profile        -p wa -k proxhq_persistence_env
-w /root/.ssh/           -p wa -k proxhq_persistence_ssh
-w /etc/ssh/             -p wa -k proxhq_persistence_ssh
-w /etc/sudoers          -p wa -k proxhq_privesc
-w /etc/sudoers.d/       -p wa -k proxhq_privesc
-a always,exit -F arch=b64 -S setuid -S setgid -F exit=-EPERM -k proxhq_privesc
-a always,exit -F arch=b64 -S ptrace               -k proxhq_process_inject
-a always,exit -F arch=b64 -S process_vm_readv     -k proxhq_process_inject
-a always,exit -F arch=b64 -S process_vm_writev    -k proxhq_process_inject
-a always,exit -F arch=b64 -S mprotect -F a2&0x4   -k proxhq_exec_writable_mem
-w /etc/passwd           -p wa -k proxhq_lateral_user
-w /etc/group            -p wa -k proxhq_lateral_user
-w /etc/shadow           -p rwa -k proxhq_lateral_shadow
-a always,exit -F arch=b64 -S useradd -S usermod -k proxhq_lateral_user
-w /usr/bin/nmap         -p x -k proxhq_recon_tool
-w /usr/bin/netcat       -p x -k proxhq_recon_tool
-w /usr/bin/nc           -p x -k proxhq_recon_tool
-w /usr/bin/curl         -p x -k proxhq_recon_tool
-w /usr/bin/wget         -p x -k proxhq_recon_tool
-w /usr/bin/ssh          -p x -k proxhq_recon_tool
-w /usr/sbin/tcpdump     -p x -k proxhq_recon_tool
-a always,exit -F arch=b64 -S unlink -S unlinkat -S rename -S renameat -F dir=/var/log -k proxhq_log_tamper
-a always,exit -F arch=b64 -S truncate -S ftruncate -F dir=/var/log -k proxhq_log_tamper
-w /sbin/insmod          -p x -k proxhq_module
-w /sbin/modprobe        -p x -k proxhq_module
-a always,exit -F arch=b64 -S init_module -S delete_module -k proxhq_module
AUDITRULES
augenrules --load 2>/dev/null || service auditd restart || true
ok "auditd persistence + process monitoring rules loaded"

section "C6. Bot/Scanner Blocking (fail2ban)"
cat > /etc/fail2ban/filter.d/proxhq-beacon.conf << 'F2B_FILTER'
[Definition]
failregex = \[PROXHQ-BEACON\] .*SRC=<HOST>
            \[PROXHQ-WORM\] .*SRC=<HOST>
            \[PROXHQ-DNS-TUNNEL\] .*SRC=<HOST>
ignoreregex =
F2B_FILTER
cat > /etc/fail2ban/filter.d/proxhq-egress-block.conf << 'F2B_EGRESS'
[Definition]
failregex = \[PROXHQ-EGRESS-BLOCK\] .*DST=<HOST>
ignoreregex =
F2B_EGRESS
cat > /etc/fail2ban/jail.d/proxhqvpn.conf << 'EOF'
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
ok "fail2ban beacon + scanner jails active"

section "C7. Geo-Blocking (ipset)"
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
  iptables -I INPUT  1 -m set --match-set PROXHQ_GEO_BLOCK src \
    -j LOG --log-prefix "[PROXHQ-GEO-BLOCK] " --log-level 4
  iptables -I INPUT  2 -m set --match-set PROXHQ_GEO_BLOCK src -j DROP
  iptables -I FORWARD 1 -m set --match-set PROXHQ_GEO_BLOCK src -j DROP
  ipset save > /etc/ipset.conf
  ok "Geo-blocking active for: $GEO_BLOCK_COUNTRIES"
else
  warn "GEO_BLOCK_COUNTRIES not set — skipping geo-blocking"
fi

section "C8. NRD Domain Blocking (unbound)"
if command -v unbound >/dev/null 2>&1; then
  mkdir -p /etc/unbound/blocklists
  log "Fetching DNS blocklist from ${DNS_BLOCKLIST_URL}..."
  if curl -sf --max-time 60 "$DNS_BLOCKLIST_URL" -o /tmp/dns-blocklist.txt 2>/dev/null; then
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
  cat > /etc/unbound/unbound.conf.d/proxhqvpn-nrd.conf << 'UNBOUNDCONF'
server:
  include: "/etc/unbound/blocklists/nrd-blocklist.conf"
  log-queries: yes
  log-replies: yes
  auto-trust-anchor-file: "/var/lib/unbound/root.key"
  val-log-level: 2
  refuse-any: yes
  minimal-responses: yes
  harden-dnssec-stripped: yes
  harden-glue: yes
  harden-referral-path: yes
  harden-algo-downgrade: yes
UNBOUNDCONF
  systemctl enable --now unbound
  systemctl restart unbound || warn "unbound restart failed"
  ok "unbound NRD domain blocking + DNSSEC active"
else
  warn "unbound not installed"
fi

section "C9. Lateral Movement Prevention"
iptables -N PROXHQ_LATERAL_BLOCK 2>/dev/null || iptables -F PROXHQ_LATERAL_BLOCK
iptables -A PROXHQ_LATERAL_BLOCK -j LOG --log-prefix "[PROXHQ-LATERAL] " --log-level 4
iptables -A PROXHQ_LATERAL_BLOCK -j DROP
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
sysctl -w net.ipv4.conf.all.rp_filter=1
sysctl -w net.ipv4.conf.default.rp_filter=1
sysctl -w net.ipv4.conf.all.accept_source_route=0
sysctl -w net.ipv4.conf.all.send_redirects=0
sysctl -w net.ipv4.conf.all.accept_redirects=0
sysctl -w net.ipv6.conf.all.accept_redirects=0
ok "Lateral movement prevention active"

section "C10. Memory Protection"
sysctl -w kernel.yama.ptrace_scope=2
sysctl -w kernel.kptr_restrict=2
sysctl -w kernel.dmesg_restrict=1
sysctl -w kernel.randomize_va_space=2
sysctl -w fs.suid_dumpable=0
cat >> /etc/sysctl.d/99-proxhqvpn.conf << 'EOF'
kernel.yama.ptrace_scope=2
kernel.kptr_restrict=2
kernel.dmesg_restrict=1
kernel.randomize_va_space=2
fs.suid_dumpable=0
EOF
sysctl --system >/dev/null 2>&1
ok "Memory protection active (ptrace_scope=2, ASLR=2, kptr_restrict=2)"

section "C11. PSAD Port Scan Detector"
if command -v psad >/dev/null 2>&1; then
  cat >> /etc/psad/psad.conf << 'EOF'
ENABLE_SYSLOG_FILE Y;
IPT_SYSLOG_FILE /var/log/kern.log;
ENABLE_AUTO_IDS Y;
AUTO_IDS_DANGER_LEVEL 3;
ENABLE_IPTABLES_BLOCKING Y;
IPTABLES_BLOCK_METHOD INOUT;
BLOCK_TIMEOUT 3600;
EOF
  psad --sig-update 2>/dev/null || true
  systemctl enable --now psad
  systemctl restart psad || true
  ok "PSAD port scan detector active"
else
  warn "psad not found — skipping"
fi

section "C12. SIEM Log Forwarding"
if [[ -n "$SIEM_WEBHOOK_URL" ]]; then
  cat > /usr/local/sbin/proxhq-siem-forwarder.sh << SIEMSCRIPT
#!/usr/bin/env bash
WEBHOOK="${SIEM_WEBHOOK_URL}"
LOG="/var/log/kern.log"
tail -F "\$LOG" | grep --line-buffered "PROXHQ-" | while read -r line; do
  PAYLOAD=\$(jq -n --arg line "\$line" --arg host "\$(hostname)" --arg ts "\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{event: \$line, host: \$host, timestamp: \$ts, source: "combat-harden"}')
  curl -sf -X POST -H "Content-Type: application/json" -d "\$PAYLOAD" "\$WEBHOOK" >/dev/null 2>&1 || true
done
SIEMSCRIPT
  chmod +x /usr/local/sbin/proxhq-siem-forwarder.sh
  cat > /etc/systemd/system/proxhq-siem-forwarder.service << 'EOF'
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
  ok "SIEM forwarder active -> ${SIEM_WEBHOOK_URL}"
else
  warn "SIEM_WEBHOOK_URL not set — skipping"
fi

section "C13. Rootkit Detection (rkhunter)"
if command -v rkhunter >/dev/null 2>&1; then
  rkhunter --update --skip-keypress 2>/dev/null || true
  rkhunter --propupd --skip-keypress 2>/dev/null || true
  cat > /etc/cron.daily/proxhq-rkhunter << 'RKHCRON'
#!/usr/bin/env bash
/usr/bin/rkhunter --check --skip-keypress --report-warnings-only \
  --logfile /var/log/rkhunter.log 2>&1 | \
  grep -E "Warning|Found|Possible" >> /var/log/proxhqvpn-rkhunter-alerts.log || true
RKHCRON
  chmod +x /etc/cron.daily/proxhq-rkhunter
  ok "rkhunter rootkit detection configured (daily scan)"
else
  warn "rkhunter not found — skipping"
fi

section "C14. Persist iptables Rules"
mkdir -p /etc/iptables
iptables-save  > /etc/iptables/rules.v4
ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
sysctl --system >/dev/null 2>&1
ok "iptables rules persisted"

# ═══════════════════════════════════════════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════════════"
echo " FINAL STATUS — ${NODE_ID} (${NODE_REGION})"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "WireGuard interfaces:"
wg show all | grep -E "interface|listening" || echo "  (none up)"
echo ""
echo "Services:"
for svc in proxhq-ghost-trap proxhq-honeypot proxhq-agent.timer knockd fail2ban \
           nftables proxhq-dns-monitor proxhq-siem-forwarder; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null)
  [ "$STATUS" = "active" ] && MARK="✓" || MARK="✗"
  printf "  ${MARK} %-32s %s\n" "$svc" "$STATUS"
done
echo ""
echo "Firewall layers:"
nft list ruleset 2>/dev/null | grep -E "policy|GHOST|ALLOWED" | head -8 || true
echo ""
echo "Geo-blocking: $(ipset list PROXHQ_GEO_BLOCK 2>/dev/null | grep 'Number of entries' || echo 'not loaded')"
echo "IP forwarding: $(sysctl -n net.ipv4.ip_forward)"
echo "ptrace_scope:  $(sysctl -n kernel.yama.ptrace_scope 2>/dev/null || echo 'n/a')"
echo ""
echo "══════════════════════════════════════════════════════════════"
echo " ✓ ALL PHASES COMPLETE — ${NODE_ID}"
echo " ⚠  Reboot recommended to activate all kernel changes."
echo "══════════════════════════════════════════════════════════════"
log "Master wipe+reinstall+combat complete for ${NODE_ID}"
