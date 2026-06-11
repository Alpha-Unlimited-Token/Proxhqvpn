#!/usr/bin/env python3
"""
ProxhqVPN Honeypot Relay Agent
© Alpha Unlimited Technologies LLC

Reads Cowrie JSON log and Suricata EVE JSON, batches events,
and ships them to the ProxhqVPN /api/honeypot/ingest endpoint.
"""
import os
import json
import time
import hashlib
import logging
import requests
from pathlib import Path
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("relay")

API_URL      = os.environ["PROXHQ_API_URL"].rstrip("/")
PSK          = os.environ["HONEYPOT_PSK"]
NODE_NAME    = os.environ.get("HONEYPOT_NODE_NAME", "hpnode-01")
INTERVAL     = int(os.environ.get("RELAY_INTERVAL", "15"))
COWRIE_LOG   = Path(os.environ.get("COWRIE_LOG", "/cowrie/var/log/cowrie.json"))
SURICATA_LOG = Path(os.environ.get("SURICATA_LOG", "/var/log/suricata/eve.json"))
STATE_FILE   = Path("/tmp/hp_relay_state.json")

INGEST_URL   = f"{API_URL}/api/honeypot/ingest"
HEADERS      = {
    "Content-Type": "application/json",
    "X-Honeypot-PSK": PSK,
    "X-Node-Name": NODE_NAME,
}


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"cowrie_offset": 0, "suricata_offset": 0}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state))


def tail_json_log(path: Path, offset: int) -> tuple[list[dict], int]:
    """Read new lines from a JSONL log file starting at byte offset."""
    events = []
    if not path.exists():
        return events, offset
    try:
        with path.open("r", errors="replace") as f:
            f.seek(offset)
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
            new_offset = f.tell()
        return events, new_offset
    except OSError as e:
        log.warning(f"Cannot read {path}: {e}")
        return events, offset


def cowrie_to_ingest(events: list[dict]) -> list[dict]:
    """Convert Cowrie JSON events to ProxhqVPN ingest format."""
    result = []
    for ev in events:
        ev_type = ev.get("eventid", "")
        base = {
            "source": "cowrie",
            "nodeName": NODE_NAME,
            "protocol": "ssh",
            "timestamp": ev.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "srcIp": ev.get("src_ip", ""),
            "srcPort": ev.get("src_port"),
            "username": ev.get("username"),
            "password": ev.get("password"),
            "sessionId": ev.get("session"),
            "raw": ev,
        }
        if "cmd.input" in ev_type:
            base["eventType"] = "command"
            base["command"] = ev.get("input", "")
        elif "login" in ev_type:
            base["eventType"] = "login_attempt"
            base["success"] = "success" in ev_type
        elif "session.connect" in ev_type:
            base["eventType"] = "session_start"
            base["clientVersion"] = ev.get("version", "")
        elif "session.closed" in ev_type:
            base["eventType"] = "session_end"
            base["duration"] = ev.get("duration")
        elif "session.file_download" in ev_type:
            base["eventType"] = "file_download"
            base["fileUrl"] = ev.get("url", "")
            base["fileSha256"] = ev.get("shasum", "")
            base["filename"] = ev.get("outfile", "")
        else:
            base["eventType"] = ev_type
        result.append(base)
    return result


def suricata_to_ingest(events: list[dict]) -> list[dict]:
    """Convert Suricata EVE JSON events to ProxhqVPN ingest format."""
    result = []
    for ev in events:
        ev_type = ev.get("event_type", "")
        if ev_type not in ("alert", "ssh", "tls", "http", "dns"):
            continue
        entry = {
            "source": "suricata",
            "nodeName": NODE_NAME,
            "protocol": ev.get("proto", "tcp").lower(),
            "timestamp": ev.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "srcIp": ev.get("src_ip", ""),
            "srcPort": ev.get("src_port"),
            "destPort": ev.get("dest_port"),
            "raw": ev,
        }
        if ev_type == "alert":
            alert = ev.get("alert", {})
            entry["eventType"] = "ids_alert"
            entry["alertSignature"] = alert.get("signature", "")
            entry["alertCategory"] = alert.get("category", "")
            entry["alertSeverity"] = alert.get("severity", 3)
            entry["mitreTechnique"] = alert.get("metadata", {}).get("mitre_technique_id", [""])[0] if isinstance(alert.get("metadata", {}).get("mitre_technique_id"), list) else ""
        elif ev_type == "ssh":
            ssh = ev.get("ssh", {})
            entry["eventType"] = "ssh_metadata"
            entry["clientVersion"] = ssh.get("client", {}).get("software_version", "")
        else:
            entry["eventType"] = ev_type
        result.append(entry)
    return result


def ship_events(events: list[dict]) -> int:
    if not events:
        return 0
    # Chunk into batches of 100
    accepted = 0
    for i in range(0, len(events), 100):
        batch = events[i:i+100]
        try:
            resp = requests.post(
                INGEST_URL,
                headers=HEADERS,
                json={"events": batch},
                timeout=15,
            )
            resp.raise_for_status()
            accepted += resp.json().get("accepted", len(batch))
        except Exception as e:
            log.error(f"Failed to ship batch: {e}")
    return accepted


def main():
    log.info(f"Relay agent starting — node={NODE_NAME} interval={INTERVAL}s")
    log.info(f"Shipping to: {INGEST_URL}")
    while True:
        try:
            state = load_state()
            all_events = []

            # Cowrie
            cowrie_events, new_cowrie_offset = tail_json_log(COWRIE_LOG, state["cowrie_offset"])
            if cowrie_events:
                all_events.extend(cowrie_to_ingest(cowrie_events))
                state["cowrie_offset"] = new_cowrie_offset

            # Suricata
            suricata_events, new_suricata_offset = tail_json_log(SURICATA_LOG, state["suricata_offset"])
            if suricata_events:
                all_events.extend(suricata_to_ingest(suricata_events))
                state["suricata_offset"] = new_suricata_offset

            if all_events:
                accepted = ship_events(all_events)
                log.info(f"Shipped {len(all_events)} events → {accepted} accepted")
            save_state(state)

        except Exception as e:
            log.error(f"Relay loop error: {e}")

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
