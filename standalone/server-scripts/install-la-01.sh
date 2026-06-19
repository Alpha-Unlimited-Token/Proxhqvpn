#!/bin/bash
# ProxhqVPN — Full Security Stack Installer
# Server : proxhqvpn-los-angeles-01
# Region : US-Los-Angeles
# IP     : 108.61.219.202
# Generated: 2026-06-18 23:04 UTC
set -e
echo "=================================================="
echo " ProxhqVPN Installer — proxhqvpn-los-angeles-01 (US-Los-Angeles)"
echo "=================================================="

# ── Pre-filled variables (no editing needed) ──────────────────────────────────
export NODE_ID="proxhqvpn-los-angeles-01"
export NODE_REGION="US-Los-Angeles"
export REPLIT_DOMAIN="8ed1e79f-3fa7-4c82-b61d-7b93cb57936e-00-1arzc3ag01duz.spock.replit.dev"
export HONEYPOT_PSK="d8bc18968a21cfb9982d7970a11f6cad4f9f468587dcdfcfc211937f57f6dbc2"
export NODE_AGENT_PSK="655014e5d0bce05bc7bb20258570cf7ac77a956baabc04e77980529b56964a11"
export WG_PORT="39285"
export API_PORT="8080"
export WG_SUBNET="10.8.3"

echo "[1/15] System update..."
apt-get update -qq && apt-get upgrade -y -qq

echo "[2/15] Installing packages..."
apt-get install -y -qq   wireguard wireguard-tools nftables knockd nmap curl   python3 python3-pip net-tools iproute2 iptables   fail2ban unattended-upgrades jq vim
systemctl stop ufw 2>/dev/null; systemctl disable ufw 2>/dev/null; apt-get remove -y -qq ufw 2>/dev/null; true

echo "[3/15] Generating WireGuard keys (RAM-only)..."
export SERVER_PRIVATE_KEY=$(wg genkey)
export SERVER_PUBLIC_KEY=$(echo "$SERVER_PRIVATE_KEY" | wg pubkey)
echo "  Public Key: $SERVER_PUBLIC_KEY"
mkdir -p /dev/shm/proxhq && chmod 700 /dev/shm/proxhq
echo "$SERVER_PRIVATE_KEY" > /dev/shm/proxhq/wg0.key
chmod 600 /dev/shm/proxhq/wg0.key

echo "[4/15] Writing environment file..."
mkdir -p /etc/proxhq && chmod 700 /etc/proxhq
cat > /etc/proxhq/env << EOF
NODE_ID=proxhqvpn-los-angeles-01
NODE_REGION=US-Los-Angeles
HONEYPOT_PSK=d8bc18968a21cfb9982d7970a11f6cad4f9f468587dcdfcfc211937f57f6dbc2
NODE_AGENT_PSK=655014e5d0bce05bc7bb20258570cf7ac77a956baabc04e77980529b56964a11
PROXHQ_API=https://8ed1e79f-3fa7-4c82-b61d-7b93cb57936e-00-1arzc3ag01duz.spock.replit.dev
WG_PORT=39285
EOF
chmod 600 /etc/proxhq/env
echo "  Done."

echo "[5/15] Enabling IP forwarding..."
IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
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

echo "[6/15] Configuring WireGuard (port )..."
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address    = 10.8.3.1/24
ListenPort = 39285
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
    22:    b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n",
    23:    b"\xff\xfb\x01\xff\xfb\x03\xff\xfd\x18\xff\xfd\x1fWelcome to Ubuntu 22.04 LTS\r\nlogin: ",
    25:    b"220 mail.internal.net ESMTP Postfix (Ubuntu)\r\n",
    110:   b"+OK POP3 server ready\r\n",
    143:   b"* OK [CAPABILITY IMAP4rev1 STARTTLS] Dovecot ready.\r\n",
    443:   b"HTTP/1.1 200 OK\r\nServer: nginx/1.18.0\r\nContent-Length: 0\r\n\r\n",
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
  set ALLOWED_UDP { type inet_service; elements = { 39285, 53 } }
  set ALLOWED_TCP { type inet_service; elements = { 8080, 443, 80 } }
  set GHOST_NODE_PORTS { type inet_service; elements = { 51820, 51821, 51822, 1194, 4500, 500 } }
  set GHOST_TRAP_PORTS { type inet_service; elements = { 21, 22, 23, 25, 110, 143, 445, 1433, 3306, 3389, 5432, 5900, 6379, 8443, 9200, 27017 } }
  chain input {
    type filter hook input priority 0 ; policy drop ;
    iif lo accept
    ct state established,related accept
    ip protocol icmp limit rate 10/second accept
    ip6 nexthdr icmpv6 limit rate 10/second accept
    udp dport @ALLOWED_UDP accept
    tcp dport @ALLOWED_TCP accept
    udp dport @GHOST_NODE_PORTS log prefix "PROXHQ_GHOST_NODE: " drop
    tcp dport @GHOST_NODE_PORTS log prefix "PROXHQ_GHOST_NODE: " drop
    tcp dport @GHOST_TRAP_PORTS log prefix "PROXHQ_GHOST_TRAP_TCP: " accept
    udp dport @GHOST_TRAP_PORTS log prefix "PROXHQ_GHOST_TRAP_UDP: " accept
    limit rate 200/minute log prefix "PROXHQ_DROP: "
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
    ip saddr 10.8.3.0/24 masquerade
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
echo "  Port knock guard on 7000→8000→9000."

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
curl -sf -X POST "${API}/api/node-agent/checkin"   -H "Content-Type: application/json"   -H "X-Node-Agent-PSK: ${PSK}"   -d "${PAYLOAD}" --max-time 10 --retry 3 >/dev/null 2>&1
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
/opt/proxhq/agent/node-agent.sh

echo "[15/15] Verification..."
echo ""
echo "══════════════════════════════════════════════════"
echo " proxhqvpn-los-angeles-01 — Install Complete"
echo "══════════════════════════════════════════════════"
echo ""
echo "WireGuard interfaces:"
wg show all | grep -E "interface|listening"
echo ""
echo "Service status:"
for svc in proxhq-ghost-trap proxhq-honeypot proxhq-agent.timer knockd fail2ban nftables; do
  STATUS=$(systemctl is-active $svc 2>/dev/null)
  [ "$STATUS" = "active" ] && MARK="✓" || MARK="✗"
  printf "  ${MARK} %-28s %s\n" "$svc" "$STATUS"
done
echo ""
echo "Firewall layers active:"
nft list ruleset | grep -E "GHOST|DROP|ALLOWED|policy" | head -10
echo ""
echo "IP forwarding: $(sysctl -n net.ipv4.ip_forward)"
echo ""
echo "══════════════════════════════════════════════════"
echo " Done. All 15 steps complete on proxhqvpn-los-angeles-01."
echo "══════════════════════════════════════════════════"
