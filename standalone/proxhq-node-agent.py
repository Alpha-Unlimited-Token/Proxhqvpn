#!/usr/bin/env python3
"""
ProxhqVPN Node Agent  v1.2.0
==============================
Runs on each VPN server.  Every 30 s it posts CPU / RAM / disk / WireGuard
peer telemetry to POST /api/node-agent/checkin so the dashboard shows live
data.  Every 10 s it posts a lightweight health update to /api/node-agent/health.

Reads configuration from /etc/proxhq/config.json:
  {
    "api_base":       "https://proxhqvpn.com",
    "node_agent_psk": "...",
    "node_id":        "proxhqvpn-node-2-london",
    "node_name":      "ProxhqVPN London #2",
    "wg_interface":   "wg0"
  }

CLI override:
  python3 proxhq-node-agent.py --config /etc/proxhq/config.json

Requirements:  Python 3.9+,  requests  (pip3 install requests --break-system-packages)
"""

import argparse
import json
import logging
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    import requests
except ImportError:
    print("Install deps: pip3 install requests --break-system-packages", file=sys.stderr)
    sys.exit(1)

AGENT_VERSION = "1.2.0"
CONFIG_PATH   = "/etc/proxhq/config.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [NodeAgent] %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("proxhq-agent")


# ── Config loader ─────────────────────────────────────────────────────────────

def load_config(path: str) -> Dict[str, Any]:
    with open(path) as f:
        cfg = json.load(f)
    required = ["api_base", "node_agent_psk", "node_id", "node_name"]
    for key in required:
        if not cfg.get(key):
            raise ValueError(f"Config missing required key: {key}")
    cfg.setdefault("wg_interface", "wg0")
    cfg.setdefault("checkin_interval", 30)
    cfg.setdefault("health_interval", 10)
    cfg.setdefault("retry_delay", 5)
    return cfg


# ── System metrics ────────────────────────────────────────────────────────────

def read_cpu_pct() -> float:
    """Read CPU usage via /proc/stat — simple 1-sample approach."""
    try:
        def _read_stat():
            with open("/proc/stat") as f:
                line = f.readline()
            parts = line.split()
            total = sum(int(x) for x in parts[1:])
            idle  = int(parts[4]) + int(parts[5])
            return total, idle

        t1, i1 = _read_stat()
        time.sleep(0.5)
        t2, i2 = _read_stat()
        delta_total = t2 - t1
        delta_idle  = i2 - i1
        if delta_total == 0:
            return 0.0
        return round(100.0 * (1 - delta_idle / delta_total), 1)
    except Exception as e:
        log.debug(f"CPU read failed: {e}")
        return 0.0


def read_mem_pct() -> float:
    try:
        info: Dict[str, int] = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    info[parts[0].rstrip(":")] = int(parts[1])
        total     = info.get("MemTotal", 0)
        available = info.get("MemAvailable", 0)
        if total == 0:
            return 0.0
        return round(100.0 * (total - available) / total, 1)
    except Exception as e:
        log.debug(f"Mem read failed: {e}")
        return 0.0


def read_disk_mb(path: str = "/") -> int:
    try:
        stat = os.statvfs(path)
        free_bytes = stat.f_bavail * stat.f_frsize
        return int(free_bytes / (1024 * 1024))
    except Exception as e:
        log.debug(f"Disk read failed: {e}")
        return 0


