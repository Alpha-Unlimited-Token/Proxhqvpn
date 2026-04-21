#!/usr/bin/env python3
"""
ProxhqVPN Daemon (proxhqd)
Runs on each Vultr VPN node. Reports WireGuard peer stats and beacon
detections to the ProxhqVPN API server.

Deploy:
  scp tools/proxhqd.py root@YOUR_SERVER_IP:/usr/local/bin/proxhqd.py
  chmod +x /usr/local/bin/proxhqd.py
  python3 /usr/local/bin/proxhqd.py --api https://YOUR_REPLIT_DOMAIN/api --node-id 61

Autostart:
  cat > /etc/systemd/system/proxhqd.service << EOF
  [Unit]
  Description=ProxhqVPN Daemon
  After=network.target wg-quick@wg0.service

  [Service]
  ExecStart=/usr/bin/python3 /usr/local/bin/proxhqd.py --api https://YOUR_DOMAIN/api --node-id 61
  Restart=always
  RestartSec=30

  [Install]
  WantedBy=multi-user.target
  EOF
  systemctl enable --now proxhqd
"""

import argparse
import base64
import json
import os
import re
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Replit dev domains use a wildcard cert that Python's default SSL context rejects.
# Create one unverified context and reuse it for all daemon→API requests.
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


def run(cmd: list[str]) -> str:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return result.stdout.strip()
    except Exception:
        return ""


def get_wg_peers() -> list[dict]:
    """Parse `wg show all dump` to get real peer stats."""
    output = run(["wg", "show", "all", "dump"])
    peers = []
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) < 8:
            continue
        # interface lines have fewer fields; peer lines have 9
        if len(parts) == 9:
            pub_key, preshared, endpoint, allowed_ips, latest_handshake, rx, tx, keepalive = parts[1:]
            peers.append({
                "publicKey": pub_key,
                "endpoint": endpoint if endpoint != "(none)" else None,
                "allowedIps": allowed_ips,
                "latestHandshake": int(latest_handshake) if latest_handshake.isdigit() else 0,
                "rxBytes": int(rx) if rx.isdigit() else 0,
                "txBytes": int(tx) if tx.isdigit() else 0,
            })
    return peers


def get_wg_interface_stats() -> dict:
    """Get WireGuard interface status."""
    output = run(["wg", "show", "wg0"])
    stats = {"interface": "wg0", "peers": 0, "publicKey": ""}
    for line in output.splitlines():
        if "public key:" in line:
            stats["publicKey"] = line.split(":", 1)[1].strip()
        if "listening port:" in line:
            stats["listenPort"] = line.split(":", 1)[1].strip()
    stats["peers"] = len(get_wg_peers())
    return stats


