#!/usr/bin/env python3
"""
ProxhqVPN Real WireGuard Port Monitor
=======================================
Watches /var/log/proxhq-real-wg-probes.log for any probe on port 41194.
Any probe from an IP that is NOT a registered customer triggers an
IMMEDIATE high-severity alert to the ProxhqVPN backend.

Why this matters:
  Port 41194 should be completely invisible to internet scanners.
  Nobody except registered customers knows this port exists.
  Any probe here means someone found the hidden port — that is significant.

Install as systemd service alongside ghost-wireguard.py
"""

import re
import time
import threading
import requests
import logging
import argparse
import ipaddress
import os
from datetime import datetime, timezone
from collections import defaultdict

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [RealPortMon] %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("real-port-monitor")

LOG_FILE    = "/var/log/proxhq-real-wg-probes.log"
SRC_PATTERN = re.compile(r"SRC=(\S+)")
LEN_PATTERN = re.compile(r"LEN=(\d+)")
SPT_PATTERN = re.compile(r"SPT=(\d+)")

_reported: dict = defaultdict(list)
_report_lock = threading.Lock()
MAX_REPORTS_PER_IP = 3
REPORT_WINDOW_S = 300

def already_reported_too_much(ip: str) -> bool:
    now = time.time()
    with _report_lock:
        times = [t for t in _reported[ip] if now - t < REPORT_WINDOW_S]
        _reported[ip] = times
        if len(times) >= MAX_REPORTS_PER_IP:
            return True
        _reported[ip].append(now)
        return False

def parse_probe_line(line: str):
    src_match = SRC_PATTERN.search(line)
    len_match = LEN_PATTERN.search(line)
    spt_match = SPT_PATTERN.search(line)
    if not src_match:
        return None
    return {
        "source_ip":   src_match.group(1),
        "source_port": int(spt_match.group(1)) if spt_match else 0,
        "pkt_len":     int(len_match.group(1)) if len_match else 0,
        "raw_line":    line.strip(),
    }

def classify_probe(pkt_len: int) -> dict:
    if pkt_len == 148:
        return {
            "probe_type":  "wireguard_handshake_init",
            "description": "Real WireGuard handshake initiation — scanner knows WG protocol",
            "severity":    "critical",
        }
    elif pkt_len < 50:
        return {
            "probe_type":  "udp_ping",
            "description": "Small UDP probe — basic port scanner checking if port is open",
            "severity":    "high",
        }
    elif pkt_len == 32:
        return {
            "probe_type":  "possible_wg_keepalive",
            "description": "32-byte packet — possible WireGuard keepalive or probe",
            "severity":    "high",
        }
    else:
        return {
            "probe_type":  "unknown_udp",
            "description": f"Unknown UDP probe ({pkt_len} bytes) on hidden real WG port",
            "severity":    "high",
        }

def report_to_backend(probe: dict, classification: dict,
                       backend_url: str, psk: str, node_id: str):
    if already_reported_too_much(probe["source_ip"]):
        log.debug(f"Suppressing repeat report for {probe['source_ip']}")
        return

    payload = {
        "nodeId":      node_id,
        "sourceIp":    probe["source_ip"],
        "sourcePort":  probe["source_port"],
        "attackerIp":  probe["source_ip"],
        "probeType":   classification["probe_type"],
        "severity":    classification["severity"],
        "portProbed":  41194,
        "portLabel":   "REAL_WG_PORT_HIDDEN",
        "description": classification["description"],
        "pktLen":      probe["pkt_len"],
        "rawLogLine":  probe["raw_line"],
        "honeypotType": "real_port_monitor",
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "alertNote":   (
            "CRITICAL: This probe hit the hidden real WireGuard port (41194). "
            "This port is not published anywhere. The source IP either ran a "
            "full port range scan or has prior knowledge of this infrastructure."
        ),
    }

    try:
        r = requests.post(
            f"{backend_url}/api/daemon-inbound/honeypot-hit",
            json=payload,
            headers={
                "X-Daemon-PSK":  psk,
                "X-Alert-Level": "critical",
            },
            timeout=5,
        )
        if r.status_code == 200:
            log.warning(
                f"REPORTED: {probe['source_ip']}:{probe['source_port']} "
                f"probed HIDDEN port 41194 \u2014 {classification['probe_type']}"
            )
        else:
            log.error(f"Backend report failed: HTTP {r.status_code}")
    except Exception as e:
        log.error(f"Backend report error: {e}")

def tail_log(log_path: str, backend_url: str, psk: str, node_id: str):
    log.info(f"Monitoring {log_path} for real WireGuard port probes...")

    with open(log_path, "r") as f:
        f.seek(0, 2)

        while True:
            line = f.readline()
            if not line:
                time.sleep(0.5)
                continue

            if "PROXHQ_REAL_WG_PROBE" not in line:
                continue

            probe = parse_probe_line(line)
            if not probe:
                continue

            try:
                if ipaddress.ip_address(probe["source_ip"]).is_private:
                    log.debug(f"Skipping private IP: {probe['source_ip']}")
                    continue
            except ValueError:
                continue

            log.warning(
                f"PROBE ON HIDDEN PORT 41194: "
                f"{probe['source_ip']}:{probe['source_port']} "
                f"pkt_len={probe['pkt_len']}"
            )

            classification = classify_probe(probe["pkt_len"])

            threading.Thread(
                target=report_to_backend,
                args=(probe, classification, backend_url, psk, node_id),
                daemon=True,
            ).start()

def main():
    parser = argparse.ArgumentParser(
        description="ProxhqVPN Real WireGuard Port Monitor"
    )
    parser.add_argument("--log-file",  default=LOG_FILE, help="Probe log file to monitor")
    parser.add_argument("--backend",   required=True,    help="ProxhqVPN backend URL")
    parser.add_argument("--psk",       required=True,    help="Daemon PSK")
    parser.add_argument("--node-id",   required=True,    help="This node's ID")
    args = parser.parse_args()

    if not os.path.exists(args.log_file):
        log.warning(f"Log file {args.log_file} does not exist yet \u2014 waiting...")
        while not os.path.exists(args.log_file):
            time.sleep(5)

    log.info(f"ProxhqVPN Real Port Monitor started \u2014 node {args.node_id}")
    log.info(f"Watching: {args.log_file}")
    log.info(f"Any probe on port 41194 = HIGH SEVERITY ALERT")

    tail_log(args.log_file, args.backend, args.psk, args.node_id)

if __name__ == "__main__":
    main()
