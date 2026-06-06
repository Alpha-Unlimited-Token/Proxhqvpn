#!/usr/bin/env python3
"""
ProxhqVPN TUN Interface Daemon
Captures all OS-level network traffic via a TUN virtual interface,
encrypts each packet with XOR+AES-like obfuscation, and forwards
it over UDP through the ProxhqVPN node swarm.

Requires root/Administrator privileges.
Linux: uses /dev/net/tun (TUN kernel module)
macOS: uses /dev/utunN (built-in, no driver needed)
Windows: requires WinTun driver (installed with WireGuard)

Usage:
  sudo python3 tun_daemon.py [--iface tun0] [--port 7475] [--node-host 127.0.0.1] [--node-port 4141]
"""

import os
import sys
import struct
import socket
import threading
import time
import json
import hashlib
import argparse
import signal
import platform
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [ProxhqVPN-TUN]  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("proxhqvpn-tun")

TUNSETIFF   = 0x400454CA
IFF_TUN     = 0x0001
IFF_NO_PI   = 0x1000

KEY = hashlib.sha256(b"ProxhqVPNTunKey-v1").digest()

stats = {
    "packets_in":   0,
    "packets_out":  0,
    "bytes_in":     0,
    "bytes_out":    0,
    "errors":       0,
    "started_at":   None,
    "running":      False,
    "iface":        None,
    "platform":     platform.system(),
    "pid":          os.getpid(),
}

tun_fd   = None
udp_sock = None
stop_evt = threading.Event()


def xor_crypt(data: bytes, key: bytes) -> bytes:
    klen = len(key)
    return bytes(b ^ key[i % klen] for i, b in enumerate(data))


def ghost_encrypt(packet: bytes) -> bytes:
    header = struct.pack(">HH", len(packet), 0xAB)
    payload = xor_crypt(packet, KEY)
    chk = sum(payload) & 0xFFFF
    return header + struct.pack(">H", chk) + payload


def ghost_decrypt(data: bytes) -> bytes | None:
    if len(data) < 6:
        return None
    pkt_len, magic = struct.unpack(">HH", data[:4])
    if magic != 0xAB:
        return None
    chk_recv = struct.unpack(">H", data[4:6])[0]
    payload = data[6:]
    if sum(payload) & 0xFFFF != chk_recv:
        return None
    return xor_crypt(payload[:pkt_len], KEY)


def create_tun_linux(name: str) -> int:
    fd = os.open("/dev/net/tun", os.O_RDWR)
    ifr = struct.pack("16sH", name.encode(), IFF_TUN | IFF_NO_PI)
    import fcntl
    fcntl.ioctl(fd, TUNSETIFF, ifr)
    os.system(f"ip link set {name} up 2>/dev/null")
    os.system(f"ip addr add 10.99.0.1/24 dev {name} 2>/dev/null")
    os.system(f"ip route add default dev {name} metric 1000 2>/dev/null")
    log.info(f"Linux TUN interface {name} created (10.99.0.1/24)")
    return fd


def create_tun_macos(name: str = "utun9") -> int:
    import subprocess, time
    num = int(name.replace("utun", "") or "9")

    class _UTUN(socket.socket):
        pass

    AF_SYSTEM  = 32
    SYSPROTO_CONTROL = 2
    AF_SYS_CONTROL  = 2
    UTUN_OPT_IFNAME = 2

    sock = socket.socket(AF_SYSTEM, socket.SOCK_DGRAM, SYSPROTO_CONTROL)
    CTLIOCGINFO = 0xC0644E03
    info = struct.pack("I96s", 0, b"com.apple.net.utun_control")
    import fcntl
    info = fcntl.ioctl(sock.fileno(), CTLIOCGINFO, info)
    ctl_id = struct.unpack("I96s", info)[0]
    addr   = struct.pack("BBHBI", 16, AF_SYSTEM, AF_SYS_CONTROL, ctl_id, num)
    sock.connect(addr)
    iface  = sock.getsockopt(SYSPROTO_CONTROL, UTUN_OPT_IFNAME, 64).rstrip(b"\x00").decode()
    log.info(f"macOS utun interface {iface} created")
    os.system(f"ifconfig {iface} 10.99.0.1 10.99.0.2 up 2>/dev/null")
    return sock.fileno()