def get_system_stats() -> dict:
    """Collect real system metrics."""
    cpu = ""
    mem_total = mem_used = 0

    # CPU via /proc/stat
    try:
        with open("/proc/stat") as f:
            first = f.readline().split()
        idle = int(first[4])
        total = sum(int(x) for x in first[1:])
        cpu = round((1 - idle / total) * 100, 1) if total else 0
    except Exception:
        cpu = 0

    # Memory via /proc/meminfo
    try:
        with open("/proc/meminfo") as f:
            info = {}
            for line in f:
                k, v = line.split(":")
                info[k.strip()] = int(v.split()[0])
        mem_total = info.get("MemTotal", 0) // 1024
        mem_available = info.get("MemAvailable", 0) // 1024
        mem_used = mem_total - mem_available
    except Exception:
        pass

    # Uptime
    try:
        with open("/proc/uptime") as f:
            uptime_seconds = float(f.read().split()[0])
    except Exception:
        uptime_seconds = 0

    # Network stats from /proc/net/dev for eth0
    net_rx = net_tx = 0
    try:
        with open("/proc/net/dev") as f:
            for line in f:
                if "eth0:" in line:
                    parts = line.split()
                    net_rx = int(parts[1]) // (1024 * 1024)
                    net_tx = int(parts[9]) // (1024 * 1024)
    except Exception:
        pass

    return {
        "cpuPercent": cpu,
        "memoryUsedMb": mem_used,
        "memoryTotalMb": mem_total,
        "memoryPercent": round(mem_used / mem_total * 100, 1) if mem_total else 0,
        "uptimeSeconds": int(uptime_seconds),
        "networkInMb": net_rx,
        "networkOutMb": net_tx,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def detect_beacon_probes(log_path: str = "/var/log/wg-beacon.log") -> list[dict]:
    """
    Read any new lines from the WireGuard beacon log.
    The log is written by an iptables LOG rule on suspicious ports.
    Set up with: iptables -A INPUT -p tcp --dport 22 -j LOG --log-prefix "BEACON:"
    """
    probes = []
    try:
        with open(log_path) as f:
            for line in f:
                if "BEACON:" not in line:
                    continue
                src_match = re.search(r"SRC=(\S+)", line)
                dpt_match = re.search(r"DPT=(\d+)", line)
                proto_match = re.search(r"PROTO=(\w+)", line)
                if src_match:
                    probes.append({
                        "sourceIp": src_match.group(1),
                        "destPort": int(dpt_match.group(1)) if dpt_match else 0,
                        "protocol": proto_match.group(1).lower() if proto_match else "unknown",
                        "raw": line.strip(),
                    })
    except FileNotFoundError:
        pass
    return probes


def post_to_api(api_base: str, path: str, payload: dict, psk: str, timeout: int = 10) -> bool:
    url = f"{api_base}{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "X-Daemon-PSK": psk},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
            return resp.status < 300
    except urllib.error.URLError as e:
        print(f"[proxhqd] API error {path}: {e}", file=sys.stderr)
        return False


def get_pending_peers(api_base: str, node_id: int, psk: str) -> list[dict]:
    """Poll the API for peer registrations that need to be applied."""
    url = f"{api_base}/daemon-inbound/pending-peers?nodeId={node_id}"
    req = urllib.request.Request(url, headers={"X-Daemon-PSK": psk})
    try:
        with urllib.request.urlopen(req, timeout=10, context=_SSL_CTX) as resp:
            data = json.loads(resp.read())
            return data.get("peers", [])
    except Exception as e:
        print(f"[proxhqd] Could not fetch pending peers: {e}", file=sys.stderr)
        return []


def apply_wg_peer(public_key: str, assigned_ip: str) -> tuple[bool, str]:
    """Add a peer to WireGuard and persist the config."""
    try:
        result = subprocess.run(
            ["wg", "set", "wg0", "peer", public_key, "allowed-ips", f"{assigned_ip}/32"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return False, result.stderr.strip()

        subprocess.run(["wg-quick", "save", "wg0"], capture_output=True, timeout=10)
        return True, ""
    except Exception as e:
        return False, str(e)


def ack_peer(api_base: str, command_id: int, success: bool, psk: str, error: str = "") -> None:
    """Tell the API whether the peer was successfully applied."""
    payload = {"commandId": command_id, "success": success}
    if error:
        payload["errorMessage"] = error
    post_to_api(api_base, "/daemon-inbound/peer-ack", payload, psk)


def get_vpngate_action(api_base: str, node_id: int, psk: str) -> dict:
    """Poll API for a pending VPN Gate action for this node."""
    url = f"{api_base}/daemon-inbound/vpngate-config?nodeId={node_id}"
    req = urllib.request.Request(url, headers={"X-Daemon-PSK": psk})
    try:
        with urllib.request.urlopen(req, timeout=10, context=_SSL_CTX) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[proxhqd] VPN Gate poll failed: {e}", file=sys.stderr)
        return {"action": "none"}


def ack_vpngate(api_base: str, session_id: int, success: bool, status: str, psk: str,
                exit_ip: str = "", error: str = "") -> None:
    """Ack VPN Gate connection state back to the API."""
    payload = {"sessionId": session_id, "success": success, "status": status}
    if exit_ip:
        payload["exitIp"] = exit_ip
    if error:
        payload["errorMessage"] = error
    post_to_api(api_base, "/daemon-inbound/vpngate-ack", payload, psk)


def get_public_ip() -> str:
    """Detect the current public exit IP."""
    for url in ["https://api.ipify.org", "https://icanhazip.com", "https://ipinfo.io/ip"]:
        try:
            with urllib.request.urlopen(url, timeout=6, context=_SSL_CTX) as resp:
                return resp.read().decode().strip()
        except Exception:
            pass
    return ""


def start_vpngate(config_b64: str, node_id: int) -> "subprocess.Popen | None":
    """Start OpenVPN with a VPN Gate config and swap iptables to route through tun0."""
    try:
        config = base64.b64decode(config_b64).decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[proxhqd] Failed to decode VPN Gate config: {e}", file=sys.stderr)
        return None

    # Write config and credentials to temp files
    ovpn_path = f"/tmp/proxhq-vpngate-{node_id}.ovpn"
    creds_path = f"/tmp/proxhq-vpngate-{node_id}-creds.txt"
    try:
        with open(ovpn_path, "w") as f:
            f.write(config)
        with open(creds_path, "w") as f:
            f.write("vpn\nvpn\n")
        os.chmod(ovpn_path, 0o600)
        os.chmod(creds_path, 0o600)
    except Exception as e:
        print(f"[proxhqd] Failed to write VPN Gate files: {e}", file=sys.stderr)
        return None

    print("[proxhqd] Starting OpenVPN for VPN Gate double-hop...")
    try:
        proc = subprocess.Popen(
            ["openvpn", "--config", ovpn_path, "--auth-user-pass", creds_path,
             "--verb", "1", "--connect-timeout", "30", "--resolv-retry", "infinite"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
    except FileNotFoundError:
        print("[proxhqd] openvpn not found — install with: apt install openvpn", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[proxhqd] Failed to start openvpn: {e}", file=sys.stderr)
        return None

    # Wait for tun0 to appear (up to 60 seconds)
    for i in range(60):
        result = subprocess.run(["ip", "link", "show", "tun0"], capture_output=True)
        if result.returncode == 0:
            print("[proxhqd] tun0 is up — switching iptables to route through VPN Gate")
            break
        time.sleep(1)
    else:
        print("[proxhqd] tun0 never appeared — VPN Gate connection may have failed", file=sys.stderr)
        proc.terminate()
        return None

    # Swap iptables NAT: eth0 → tun0 so WireGuard clients exit through VPN Gate
    subprocess.run(["iptables", "-t", "nat", "-D", "POSTROUTING", "-o", "eth0", "-j", "MASQUERADE"],
                   capture_output=True)
    subprocess.run(["iptables", "-t", "nat", "-A", "POSTROUTING", "-o", "tun0", "-j", "MASQUERADE"],
                   capture_output=True)
    print("[proxhqd] VPN Gate double-hop active — traffic now exits through tun0")
    return proc


def stop_vpngate(proc: "subprocess.Popen | None", node_id: int) -> None:
    """Stop OpenVPN and restore direct routing through eth0."""
    if proc and proc.poll() is None:
        print("[proxhqd] Stopping VPN Gate OpenVPN process...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    # Remove NAT rule for tun0 and restore eth0
    subprocess.run(["iptables", "-t", "nat", "-D", "POSTROUTING", "-o", "tun0", "-j", "MASQUERADE"],
                   capture_output=True)
    subprocess.run(["iptables", "-t", "nat", "-A", "POSTROUTING", "-o", "eth0", "-j", "MASQUERADE"],
                   capture_output=True)

    # Clean up temp files
    for path in [f"/tmp/proxhq-vpngate-{node_id}.ovpn", f"/tmp/proxhq-vpngate-{node_id}-creds.txt"]:
        try:
            os.unlink(path)
        except Exception:
            pass
    print("[proxhqd] VPN Gate stopped — traffic restored through eth0")


def main():
    parser = argparse.ArgumentParser(description="ProxhqVPN Node Daemon")
    parser.add_argument("--api", required=True, help="API base URL (e.g. https://yourapp.replit.app/api)")
    parser.add_argument("--node-id", required=True, type=int, help="Node ID in ProxhqVPN database")
    parser.add_argument("--psk", required=True, help="Daemon PSK — must match DAEMON_PSK env var on API server")
    parser.add_argument("--interval", default=30, type=int, help="Report interval in seconds (default: 30)")
    parser.add_argument("--beacon-log", default="/var/log/wg-beacon.log", help="Beacon probe log path")
    args = parser.parse_args()

    print(f"[proxhqd] Starting — node_id={args.node_id} api={args.api} interval={args.interval}s")

    # VPN Gate state
    vpngate_proc = None         # OpenVPN subprocess
    vpngate_session_id = None   # Active session ID

    while True:
        try:
            sys_stats = get_system_stats()
            wg_stats = get_wg_interface_stats()
            peers = get_wg_peers()

            report = {
                "nodeId": args.node_id,
                "system": sys_stats,
                "wireguard": {**wg_stats, "activePeers": len(peers)},
            }

            ok = post_to_api(args.api, "/daemon-inbound/report", report, args.psk)
            ts = datetime.now().strftime("%H:%M:%S")
            status = "OK" if ok else "FAIL"
            vg_status = f" vpngate={'ON' if vpngate_proc else 'OFF'}"
            print(f"[proxhqd] {ts} report={status} peers={len(peers)} cpu={sys_stats['cpuPercent']}%{vg_status}")

            # Auto-register any pending WireGuard peers
            pending = get_pending_peers(args.api, args.node_id, args.psk)
            for cmd in pending:
                pub_key = cmd["clientPublicKey"]
                ip = cmd["assignedIp"]
                cmd_id = cmd["id"]
                print(f"[proxhqd] Registering peer {pub_key[:16]}... → {ip}")
                success, error = apply_wg_peer(pub_key, ip)
                ack_peer(args.api, cmd_id, success, args.psk, error)
                if success:
                    print(f"[proxhqd] Peer {ip} registered OK")
                else:
                    print(f"[proxhqd] Peer {ip} FAILED: {error}", file=sys.stderr)

            # VPN Gate double-hop management
            vg_action = get_vpngate_action(args.api, args.node_id, args.psk)
            action = vg_action.get("action", "none")

            if action == "connect" and vpngate_proc is None:
                session_id = vg_action["sessionId"]
                config_b64 = vg_action["ovpnConfigB64"]
                country = vg_action.get("serverCountry", "?")
                server_ip = vg_action.get("serverIp", "?")
                print(f"[proxhqd] VPN Gate connect requested → {country} ({server_ip})")
                proc = start_vpngate(config_b64, args.node_id)
                if proc:
                    vpngate_proc = proc
                    vpngate_session_id = session_id
                    exit_ip = get_public_ip()
                    ack_vpngate(args.api, session_id, True, "connected", args.psk, exit_ip=exit_ip)
                    print(f"[proxhqd] VPN Gate connected — exit IP: {exit_ip}")
                else:
                    ack_vpngate(args.api, session_id, False, "error", args.psk,
                                error="OpenVPN failed to start or tun0 never appeared")

            elif action == "connect" and vpngate_proc is not None:
                # Already connected — check if process is still alive
                if vpngate_proc.poll() is not None:
                    print("[proxhqd] VPN Gate process died unexpectedly — reconnecting...")
                    vpngate_proc = None
                    vpngate_session_id = None
                    stop_vpngate(None, args.node_id)
                    # Will reconnect on next cycle

            elif action == "disconnect" and vpngate_proc is not None:
                session_id = vg_action["sessionId"]
                print(f"[proxhqd] VPN Gate disconnect requested")
                stop_vpngate(vpngate_proc, args.node_id)
                vpngate_proc = None
                vpngate_session_id = None
                ack_vpngate(args.api, session_id, True, "disconnected", args.psk)

            # Check if active VPN Gate process died
            if vpngate_proc is not None and vpngate_proc.poll() is not None:
                print("[proxhqd] VPN Gate process exited unexpectedly — restoring direct routing")
                stop_vpngate(None, args.node_id)
                vpngate_proc = None
                vpngate_session_id = None

            # Beacon detection
            probes = detect_beacon_probes(args.beacon_log)
            for probe in probes:
                beacon_payload = {
                    "nodeId": args.node_id,
                    "attackerIp": probe["sourceIp"],
                    "probeType": "port_scan" if probe["destPort"] in [22, 80, 443] else "tunnel_probe",
                    "fingerprint": f"IP:{probe['sourceIp']}|PORT:{probe['destPort']}|PROTO:{probe['protocol']}",
                    "raw": probe["raw"],
                }
                post_to_api(args.api, "/daemon-inbound/beacon", beacon_payload, args.psk)
                print(f"[proxhqd] BEACON detected from {probe['sourceIp']}:{probe['destPort']}")

        except Exception as e:
            print(f"[proxhqd] ERROR: {e}", file=sys.stderr)

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
