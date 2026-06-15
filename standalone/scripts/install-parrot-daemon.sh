#!/bin/bash
  # ============================================================
  # ProxhqVPN — Parrot OS Node Daemon Installer
  # Copyright © 2026 Alpha Unlimited Technologies LLC
  # ============================================================
  # Installs the proxhq-daemon on a VPN node (Parrot OS / Debian).
  # The daemon:
  #   • Checks in to the control plane every 30 seconds (CPU/RAM/disk/WireGuard)
  #   • Monitors iptables logs for port scans, probes, and connection attempts
  #   • Reports all hits to the API so you get email alerts
  #   • Sends lightweight health telemetry every 10 seconds
  #   • Auto-starts on boot via systemd
  #
  # Run as root on each VPN node:
  #   curl -sSL https://your-domain/api/ghost-trap/lure/... | bash
  #   — or — copy this file to the node and run: bash install-parrot-daemon.sh
  # ============================================================

  set -euo pipefail

  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
  log()  { echo -e "${CYAN}[$(date -u +%H:%M:%S)]${NC} $*"; }
  ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
  warn() { echo -e "${YELLOW}[!]${NC} $*"; }
  die()  { echo -e "${RED}[✗] FATAL:${NC} $*"; exit 1; }

  [[ $EUID -ne 0 ]] && die "Run as root (sudo bash $0)"

  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║      ProxhqVPN Node Daemon Installer v2.0.0          ║${NC}"
  echo -e "${BOLD}${CYAN}║      Alpha Unlimited Technologies LLC  © 2026         ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""

  # ── Known node map ────────────────────────────────────────────────────────────
  declare -A NODE_IDS=(
    ["66.42.121.25"]="61"
    ["192.248.160.69"]="62"
    ["108.61.219.202"]="63"
    ["45.76.97.51"]="64"
  )
  declare -A NODE_NAMES=(
    ["66.42.121.25"]="GhostNode-OUT-01-2F9A"
    ["192.248.160.69"]="GhostNode-OUT-04-4472"
    ["108.61.219.202"]="GhostNode-OUT-01-320D"
    ["45.76.97.51"]="GhostNode-OUT-01-70FA"
  )
  declare -A NODE_PORTS=(
    ["66.42.121.25"]="51821"
    ["192.248.160.69"]="51824"
    ["108.61.219.202"]="51821"
    ["45.76.97.51"]="51821"
  )

  # ── Detect this node's public IP ──────────────────────────────────────────────
  log "Detecting public IP..."
  PUBLIC_IP=$(curl -fsSL --max-time 8 https://api.ipify.org 2>/dev/null || \
             curl -fsSL --max-time 8 https://checkip.amazonaws.com 2>/dev/null || \
             curl -fsSL --max-time 8 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || \
             echo "")
  PUBLIC_IP=$(echo "$PUBLIC_IP" | tr -d '[:space:]')

  NODE_ID="${NODE_IDS[$PUBLIC_IP]:-}"
  NODE_NAME="${NODE_NAMES[$PUBLIC_IP]:-}"
  WG_PORT="${NODE_PORTS[$PUBLIC_IP]:-51820}"

  if [[ -z "$NODE_ID" ]]; then
    warn "This IP ($PUBLIC_IP) is not in the known node list."
    echo ""
    read -rp "  Enter your Node ID (number from dashboard): " NODE_ID
    read -rp "  Enter your Node Name (e.g. GhostNode-OUT-01-XXXX): " NODE_NAME
    read -rp "  Enter WireGuard port [51820]: " WG_PORT
    WG_PORT="${WG_PORT:-51820}"
  fi

  ok "Node: $NODE_NAME (ID: $NODE_ID) — $PUBLIC_IP:$WG_PORT"

  # ── Configuration prompts ─────────────────────────────────────────────────────
  echo ""
  log "Configuration — press Enter to accept defaults"
  echo ""

  # API URL
  if [[ -z "${API_URL:-}" ]]; then
    read -rp "  API URL (your Replit domain, e.g. https://abc.replit.app): " API_URL
    [[ -z "$API_URL" ]] && die "API_URL is required"
  fi
  API_URL=${API_URL%/}

  # NODE_AGENT_PSK
  if [[ -z "${NODE_AGENT_PSK:-}" ]]; then
    read -rsp "  NODE_AGENT_PSK (from your Replit secrets): " NODE_AGENT_PSK
    echo ""
    [[ -z "$NODE_AGENT_PSK" ]] && die "NODE_AGENT_PSK is required"
  fi

  ok "API URL: $API_URL"
  ok "PSK: ${NODE_AGENT_PSK:0:4}**** (redacted)"

  # ── Install system dependencies ───────────────────────────────────────────────
  echo ""
  log "Installing dependencies..."
  apt-get update -qq
  apt-get install -y -qq \
    python3 python3-pip iptables iptables-persistent netfilter-persistent \
    curl jq iproute2 net-tools procps sysstat psmisc >/dev/null 2>&1
  pip3 install -q requests psutil 2>/dev/null || pip3 install -q --break-system-packages requests psutil
  ok "Dependencies installed"

  # ── Set up iptables LOG chain for probe detection ─────────────────────────────
  echo ""
  log "Configuring iptables probe detection..."

  # Create PROXHQ_LOG chain
  iptables  -N PROXHQ_LOG 2>/dev/null || iptables  -F PROXHQ_LOG
  ip6tables -N PROXHQ_LOG 2>/dev/null || ip6tables -F PROXHQ_LOG

  # Log new connection attempts (SYN packets) with PROXHQ prefix
  iptables -A PROXHQ_LOG -p tcp --syn -j LOG \
    --log-prefix "PROXHQ_PROBE: " --log-level 4 --log-tcp-options --log-ip-options
  iptables -A PROXHQ_LOG -p udp -j LOG \
    --log-prefix "PROXHQ_PROBE: " --log-level 4
  iptables -A PROXHQ_LOG -p icmp -j LOG \
    --log-prefix "PROXHQ_PROBE: " --log-level 4
  iptables -A PROXHQ_LOG -j RETURN

  ip6tables -A PROXHQ_LOG -p tcp --syn -j LOG \
    --log-prefix "PROXHQ_PROBE: " --log-level 4
  ip6tables -A PROXHQ_LOG -j RETURN

  # Hook into INPUT chain — skip WireGuard port and established connections
  iptables -C INPUT -m conntrack --ctstate NEW -j PROXHQ_LOG 2>/dev/null || \
    iptables -I INPUT 2 -m conntrack --ctstate NEW -j PROXHQ_LOG

  ip6tables -C INPUT -m conntrack --ctstate NEW -j PROXHQ_LOG 2>/dev/null || \
    ip6tables -I INPUT 2 -m conntrack --ctstate NEW -j PROXHQ_LOG

  # Persist
  netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4

  # Ensure rsyslog writes kernel logs to /var/log/kern.log (standard on Debian/Parrot)
  if ! grep -q "kern.log" /etc/rsyslog.conf /etc/rsyslog.d/*.conf 2>/dev/null; then
    echo 'kern.*  /var/log/kern.log' > /etc/rsyslog.d/10-proxhq-kern.conf
    systemctl restart rsyslog 2>/dev/null || true
  fi

  ok "iptables probe detection active"

  # ── Write the Python daemon ───────────────────────────────────────────────────
  echo ""
  log "Writing daemon to /usr/local/bin/proxhq-daemon.py..."

  cat > /usr/local/bin/proxhq-daemon.py << 'PYEOF'
  #!/usr/bin/env python3
  """
  ProxhqVPN Node Daemon — Parrot OS Edition
  Copyright © 2026 Alpha Unlimited Technologies LLC

  Monitors iptables LOG entries and WireGuard state, reports all probe
  events and system telemetry to the ProxhqVPN control plane API.
  """
  import os, sys, re, time, json, logging, subprocess, threading
  from collections import defaultdict
  from datetime import datetime, timezone

  try:
      import requests
      import psutil
  except ImportError:
      print("[proxhq-daemon] psutil/requests not installed — pip3 install requests psutil", flush=True)
      sys.exit(1)

  # ── Config (injected by installer) ───────────────────────────────────────────
  API_URL        = os.environ["PROXHQ_API_URL"].rstrip("/")
  NODE_ID        = os.environ["PROXHQ_NODE_ID"]
  NODE_NAME      = os.environ["PROXHQ_NODE_NAME"]
  PUBLIC_IP      = os.environ["PROXHQ_PUBLIC_IP"]
  WG_PORT        = int(os.environ.get("PROXHQ_WG_PORT", "51820"))
  PSK            = os.environ["PROXHQ_PSK"]
  CHECKIN_SECS   = int(os.environ.get("PROXHQ_CHECKIN_SECS", "30"))
  HEALTH_SECS    = int(os.environ.get("PROXHQ_HEALTH_SECS", "10"))
  BATCH_SIZE     = int(os.environ.get("PROXHQ_BATCH_SIZE", "20"))
  VERSION        = "2.0.0"

  # ── Logging ───────────────────────────────────────────────────────────────────
  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s [proxhq-daemon] %(levelname)s %(message)s",
      datefmt="%Y-%m-%dT%H:%M:%SZ",
  )
  log = logging.getLogger("proxhq")

  HEADERS = {
      "x-node-agent-psk": PSK,
      "Content-Type": "application/json",
      "User-Agent": f"proxhq-daemon/{VERSION}",
  }

  # ── Port → probe type mapping ─────────────────────────────────────────────────
  PORT_PROBE_MAP = {
      22:   ("port_scan", "ssh_probe"),
      23:   ("port_scan", "telnet_probe"),
      25:   ("port_scan", "smtp_probe"),
      53:   ("port_scan", "dns_probe"),
      80:   ("port_scan", "http_probe"),
      443:  ("port_scan", "https_probe"),
      445:  ("port_scan", "smb_probe"),
      1433: ("port_scan", "mssql_probe"),
      3306: ("port_scan", "mysql_probe"),
      3389: ("port_scan", "rdp_probe"),
      5432: ("port_scan", "postgres_probe"),
      5900: ("port_scan", "vnc_probe"),
      6379: ("port_scan", "redis_probe"),
      8080: ("port_scan", "http_alt_probe"),
      8443: ("port_scan", "https_alt_probe"),
      27017:("port_scan", "mongodb_probe"),
  }

  # ── Rate limiting: max 10 events per IP per 60s ───────────────────────────────
  _ip_hit_times: dict = defaultdict(list)
  _ip_lock = threading.Lock()

  def _ip_rate_ok(ip: str) -> bool:
      now = time.time()
      cutoff = now - 60
      with _ip_lock:
          times = [t for t in _ip_hit_times[ip] if t > cutoff]
          if len(times) >= 10:
              return False
          times.append(now)
          _ip_hit_times[ip] = times
          return True

  def _clean_rate_map():
      cutoff = time.time() - 120
      with _ip_lock:
          for ip in list(_ip_hit_times.keys()):
              _ip_hit_times[ip] = [t for t in _ip_hit_times[ip] if t > cutoff]
              if not _ip_hit_times[ip]:
                  del _ip_hit_times[ip]

  # ── API helpers ───────────────────────────────────────────────────────────────
  def api_post(path: str, body: dict, timeout: int = 10) -> bool:
      try:
          r = requests.post(f"{API_URL}/api/{path}", json=body, headers=HEADERS, timeout=timeout)
          if r.status_code in (200, 201):
              return True
          log.warning(f"POST {path} → {r.status_code}: {r.text[:200]}")
          return False
      except Exception as e:
          log.error(f"POST {path} failed: {e}")
          return False

  # ── System telemetry ──────────────────────────────────────────────────────────
  def get_telemetry() -> dict:
      try:
          cpu = psutil.cpu_percent(interval=1)
          mem = psutil.virtual_memory().percent
          disk = int(psutil.disk_usage("/").free / 1_048_576)  # MB free
          return {"cpuPct": cpu, "memPct": mem, "diskMb": disk}
      except Exception:
          return {"cpuPct": 0.0, "memPct": 0.0, "diskMb": 0}

  def get_wg_info() -> dict:
      try:
          out = subprocess.check_output(["wg", "show"], timeout=5, stderr=subprocess.DEVNULL).decode()
          pub_match  = re.search(r"public key:\s+(\S+)", out)
          port_match = re.search(r"listening port:\s+(\d+)", out)
          peers      = len(re.findall(r"^peer:", out, re.MULTILINE))
          return {
              "publicKey":   pub_match.group(1)  if pub_match  else None,
              "listenPort":  port_match.group(1) if port_match else str(WG_PORT),
              "activePeers": peers,
          }
      except Exception:
          return {}

  def get_os_info() -> str:
      try:
          u = subprocess.check_output(["uname", "-srm"], timeout=3).decode().strip()
          return u
      except Exception:
          return "Parrot OS"

  # ── Check-in loop ─────────────────────────────────────────────────────────────
  def checkin_loop():
      os_info = get_os_info()
      first = True
      while True:
          try:
              tel = get_telemetry()
              wg  = get_wg_info()
              body: dict = {
                  "nodeId":   NODE_ID,
                  "nodeName": NODE_NAME,
                  "version":  VERSION,
                  "ip":       PUBLIC_IP,
                  "os":       os_info,
                  "arch":     os.uname().machine,
                  "cpuPct":   tel["cpuPct"],
                  "memPct":   tel["memPct"],
                  "diskMb":   tel["diskMb"],
              }
              if first:
                  body["event"] = {
                      "type": "daemon_started",
                      "payload": {
                          "version": VERSION, "wg": wg,
                          "startedAt": datetime.now(timezone.utc).isoformat(),
                      },
                  }
                  first = False
              ok = api_post("node-agent/checkin", body)
              if ok:
                  log.info(f"Checkin OK — CPU:{tel['cpuPct']:.1f}% MEM:{tel['memPct']:.1f}% DISK:{tel['diskMb']}MB")
          except Exception as e:
              log.error(f"Checkin error: {e}")
          time.sleep(CHECKIN_SECS)

  # ── Health telemetry loop (every 10s) ─────────────────────────────────────────
  def health_loop():
      time.sleep(10)
      while True:
          try:
              tel = get_telemetry()
              api_post("node-agent/health", {
                  "nodeId": NODE_ID,
                  "cpuPct": tel["cpuPct"],
                  "memPct": tel["memPct"],
                  "diskMb": tel["diskMb"],
                  "status": "active",
              })
          except Exception as e:
              log.error(f"Health error: {e}")
          time.sleep(HEALTH_SECS)

  # ── iptables log parser ────────────────────────────────────────────────────────
  PROXHQ_PREFIX = "PROXHQ_PROBE:"
  LOG_PATTERN   = re.compile(
      r"PROXHQ_PROBE:.*?SRC=(\S+).*?DST=(\S+).*?PROTO=(\S+)"
      r"(?:.*?(?:DPT|SPT)=(\d+))?",
      re.DOTALL
  )

  def parse_log_line(line: str) -> dict | None:
      if PROXHQ_PREFIX not in line:
          return None
      m = LOG_PATTERN.search(line)
      if not m:
          return None
      src   = m.group(1)
      proto = m.group(3).lower()
      dpt   = int(m.group(4)) if m.group(4) else 0

      # Skip our own WireGuard port and loopback
      if src.startswith("127.") or src == PUBLIC_IP or src.startswith("10."):
          return None
      if dpt == WG_PORT:
          return None

      probe_type, detail = PORT_PROBE_MAP.get(dpt, ("port_scan", f"{proto}_port_{dpt}"))
      severity = "critical" if proto == "icmp" and dpt == 0 else "high"
      if dpt in (80, 8080, 443, 8443, 53):
          severity = "medium"

      return {
          "src": src, "proto": proto, "dpt": dpt,
          "probe_type": probe_type, "detail": detail, "severity": severity,
      }

  # ── Event batch sender ────────────────────────────────────────────────────────
  _event_queue: list = []
  _queue_lock  = threading.Lock()

  def flush_events():
      with _queue_lock:
          if not _event_queue:
              return
          batch = _event_queue[:BATCH_SIZE]
          del _event_queue[:BATCH_SIZE]
      ok = api_post("node-agent/events", {"nodeId": NODE_ID, "events": batch})
      if ok:
          log.info(f"Flushed {len(batch)} probe event(s)")
      else:
          with _queue_lock:
              _event_queue[:0] = batch  # put back on failure

  def enqueue_probe(parsed: dict):
      if not _ip_rate_ok(parsed["src"]):
          return
      event = {
          "type": "beacon_probe",
          "payload": {
              "attackerIp":  parsed["src"],
              "probeType":   parsed["probe_type"],
              "detail":      parsed["detail"],
              "severity":    parsed["severity"],
              "protocol":    parsed["proto"],
              "destPort":    parsed["dpt"],
              "nodeId":      NODE_ID,
              "nodeName":    NODE_NAME,
              "detectedAt":  datetime.now(timezone.utc).isoformat(),
          },
      }
      with _queue_lock:
          _event_queue.append(event)
      log.info(f"Queued probe: {parsed['src']} → port {parsed['dpt']} ({parsed['detail']}) [{parsed['severity']}]")

  # ── Flush loop (every 5s) ─────────────────────────────────────────────────────
  def flush_loop():
      while True:
          time.sleep(5)
          try:
              flush_events()
              _clean_rate_map()
          except Exception as e:
              log.error(f"Flush error: {e}")

  # ── Tail iptables logs ────────────────────────────────────────────────────────
  def tail_logs():
      """Read from journalctl -k -f for kernel (iptables) messages."""
      log.info("Starting iptables log monitor via journalctl...")
      try:
          proc = subprocess.Popen(
              ["journalctl", "-k", "-f", "--no-pager", "--output=short-monotonic"],
              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
              text=True, bufsize=1,
          )
          for line in proc.stdout:
              if PROXHQ_PREFIX in line:
                  parsed = parse_log_line(line)
                  if parsed:
                      enqueue_probe(parsed)
      except FileNotFoundError:
          log.warning("journalctl not found — falling back to /var/log/kern.log tail")
          tail_kern_log()
      except Exception as e:
          log.error(f"journalctl tail error: {e}")

  def tail_kern_log():
      """Fallback: tail /var/log/kern.log directly."""
      kern_log = "/var/log/kern.log"
      if not os.path.exists(kern_log):
          log.error(f"{kern_log} does not exist — ensure rsyslog is logging kernel messages")
          return
      log.info(f"Tailing {kern_log}...")
      proc = subprocess.Popen(
          ["tail", "-F", kern_log],
          stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
          text=True, bufsize=1,
      )
      for line in proc.stdout:
          if PROXHQ_PREFIX in line:
              parsed = parse_log_line(line)
              if parsed:
                  enqueue_probe(parsed)

  # ── Main ──────────────────────────────────────────────────────────────────────
  def main():
      log.info(f"ProxhqVPN Daemon v{VERSION} starting")
      log.info(f"Node: {NODE_NAME} (ID:{NODE_ID}) — {PUBLIC_IP} — API:{API_URL}")
      log.info(f"WireGuard port excluded from probe detection: {WG_PORT}")

      # Start background threads
      for target, name in [
          (checkin_loop,  "checkin"),
          (health_loop,   "health"),
          (flush_loop,    "flush"),
      ]:
          t = threading.Thread(target=target, name=name, daemon=True)
          t.start()
          log.info(f"Thread started: {name}")

      # Main thread: tail logs (blocking)
      tail_logs()

  if __name__ == "__main__":
      main()
  PYEOF

  chmod +x /usr/local/bin/proxhq-daemon.py
  ok "Python daemon written"

  # ── Write systemd service ─────────────────────────────────────────────────────
  echo ""
  log "Creating systemd service..."

  cat > /etc/systemd/system/proxhq-daemon.service << EOF
  [Unit]
  Description=ProxhqVPN Node Daemon — Alpha Unlimited Technologies LLC
  Documentation=https://proxhqvpn.com/manuals
  After=network-online.target wg-quick@wg0.service
  Wants=network-online.target
  StartLimitIntervalSec=120
  StartLimitBurst=5

  [Service]
  Type=simple
  User=root
  ExecStart=/usr/bin/python3 /usr/local/bin/proxhq-daemon.py
  Restart=always
  RestartSec=10s

  # Environment
  Environment=PROXHQ_API_URL=${API_URL}
  Environment=PROXHQ_NODE_ID=${NODE_ID}
  Environment=PROXHQ_NODE_NAME=${NODE_NAME}
  Environment=PROXHQ_PUBLIC_IP=${PUBLIC_IP}
  Environment=PROXHQ_WG_PORT=${WG_PORT}
  Environment=PROXHQ_PSK=${NODE_AGENT_PSK}
  Environment=PROXHQ_CHECKIN_SECS=30
  Environment=PROXHQ_HEALTH_SECS=10
  Environment=PROXHQ_BATCH_SIZE=20

  # Hardening
  NoNewPrivileges=no
  PrivateTmp=yes
  ProtectSystem=no
  ProtectHome=read-only
  CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW CAP_SYS_PTRACE

  # Logging
  StandardOutput=journal
  StandardError=journal
  SyslogIdentifier=proxhq-daemon

  [Install]
  WantedBy=multi-user.target
  EOF

  ok "Systemd service created"

  # ── Enable and start ──────────────────────────────────────────────────────────
  echo ""
  log "Enabling and starting proxhq-daemon..."
  systemctl daemon-reload
  systemctl enable proxhq-daemon
  systemctl restart proxhq-daemon

  sleep 3
  if systemctl is-active --quiet proxhq-daemon; then
    ok "proxhq-daemon is RUNNING"
  else
    warn "Service may not have started — check: journalctl -u proxhq-daemon -n 50"
  fi

  # ── Verify first check-in ─────────────────────────────────────────────────────
  echo ""
  log "Waiting for first check-in (up to 15s)..."
  for i in {1..15}; do
    CODE=$(curl -fsSL -o /dev/null -w "%{http_code}" --max-time 5 \
      -H "x-node-agent-psk: ${NODE_AGENT_PSK}" \
      "${API_URL}/api/node-agent/health" 2>/dev/null || echo "000")
    if [[ "$CODE" == "200" ]]; then
      ok "API reachable (HTTP 200)"
      break
    fi
    sleep 1
  done

  # ── Summary ───────────────────────────────────────────────────────────────────
  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║              INSTALLATION COMPLETE ✓                 ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Node          : ${BOLD}${NODE_NAME}${NC} (ID: ${NODE_ID})"
  echo -e "  Public IP     : ${BOLD}${PUBLIC_IP}${NC}"
  echo -e "  WireGuard port: ${BOLD}${WG_PORT}${NC} (excluded from probe detection)"
  echo -e "  Check-in rate : Every 30s | Health: Every 10s"
  echo -e "  Service       : proxhq-daemon"
  echo ""
  echo -e "  Useful commands:"
  echo -e "    journalctl -u proxhq-daemon -f          # live daemon logs"
  echo -e "    systemctl status proxhq-daemon          # service status"
  echo -e "    systemctl restart proxhq-daemon         # restart"
  echo -e "    iptables -L PROXHQ_LOG -n --line-numbers  # probe detection rules"
  echo ""
  echo -e "  ${YELLOW}When someone port-scans or probes this node, you will get${NC}"
  echo -e "  ${YELLOW}an email at both admin addresses within 5-15 seconds.${NC}"
  echo ""
  