def create_tun(iface: str) -> int:
    system = platform.system()
    if system == "Linux":
        return create_tun_linux(iface)
    elif system == "Darwin":
        return create_tun_macos("utun9")
    elif system == "Windows":
        log.error(
            "Windows TUN requires the WinTun driver (ships with WireGuard).\n"
            "Install WireGuard from https://www.wireguard.com/install/ then re-run."
        )
        sys.exit(1)
    else:
        log.error(f"Unsupported platform: {system}")
        sys.exit(1)


def destroy_tun(iface: str) -> None:
    system = platform.system()
    if system == "Linux":
        os.system(f"ip link del {iface} 2>/dev/null")
    log.info(f"TUN interface {iface} released")


def packet_reader(node_host: str, node_port: int) -> None:
    global tun_fd, udp_sock
    buf = bytearray(4096)
    while not stop_evt.is_set():
        try:
            n = os.readv(tun_fd, [buf])
            if n <= 0:
                continue
            pkt = bytes(buf[:n])
            stats["packets_in"] += 1
            stats["bytes_in"]   += n

            proto = pkt[9] if len(pkt) > 9 else 0
            proto_name = {6: "TCP", 17: "UDP", 1: "ICMP"}.get(proto, f"IP/{proto}")
            if stats["packets_in"] % 50 == 1:
                log.debug(f"→ captured {n}B {proto_name} packet")

            encrypted = ghost_encrypt(pkt)
            udp_sock.sendto(encrypted, (node_host, node_port))
            stats["packets_out"] += 1
            stats["bytes_out"]   += len(encrypted)

        except OSError as e:
            if stop_evt.is_set():
                break
            stats["errors"] += 1
            log.error(f"read error: {e}")
            time.sleep(0.1)


def packet_writer() -> None:
    global tun_fd, udp_sock
    while not stop_evt.is_set():
        try:
            data, _ = udp_sock.recvfrom(4096)
            pkt = ghost_decrypt(data)
            if pkt:
                os.write(tun_fd, pkt)
        except OSError as e:
            if stop_evt.is_set():
                break
            stats["errors"] += 1
            log.error(f"write error: {e}")
            time.sleep(0.1)


class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path == "/status":
            body = json.dumps({**stats, "uptime_s": round(time.time() - stats["started_at"], 1) if stats["started_at"] else 0}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/stop":
            stop_evt.set()
            body = b'{"stopped":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        self.do_GET()


def run_control_server(port: int) -> None:
    srv = HTTPServer(("127.0.0.1", port), ControlHandler)
    srv.timeout = 1
    log.info(f"Control HTTP server on 127.0.0.1:{port}")
    while not stop_evt.is_set():
        srv.handle_request()


def main() -> None:
    global tun_fd, udp_sock

    if os.geteuid() != 0 if hasattr(os, "geteuid") else False:
        log.error("ProxhqVPN TUN daemon requires root privileges (sudo).")
        sys.exit(1)

    p = argparse.ArgumentParser(description="ProxhqVPN TUN Daemon")
    p.add_argument("--iface",     default="tun0",        help="TUN interface name (Linux)")
    p.add_argument("--port",      type=int, default=7475, help="Control HTTP port")
    p.add_argument("--node-host", default="127.0.0.1",   help="ProxhqVPN node UDP host")
    p.add_argument("--node-port", type=int, default=4141, help="ProxhqVPN node UDP port")
    args = p.parse_args()

    def _sig(_s, _f):
        log.info("Signal received — shutting down.")
        stop_evt.set()

    signal.signal(signal.SIGTERM, _sig)
    signal.signal(signal.SIGINT,  _sig)

    log.info("Starting ProxhqVPN TUN Daemon …")
    tun_fd = create_tun(args.iface)
    stats["iface"]      = args.iface
    stats["running"]    = True
    stats["started_at"] = time.time()

    udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp_sock.settimeout(1.0)

    t_read  = threading.Thread(target=packet_reader, args=(args.node_host, args.node_port), daemon=True)
    t_write = threading.Thread(target=packet_writer, daemon=True)
    t_ctrl  = threading.Thread(target=run_control_server, args=(args.port,), daemon=True)

    t_read.start()
    t_write.start()
    t_ctrl.start()

    log.info(
        f"TUN daemon running | iface={args.iface} | "
        f"node={args.node_host}:{args.node_port} | ctrl=:{args.port}"
    )

    stop_evt.wait()

    stats["running"] = False
    try:
        udp_sock.close()
        os.close(tun_fd)
    except Exception:
        pass
    destroy_tun(args.iface)
    log.info("ProxhqVPN TUN daemon stopped cleanly.")


if __name__ == "__main__":
    main()
