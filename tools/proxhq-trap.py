#!/usr/bin/env python3
"""
ProxhqVPN Ghost Trap — Honeypot daemon
Runs as an unprivileged user (nobody/www-data). Listens on port 8880,
lures attackers with fake service banners, reports hits to the ProxhqVPN API.

Zero privileged operations: no subprocess, no file writes, no system calls.
Safe to run as `nobody` with no capabilities.

Deploy:
  scp tools/proxhq-trap.py root@SERVER:/usr/local/bin/proxhq-trap.py
  chmod +x /usr/local/bin/proxhq-trap.py

Systemd service (runs as nobody):
  [Unit]
  Description=ProxhqVPN Ghost Trap Honeypot
  After=network.target

  [Service]
  Type=simple
  User=nobody
  Group=nogroup
  ExecStart=/usr/bin/python3 /usr/local/bin/proxhq-trap.py \
    --api https://network-labyrinth.replit.app/api \
    --node-id 61 \
    --psk YOUR_PSK
  Restart=always
  RestartSec=10
  NoNewPrivileges=true
  PrivateTmp=true
  ProtectSystem=strict
  ProtectHome=true
  CapabilityBoundingSet=
  AmbientCapabilities=

  [Install]
  WantedBy=multi-user.target
"""

import argparse
import json
import socket
import socketserver
import ssl
import sys
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone

HONEYPOT_PORT = 8880

# Use a verified TLS context. For self-signed certs in a private lab only,
# set PROXHQ_SKIP_TLS_VERIFY=1 — never set this in production.
import os as _os
if _os.environ.get("PROXHQ_SKIP_TLS_VERIFY") == "1":
    _SSL_CTX = ssl._create_unverified_context()  # insecure dev-only mode
    print("[trap] WARNING: TLS verification disabled — do NOT use in production", file=sys.stderr)
else:
    _SSL_CTX = ssl.create_default_context()

_BANNERS = {
    "http": (
        b"HTTP/1.1 200 OK\r\n"
        b"Server: Apache/2.4.51 (Ubuntu)\r\n"
        b"Content-Type: text/html; charset=utf-8\r\n"
        b"Connection: close\r\n\r\n"
        b"<html><body><h1>It works!</h1><p>Apache2 Default Page</p></body></html>\r\n"
    ),
    "ssh": b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n",
    "ftp": b"220 ProFTPD 1.3.5 Server ready.\r\n",
    "smtp": b"220 mail.localhost ESMTP Postfix (Ubuntu)\r\n",
}


def _respond(request: bytes) -> bytes:
    r = request.decode("latin-1", errors="replace")
    if r.startswith(("GET ", "POST ", "HEAD ", "PUT ", "DELETE ", "OPTIONS ")):
        return _BANNERS["http"]
    if r.startswith("SSH-"):
        return _BANNERS["ssh"]
    if r.startswith(("EHLO", "HELO", "MAIL")):
        return _BANNERS["smtp"]
    return _BANNERS["ftp"]


def _post(api_base: str, path: str, payload: dict, psk: str) -> None:
    url = api_base.rstrip("/") + path
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json", "X-Daemon-PSK": psk},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=_SSL_CTX):
            pass
    except Exception as exc:
        print(f"[trap] API error {path}: {exc}", file=sys.stderr)


class TrapHandler(socketserver.BaseRequestHandler):
    api_base: str = ""
    node_id: int = 0
    psk: str = ""

    def handle(self):
        attacker_ip = self.client_address[0]
        try:
            self.request.settimeout(3)
            raw = b""
            try:
                raw = self.request.recv(1024)
            except Exception:
                pass

            banner = _respond(raw)
            try:
                self.request.sendall(banner)
            except Exception:
                pass

            raw_str = raw.decode("latin-1", errors="replace")[:500]
            ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
            print(f"[trap] {ts} HIT from {attacker_ip} — {raw_str[:60]!r}")

            _post(TrapHandler.api_base, "/daemon-inbound/honeypot-hit", {
                "nodeId": TrapHandler.node_id,
                "attackerIp": attacker_ip,
                "port": HONEYPOT_PORT,
                "banner": banner.decode("latin-1", errors="replace")[:200],
                "rawRequest": raw_str,
            }, TrapHandler.psk)

        except Exception as exc:
            print(f"[trap] ERROR from {attacker_ip}: {exc}", file=sys.stderr)


class TrapServer(socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    parser = argparse.ArgumentParser(description="ProxhqVPN Ghost Trap honeypot")
    parser.add_argument("--api",     required=True, help="API base URL")
    parser.add_argument("--node-id", required=True, type=int, help="Node ID")
    parser.add_argument("--psk",     required=True, help="Daemon PSK")
    parser.add_argument("--port",    default=HONEYPOT_PORT, type=int)
    args = parser.parse_args()

    TrapHandler.api_base = args.api
    TrapHandler.node_id  = args.node_id
    TrapHandler.psk      = args.psk

    import os as _os
    try:
        current_user = _os.environ.get("USER") or str(_os.getuid())
    except Exception:
        current_user = "unknown"
    print(f"[trap] Ghost Trap listening on port {args.port} (uid={current_user})")

    with TrapServer(("0.0.0.0", args.port), TrapHandler) as server:
        server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.serve_forever()


if __name__ == "__main__":
    main()