def read_wg_peers(iface: str) -> Dict[str, Any]:
    """Run `wg show <iface> dump` and return a peer summary."""
    try:
        result = subprocess.run(
            ["wg", "show", iface, "dump"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0:
            return {"error": result.stderr.strip(), "peers": [], "peer_count": 0}

        lines = result.stdout.strip().splitlines()
        # First line is the interface itself; subsequent lines are peers
        peers = []
        for line in lines[1:]:
            parts = line.split("\t")
            if len(parts) >= 8:
                last_hs = parts[4]
                rx_bytes = int(parts[5]) if parts[5].isdigit() else 0
                tx_bytes = int(parts[6]) if parts[6].isdigit() else 0
                peers.append({
                    "public_key":       parts[0][:16] + "…",
                    "endpoint":         parts[2] if parts[2] != "(none)" else None,
                    "allowed_ips":      parts[3],
                    "last_handshake_s": int(last_hs) if last_hs.isdigit() else None,
                    "rx_bytes":         rx_bytes,
                    "tx_bytes":         tx_bytes,
                })
        return {
            "peers":        peers,
            "peer_count":   len(peers),
            "active_peers": sum(
                1 for p in peers
                if p["last_handshake_s"] is not None and p["last_handshake_s"] < 180
            ),
        }
    except FileNotFoundError:
        return {"error": "wg not installed", "peers": [], "peer_count": 0}
    except Exception as e:
        return {"error": str(e), "peers": [], "peer_count": 0}


def detect_tools() -> list:
    tools = []
    for tool in ["wg", "wg-quick", "iptables", "nftables", "python3", "ss", "curl"]:
        if shutil.which(tool):
            tools.append(tool)
    return tools


def external_ip() -> Optional[str]:
    try:
        r = requests.get("https://api.ipify.org?format=json", timeout=5)
        return r.json().get("ip")
    except Exception:
        return None


# ── API client ────────────────────────────────────────────────────────────────

def _headers(psk: str) -> Dict[str, str]:
    return {
        "Content-Type":    "application/json",
        "X-Node-Agent-PSK": psk,
    }


def post_checkin(cfg: Dict[str, Any], cpu: float, mem: float, disk: int,
                 wg_info: Dict, ip: str, event: Optional[Dict] = None) -> bool:
    payload: Dict[str, Any] = {
        "nodeId":   cfg["node_id"],
        "nodeName": cfg["node_name"],
        "version":  AGENT_VERSION,
        "ip":       ip,
        "os":       platform.system() + " " + platform.release(),
        "arch":     platform.machine(),
        "tools":    detect_tools(),
        "cpuPct":   cpu,
        "memPct":   mem,
        "diskMb":   disk,
    }
    if event:
        payload["event"] = event

    try:
        r = requests.post(
            f"{cfg['api_base']}/api/node-agent/checkin",
            json=payload,
            headers=_headers(cfg["node_agent_psk"]),
            timeout=10,
        )
        if r.status_code == 200:
            log.info(f"Checkin OK — cpu={cpu}% mem={mem}% disk={disk}MB peers={wg_info.get('peer_count',0)}")
            return True
        elif r.status_code == 426:
            body = r.json()
            log.error(
                f"Agent version {AGENT_VERSION} rejected by server. "
                f"Minimum required: {body.get('minimumVersion')}. "
                f"Download: {body.get('upgradeUrl')}"
            )
        else:
            log.warning(f"Checkin HTTP {r.status_code}: {r.text[:200]}")
    except requests.exceptions.ConnectionError as e:
        log.warning(f"Checkin connection error (will retry): {e}")
    except requests.exceptions.Timeout:
        log.warning("Checkin timed out (will retry)")
    except Exception as e:
        log.error(f"Checkin failed: {e}")
    return False


def post_health(cfg: Dict[str, Any], cpu: float, mem: float, disk: int) -> bool:
    payload = {
        "nodeId": cfg["node_id"],
        "cpuPct": cpu,
        "memPct": mem,
        "diskMb": disk,
        "status": "active",
    }
    try:
        r = requests.post(
            f"{cfg['api_base']}/api/node-agent/health",
            json=payload,
            headers=_headers(cfg["node_agent_psk"]),
            timeout=8,
        )
        if r.status_code == 200:
            log.debug(f"Health OK — cpu={cpu}% mem={mem}%")
            return True
        log.warning(f"Health HTTP {r.status_code}: {r.text[:100]}")
    except Exception as e:
        log.debug(f"Health post failed (non-critical): {e}")
    return False


def post_event(cfg: Dict[str, Any], event_type: str, payload: Dict) -> bool:
    body = {
        "nodeId": cfg["node_id"],
        "events": [{"type": event_type, "payload": payload}],
    }
    try:
        r = requests.post(
            f"{cfg['api_base']}/api/node-agent/events",
            json=body,
            headers=_headers(cfg["node_agent_psk"]),
            timeout=8,
        )
        return r.status_code == 200
    except Exception as e:
        log.debug(f"Event post failed (non-critical): {e}")
    return False


# ── Agent loop ────────────────────────────────────────────────────────────────

def checkin_loop(cfg: Dict[str, Any]):
    """Full checkin every cfg['checkin_interval'] seconds."""
    interval    = int(cfg["checkin_interval"])
    retry_delay = int(cfg["retry_delay"])
    wg_iface    = cfg["wg_interface"]

    # Announce startup
    log.info(f"ProxhqVPN Node Agent {AGENT_VERSION} starting — node {cfg['node_id']}")
    startup_ip = external_ip() or "unknown"

    post_event(cfg, "agent_started", {
        "version":  AGENT_VERSION,
        "ip":       startup_ip,
        "os":       platform.system() + " " + platform.release(),
        "hostname": platform.node(),
        "ts":       datetime.now(timezone.utc).isoformat(),
    })

    while True:
        cpu     = read_cpu_pct()
        mem     = read_mem_pct()
        disk    = read_disk_mb()
        wg_info = read_wg_peers(wg_iface)
        ip      = external_ip() or startup_ip

        # Include WireGuard peer count as an event if there are active peers
        event = None
        if wg_info.get("peer_count", 0) > 0:
            event = {
                "type": "wg_peers",
                "payload": {
                    "peer_count":   wg_info["peer_count"],
                    "active_peers": wg_info.get("active_peers", 0),
                    "interface":    wg_iface,
                },
            }

        ok = post_checkin(cfg, cpu, mem, disk, wg_info, ip, event)
        if not ok:
            log.info(f"Checkin failed — retrying in {retry_delay}s")
            time.sleep(retry_delay)
            continue

        time.sleep(interval)


def health_loop(cfg: Dict[str, Any]):
    """Lightweight health post every cfg['health_interval'] seconds."""
    interval = int(cfg["health_interval"])
    # Stagger slightly so checkin and health don't fire simultaneously
    time.sleep(interval // 2)

    while True:
        cpu  = read_cpu_pct()
        mem  = read_mem_pct()
        disk = read_disk_mb()
        post_health(cfg, cpu, mem, disk)
        time.sleep(interval)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ProxhqVPN Node Agent")
    parser.add_argument("--config", default=CONFIG_PATH, help="Path to config.json")
    parser.add_argument("--debug",  action="store_true",  help="Enable debug logging")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if not os.path.exists(args.config):
        log.error(f"Config not found: {args.config}")
        log.error("Create /etc/proxhq/config.json (see /etc/proxhq/config.json.example)")
        sys.exit(1)

    try:
        cfg = load_config(args.config)
    except Exception as e:
        log.error(f"Config error: {e}")
        sys.exit(1)

    log.info(f"Loaded config: node_id={cfg['node_id']} api_base={cfg['api_base']}")

    health_thread = threading.Thread(target=health_loop, args=(cfg,), daemon=True)
    health_thread.start()

    checkin_loop(cfg)


if __name__ == "__main__":
    main()
