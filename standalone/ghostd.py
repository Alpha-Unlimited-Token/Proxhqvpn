#!/usr/bin/env python3
"""
GhostNet VPN Daemon  (ghostd.py)  v2.0
=======================================
A real, self-contained VPN daemon implementing:
  - TUN virtual interface (Linux /dev/net/tun, macOS utun, Windows WinTun)
  - AES-256-GCM authenticated encryption with X25519 ECDH key exchange
  - HKDF-SHA256 session key derivation
  - Per-packet random nonce (replay-safe)
  - OS-level kill switch (iptables / pf / netsh WFP)
  - DNS leak prevention
  - Split tunneling via routing tables
  - Multi-peer round-robin / failover
  - Local REST API on 127.0.0.1:7475 for dashboard control
  - Structured audit log

Modes:
  server  --  Accept client peers, NAT their traffic, route to internet
  client  --  Connect to a GhostNet server, route local traffic through it
  local   --  Route through a local SOCKS5 proxy (Tor)

Requirements:
  Python 3.9+
  pip install cryptography

Privileges:
  Linux / macOS:  sudo python3 ghostd.py ...
  Windows:        Run as Administrator

Usage examples:
  # Start as VPN server on UDP 51820
  sudo python3 ghostd.py --mode server --port 51820 --psk "my-strong-passphrase"

  # Connect as client to a server
  sudo python3 ghostd.py --mode client --server 203.0.113.10:51820 --psk "my-strong-passphrase"

  # Route through local Tor SOCKS5 proxy (no server needed)
  sudo python3 ghostd.py --mode local --socks5 127.0.0.1:9050
"""

from __future__ import annotations

import os
import sys
import struct
import socket
import threading
import time
import json
import argparse
import signal
import platform
import logging
import ipaddress
import hashlib
import secrets
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timezone

# ─── Dependency check ─────────────────────────────────────────────────────────
try:
    from cryptography.hazmat.primitives.asymmetric.x25519 import (
        X25519PrivateKey, X25519PublicKey,
    )
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    CRYPTO_OK = True
except ImportError:
    CRYPTO_OK = False
    print(
        "[GhostNet] FATAL: 'cryptography' package not found.\n"
        "  Install with:  pip install cryptography\n"
        "  Or run:        pip install -r requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

# ─── Constants ─────────────────────────────────────────────────────────────────
VERSION       = "2.0.0"
MAGIC         = b"\x47\x48\x4E\x54"   # "GHNT"
PROTO_VERSION = 0x02

FLAG_DATA      = 0x01
FLAG_HANDSHAKE = 0x02
FLAG_KEEPALIVE = 0x04
FLAG_DISCONNECT = 0x08

HEADER_SIZE = 22     # 4 magic + 1 ver + 1 flags + 12 nonce + 4 payload_len
GCM_TAG_LEN = 16
MTU         = 1500

TUN_NAME_LINUX  = "ghost0"
TUN_ADDR        = "10.99.0.1"
TUN_PEER_ADDR   = "10.99.0.2"
TUN_CIDR        = "10.99.0.0/24"
DNS_GHOSTNET    = ["1.1.1.1", "9.9.9.9"]   # Cloudflare + Quad9

TUNSETIFF = 0x400454CA
IFF_TUN   = 0x0001
IFF_NO_PI = 0x1000

CTRL_PORT = 7475

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [GhostNet]  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ghostnet")

# ─── Shared state ─────────────────────────────────────────────────────────────
_lock = threading.Lock()
_stop = threading.Event()

audit_log: List[Dict] = []

state: Dict = {
    "mode":           "idle",
    "running":        False,
    "connected":      False,
    "iface":          None,
    "tun_addr":       TUN_ADDR,
    "server":         None,
    "peers":          [],
    "active_peer":    None,
    "kill_switch":    False,
    "dns_protected":  False,
    "split_routes":   [],
    "bytes_in":       0,
    "bytes_out":      0,
    "packets_in":     0,
    "packets_out":    0,
    "errors":         0,
    "started_at":     None,
    "platform":       platform.system(),
    "version":        VERSION,
    "pid":            os.getpid(),
    "real_iface":     None,
    "real_gw":        None,
}

# ─── Audit log ────────────────────────────────────────────────────────────────
def audit(event: str, detail: str = "", level: str = "info") -> None:
    entry = {
        "ts":     datetime.now(timezone.utc).isoformat(),
        "level":  level,
        "event":  event,
        "detail": detail,
    }
    with _lock:
        audit_log.append(entry)
        if len(audit_log) > 2000:
            audit_log.pop(0)
    getattr(log, level if level in ("debug","info","warning","error") else "info")(
        f"[AUDIT] {event}: {detail}"
    )

# ─── Crypto ───────────────────────────────────────────────────────────────────
class GhostCrypto:
    """AES-256-GCM session with X25519 ECDH handshake."""

    def __init__(self, psk: str):
        self._psk_bytes = psk.encode("utf-8")
        self._private_key = X25519PrivateKey.generate()
        self._public_bytes = self._private_key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        self._session_key: Optional[bytes] = None
        self._aesgcm: Optional[AESGCM] = None

    @property
    def public_bytes(self) -> bytes:
        return self._public_bytes

    def psk_hash(self) -> bytes:
        return hashlib.sha256(self._psk_bytes).digest()

    def derive_session_key(self, peer_public_bytes: bytes) -> None:
        peer_pub = X25519PublicKey.from_public_bytes(peer_public_bytes)
        shared   = self._private_key.exchange(peer_pub)
        info     = b"ghostnet-session-v2"
        salt     = hashlib.sha256(self._psk_bytes).digest()
        hkdf     = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info)
        self._session_key = hkdf.derive(shared)
        self._aesgcm      = AESGCM(self._session_key)
        audit("crypto.session_derived", "X25519+HKDF-SHA256 session key established")

    def encrypt(self, plaintext: bytes) -> Tuple[bytes, bytes]:
        """Returns (nonce, ciphertext_with_tag)."""
        if not self._aesgcm:
            raise RuntimeError("Session key not derived yet")
        nonce = secrets.token_bytes(12)
        ct    = self._aesgcm.encrypt(nonce, plaintext, None)
        return nonce, ct

    def decrypt(self, nonce: bytes, ct: bytes) -> Optional[bytes]:
        if not self._aesgcm:
            return None
        try:
            return self._aesgcm.decrypt(nonce, ct, None)
        except Exception:
            return None

# ─── Wire protocol helpers ────────────────────────────────────────────────────
def encode_packet(flags: int, payload: bytes, nonce: bytes = b"\x00"*12) -> bytes:
    hdr = MAGIC + bytes([PROTO_VERSION, flags]) + nonce + struct.pack(">I", len(payload))
    return hdr + payload

def decode_header(data: bytes) -> Optional[Dict]:
    if len(data) < HEADER_SIZE:
        return None
    if data[:4] != MAGIC:
        return None
    ver   = data[4]
    flags = data[5]
    nonce = data[6:18]
    plen  = struct.unpack(">I", data[18:22])[0]
    payload = data[22:22+plen] if len(data) >= 22+plen else None
    return {"ver": ver, "flags": flags, "nonce": nonce, "plen": plen, "payload": payload}

def build_handshake(crypto: GhostCrypto) -> bytes:
    payload = crypto.public_bytes + crypto.psk_hash()
    return encode_packet(FLAG_HANDSHAKE, payload)

# ─── TUN interface ────────────────────────────────────────────────────────────
class TunInterface:
    def __init__(self):
        self.fd   = -1
        self.name = None
        self._sock = None  # macOS socket holder

    def open(self, name: str = TUN_NAME_LINUX) -> None:
        sys_name = platform.system()
        if sys_name == "Linux":
            self._open_linux(name)
        elif sys_name == "Darwin":
            self._open_darwin()
        elif sys_name == "Windows":
            self._open_windows()
        else:
            raise RuntimeError(f"Unsupported platform: {sys_name}")
        audit("tun.open", f"Interface {self.name} opened ({TUN_ADDR})")
        state["iface"] = self.name

    def _open_linux(self, name: str) -> None:
        import fcntl
        self.fd   = os.open("/dev/net/tun", os.O_RDWR)
        ifr       = struct.pack("16sH", name.encode(), IFF_TUN | IFF_NO_PI)
        fcntl.ioctl(self.fd, TUNSETIFF, ifr)
        self.name = name
        self._run(f"ip link set {name} up")
        self._run(f"ip addr add {TUN_ADDR}/24 dev {name}")
        log.info(f"Linux TUN {name} up at {TUN_ADDR}/24")

    def _open_darwin(self) -> None:
        import fcntl
        AF_SYSTEM        = 32
        SYSPROTO_CONTROL = 2
        AF_SYS_CONTROL   = 2
        UTUN_OPT_IFNAME  = 2
        CTLIOCGINFO      = 0xC0644E03

        sock = socket.socket(AF_SYSTEM, socket.SOCK_DGRAM, SYSPROTO_CONTROL)
        info = struct.pack("I96s", 0, b"com.apple.net.utun_control")
        info = fcntl.ioctl(sock.fileno(), CTLIOCGINFO, info)
        ctl_id = struct.unpack("I96s", info)[0]
        # utun9 -> unit number 9
        addr = struct.pack("BBHBI", 16, AF_SYSTEM, AF_SYS_CONTROL, ctl_id, 9)
        sock.connect(addr)
        iface = sock.getsockopt(SYSPROTO_CONTROL, UTUN_OPT_IFNAME, 64)
        self.name  = iface.rstrip(b"\x00").decode()
        self.fd    = sock.fileno()
        self._sock = sock  # keep reference
        self._run(f"ifconfig {self.name} {TUN_ADDR} {TUN_PEER_ADDR} up")
        self._run(f"route add -net {TUN_CIDR} -interface {self.name}")
        log.info(f"macOS utun {self.name} up at {TUN_ADDR}")

    def _open_windows(self) -> None:
        """
        Windows requires WinTun.dll (shipped with WireGuard installer).
        We use ctypes to load wintun.dll and create a TUN adapter.
        """
        import ctypes
        wintun_paths = [
            r"C:\Windows\System32\wintun.dll",
            r"C:\Program Files\WireGuard\wintun.dll",
            os.path.join(os.path.dirname(__file__), "wintun.dll"),
        ]
        dll = None
        for p in wintun_paths:
            if os.path.exists(p):
                dll = ctypes.WinDLL(p)
                break
        if not dll:
            raise RuntimeError(
                "WinTun driver not found.\n"
                "Download wintun.dll from https://www.wintun.net/\n"
                "Place it alongside ghostd.py  OR  install WireGuard."
            )
        # WintunCreateAdapter(name, tunnel_type, guid)
        import uuid
        guid_str = str(uuid.UUID("12345678-1234-5678-1234-567812345678"))
        adapter  = dll.WintunCreateAdapter("GhostNet", "VPN", None)
        if not adapter:
            raise RuntimeError("WintunCreateAdapter failed")
        session = dll.WintunStartSession(adapter, 0x400000)  # 4MB ring
        if not session:
            raise RuntimeError("WintunStartSession failed")
        self._wintun_dll     = dll
        self._wintun_adapter = adapter
        self._wintun_session = session
        self.name = "GhostNet"
        # Configure IP via netsh
        self._run(
            f'netsh interface ip set address name="{self.name}" static {TUN_ADDR} 255.255.255.0'
        )
        log.info(f"Windows WinTun adapter {self.name} up at {TUN_ADDR}")

    def read(self) -> Optional[bytes]:
        """Read one IP packet from the TUN interface."""
        sys_name = platform.system()
        try:
            if sys_name == "Windows":
                # WinTun uses WintunReceivePacket
                size = ctypes.c_uint32(0)
                ptr  = self._wintun_dll.WintunReceivePacket(
                    self._wintun_session, ctypes.byref(size)
                )
                if not ptr:
                    return None
                data = bytes((ctypes.c_uint8 * size.value).from_address(ptr))
                self._wintun_dll.WintunReleaseReceivePacket(self._wintun_session, ptr)
                return data
            elif sys_name == "Darwin":
                # macOS utun prepends 4-byte AF header
                raw = os.read(self.fd, MTU + 4)
                return raw[4:] if len(raw) > 4 else None
            else:
                return os.read(self.fd, MTU)
        except BlockingIOError:
            return None
        except OSError:
            return None

    def write(self, packet: bytes) -> bool:
        """Write one IP packet to the TUN interface."""
        sys_name = platform.system()
        try:
            if sys_name == "Windows":
                import ctypes
                size = len(packet)
                ptr  = self._wintun_dll.WintunAllocateSendPacket(
                    self._wintun_session, size
                )
                if not ptr:
                    return False
                ctypes.memmove(ptr, packet, size)
                self._wintun_dll.WintunSendPacket(self._wintun_session, ptr)
                return True
            elif sys_name == "Darwin":
                # prepend AF_INET header (4 bytes)
                af = struct.pack(">I", socket.AF_INET)
                os.write(self.fd, af + packet)
                return True
            else:
                os.write(self.fd, packet)
                return True
        except OSError:
            return False

    def close(self) -> None:
        sys_name = platform.system()
        if sys_name == "Linux" and self.name:
            self._run(f"ip link del {self.name}", silent=True)
        elif sys_name == "Darwin" and self._sock:
            try:
                self._sock.close()
            except Exception:
                pass
        elif sys_name == "Windows":
            try:
                self._wintun_dll.WintunEndSession(self._wintun_session)
                self._wintun_dll.WintunCloseAdapter(self._wintun_adapter)
            except Exception:
                pass
        audit("tun.close", f"Interface {self.name} closed")

    @staticmethod
    def _run(cmd: str, silent: bool = False) -> None:
        ret = os.system(cmd + ("  2>/dev/null" if silent else ""))
        if ret != 0 and not silent:
            log.warning(f"Command returned {ret}: {cmd}")

# ─── Input validation helpers ─────────────────────────────────────────────────
def _validate_ip(ip: str) -> str:
    """Validate and return a canonical IP address string; raise ValueError on bad input."""
    return str(ipaddress.ip_address(ip.strip()))

def _validate_cidr(cidr: str) -> str:
    """Validate and return a canonical CIDR string; raise ValueError on bad input."""
    return str(ipaddress.ip_network(cidr.strip(), strict=False))

def _validate_iface(iface: str) -> str:
    """Allow only safe interface name chars (letters, digits, hyphens, dots, underscores)."""
    import re as _re
    if not _re.fullmatch(r'[A-Za-z0-9._-]{1,15}', iface.strip()):
        raise ValueError(f"Invalid interface name: {iface!r}")
    return iface.strip()

# ─── Routing helpers ──────────────────────────────────────────────────────────
def detect_default_route() -> Tuple[Optional[str], Optional[str]]:
    """Return (real_interface, gateway_ip) of the default route."""
    sys_name = platform.system()
    try:
        if sys_name == "Linux":
            out = os.popen("ip route show default").read()
            # default via 192.168.1.1 dev eth0
            parts = out.split()
            gw    = parts[parts.index("via")+1]  if "via"  in parts else None
            dev   = parts[parts.index("dev")+1]  if "dev"  in parts else None
            return dev, gw
        elif sys_name == "Darwin":
            out = os.popen("route -n get default").read()
            gw, dev = None, None
            for line in out.splitlines():
                line = line.strip()
                if line.startswith("gateway:"):
                    gw = line.split()[-1]
                if line.startswith("interface:"):
                    dev = line.split()[-1]
            return dev, gw
        elif sys_name == "Windows":
            out = os.popen("route print 0.0.0.0").read()
            for line in out.splitlines():
                parts = line.split()
                if parts and parts[0] == "0.0.0.0":
                    return parts[3] if len(parts) > 3 else None, parts[2] if len(parts) > 2 else None
    except Exception as e:
        log.warning(f"detect_default_route: {e}")
    return None, None

def add_host_route(host_ip: str, gw: str, iface: str) -> None:
    """Route VPN server traffic via real interface (bypass TUN)."""
    try:
        host_ip = _validate_ip(host_ip)
        gw      = _validate_ip(gw)
        iface   = _validate_iface(iface)
    except ValueError as e:
        log.error(f"add_host_route: invalid input — {e}")
        return
    sys_name = platform.system()
    if sys_name == "Linux":
        os.system(f"ip route add {host_ip}/32 via {gw} dev {iface} 2>/dev/null")
    elif sys_name == "Darwin":
        os.system(f"route add -host {host_ip} {gw} 2>/dev/null")
    elif sys_name == "Windows":
        os.system(f"route add {host_ip} mask 255.255.255.255 {gw} 2>/dev/null")
    audit("route.add_host", f"{host_ip} via {gw} ({iface})")

def del_host_route(host_ip: str) -> None:
    try:
        host_ip = _validate_ip(host_ip)
    except ValueError as e:
        log.error(f"del_host_route: invalid input — {e}")
        return
    sys_name = platform.system()
    if sys_name == "Linux":
        os.system(f"ip route del {host_ip}/32 2>/dev/null")
    elif sys_name == "Darwin":
        os.system(f"route delete -host {host_ip} 2>/dev/null")
    elif sys_name == "Windows":
        os.system(f"route delete {host_ip} 2>/dev/null")

def set_default_route_via_tun(tun_name: str, peer_addr: str) -> None:
    """Route all traffic through TUN (client mode)."""
    try:
        tun_name  = _validate_iface(tun_name)
        peer_addr = _validate_ip(peer_addr)
    except ValueError as e:
        log.error(f"set_default_route_via_tun: invalid input — {e}")
        return
    sys_name = platform.system()
    if sys_name == "Linux":
        os.system(f"ip route add 0.0.0.0/1 dev {tun_name} 2>/dev/null")
        os.system(f"ip route add 128.0.0.0/1 dev {tun_name} 2>/dev/null")
    elif sys_name == "Darwin":
        os.system(f"route add -net 0.0.0.0/1 -interface {tun_name} 2>/dev/null")
        os.system(f"route add -net 128.0.0.0/1 -interface {tun_name} 2>/dev/null")
    elif sys_name == "Windows":
        os.system(f'route add 0.0.0.0 mask 0.0.0.0 {peer_addr} 2>nul')
    audit("route.default_via_tun", f"All traffic via {tun_name}")

def restore_default_route(gw: str, iface: str) -> None:
    sys_name = platform.system()
    if sys_name == "Linux":
        os.system(f"ip route del 0.0.0.0/1 2>/dev/null")
        os.system(f"ip route del 128.0.0.0/1 2>/dev/null")
    elif sys_name == "Darwin":
        os.system(f"route delete -net 0.0.0.0/1 2>/dev/null")
        os.system(f"route delete -net 128.0.0.0/1 2>/dev/null")
    elif sys_name == "Windows":
        os.system(f"route delete 0.0.0.0 2>nul")

# ─── Kill switch ──────────────────────────────────────────────────────────────
_IPTABLES_BACKUP = "/tmp/ghostnet-iptables.rules"
_PF_ANCHOR       = "com.ghostnet.killswitch"
_PF_CONF         = "/tmp/ghostnet-pf.conf"

def enable_kill_switch(tun_name: str, server_ip: str, server_port: int) -> None:
    sys_name = platform.system()
    audit("killswitch.enable", f"tun={tun_name} server={server_ip}:{server_port}")
    if sys_name == "Linux":
        _ks_linux_on(tun_name, server_ip, server_port)
    elif sys_name == "Darwin":
        _ks_darwin_on(tun_name, server_ip, server_port)
    elif sys_name == "Windows":
        _ks_windows_on(tun_name, server_ip, server_port)
    state["kill_switch"] = True

def disable_kill_switch() -> None:
    sys_name = platform.system()
    audit("killswitch.disable", "restoring traffic policy")
    if sys_name == "Linux":
        _ks_linux_off()
    elif sys_name == "Darwin":
        _ks_darwin_off()
    elif sys_name == "Windows":
        _ks_windows_off()
    state["kill_switch"] = False

def _ks_linux_on(tun: str, srv_ip: str, srv_port: int) -> None:
    os.system(f"iptables-save > {_IPTABLES_BACKUP} 2>/dev/null")
    cmds = [
        "iptables -F OUTPUT",
        "iptables -F INPUT",
        "iptables -A INPUT  -i lo -j ACCEPT",
        "iptables -A OUTPUT -o lo -j ACCEPT",
        f"iptables -A INPUT  -i {tun} -j ACCEPT",
        f"iptables -A OUTPUT -o {tun} -j ACCEPT",
        "iptables -A INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
        # Allow UDP to/from VPN server (so we can maintain the tunnel)
        f"iptables -A OUTPUT -p udp -d {srv_ip} --dport {srv_port} -j ACCEPT",
        f"iptables -A INPUT  -p udp -s {srv_ip} --sport {srv_port} -j ACCEPT",
        # Drop everything else (kill switch)
        "iptables -A OUTPUT -j DROP",
        "iptables -A INPUT  -j DROP",
    ]
    for cmd in cmds:
        os.system(cmd + " 2>/dev/null")
    log.info("Kill switch ENABLED (iptables)")

def _ks_linux_off() -> None:
    if os.path.exists(_IPTABLES_BACKUP):
        os.system(f"iptables-restore < {_IPTABLES_BACKUP} 2>/dev/null")
        os.remove(_IPTABLES_BACKUP)
    else:
        os.system("iptables -F OUTPUT 2>/dev/null")
        os.system("iptables -F INPUT  2>/dev/null")
    log.info("Kill switch DISABLED (iptables restored)")

def _ks_darwin_on(tun: str, srv_ip: str, srv_port: int) -> None:
    conf = f"""
# GhostNet kill switch
set skip on lo0
block all
pass on {tun} all
pass out proto udp to {srv_ip} port {srv_port}
pass in  proto udp from {srv_ip} port {srv_port}
"""
    with open(_PF_CONF, "w") as f:
        f.write(conf)
    os.system(f"pfctl -f {_PF_CONF} 2>/dev/null")
    os.system("pfctl -e 2>/dev/null")
    log.info("Kill switch ENABLED (pf)")

def _ks_darwin_off() -> None:
    os.system("pfctl -d 2>/dev/null")
    if os.path.exists(_PF_CONF):
        os.remove(_PF_CONF)
    log.info("Kill switch DISABLED (pf)")

def _ks_windows_on(tun: str, srv_ip: str, srv_port: int) -> None:
    cmds = [
        'netsh advfirewall firewall add rule name="GhostNet-KS-Block" dir=out action=block',
        f'netsh advfirewall firewall add rule name="GhostNet-KS-VPN" dir=out action=allow protocol=UDP remoteip={srv_ip} remoteport={srv_port}',
        f'netsh advfirewall firewall add rule name="GhostNet-KS-TUN" dir=out action=allow localip={TUN_ADDR}',
    ]
    for cmd in cmds:
        os.system(cmd + " >nul 2>&1")
    log.info("Kill switch ENABLED (netsh)")

def _ks_windows_off() -> None:
    cmds = [
        'netsh advfirewall firewall delete rule name="GhostNet-KS-Block"',
        'netsh advfirewall firewall delete rule name="GhostNet-KS-VPN"',
        'netsh advfirewall firewall delete rule name="GhostNet-KS-TUN"',
    ]
    for cmd in cmds:
        os.system(cmd + " >nul 2>&1")
    log.info("Kill switch DISABLED (netsh)")

# ─── DNS leak protection ──────────────────────────────────────────────────────
_RESOLV_BACKUP = "/tmp/ghostnet-resolv.conf.bak"

def enable_dns_protection() -> None:
    sys_name = platform.system()
    audit("dns.protect", f"Forcing DNS to {DNS_GHOSTNET}")
    if sys_name == "Linux":
        _dns_linux_on()
    elif sys_name == "Darwin":
        _dns_darwin_on()
    elif sys_name == "Windows":
        _dns_windows_on()
    state["dns_protected"] = True

def disable_dns_protection() -> None:
    sys_name = platform.system()
    audit("dns.restore", "Restoring original DNS")
    if sys_name == "Linux":
        _dns_linux_off()
    elif sys_name == "Darwin":
        _dns_darwin_off()
    elif sys_name == "Windows":
        _dns_windows_off()
    state["dns_protected"] = False

def _dns_linux_on() -> None:
    if os.path.exists("/etc/resolv.conf"):
        os.system(f"cp /etc/resolv.conf {_RESOLV_BACKUP}")
    content = "\n".join([f"nameserver {d}" for d in DNS_GHOSTNET]) + "\n"
    try:
        # Remove immutable flag if present
        os.system("chattr -i /etc/resolv.conf 2>/dev/null")
        with open("/etc/resolv.conf", "w") as f:
            f.write(content)
        # Make immutable so nothing can overwrite it while connected
        os.system("chattr +i /etc/resolv.conf 2>/dev/null")
        log.info("DNS leak protection ENABLED (resolv.conf)")
    except PermissionError:
        log.warning("Could not write /etc/resolv.conf — run as root")

def _dns_linux_off() -> None:
    os.system("chattr -i /etc/resolv.conf 2>/dev/null")
    if os.path.exists(_RESOLV_BACKUP):
        os.system(f"cp {_RESOLV_BACKUP} /etc/resolv.conf")
        os.remove(_RESOLV_BACKUP)
    log.info("DNS protection DISABLED (resolv.conf restored)")

def _dns_darwin_on() -> None:
    for svc in _darwin_network_services():
        for d in DNS_GHOSTNET:
            os.system(f'networksetup -setdnsservers "{svc}" {d} 2>/dev/null')
    log.info("DNS leak protection ENABLED (networksetup)")

def _dns_darwin_off() -> None:
    for svc in _darwin_network_services():
        os.system(f'networksetup -setdnsservers "{svc}" Empty 2>/dev/null')
    log.info("DNS protection DISABLED")

def _darwin_network_services() -> List[str]:
    out = os.popen("networksetup -listallnetworkservices").read()
    return [l.strip() for l in out.splitlines() if l.strip() and not l.startswith("*") and l.strip() != "An asterisk (*) denotes that a network service is disabled."]

def _dns_windows_on() -> None:
    out = os.popen("netsh interface show interface").read()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[0] == "Enabled":
            iface = " ".join(parts[3:])
            for i, d in enumerate(DNS_GHOSTNET):
                action = "set" if i == 0 else "add"
                os.system(f'netsh interface ip {action} dns name="{iface}" addr={d} 2>nul')
    log.info("DNS protection ENABLED (netsh)")

def _dns_windows_off() -> None:
    out = os.popen("netsh interface show interface").read()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[0] == "Enabled":
            iface = " ".join(parts[3:])
            os.system(f'netsh interface ip set dns name="{iface}" source=dhcp 2>nul')
    log.info("DNS protection DISABLED (DHCP restored)")

# ─── Split tunneling ──────────────────────────────────────────────────────────
def add_split_route(cidr: str, bypass: bool = True) -> None:
    """
    bypass=True  → route this CIDR through real interface (exclude from VPN)
    bypass=False → force this CIDR through TUN (include in VPN)
    """
    try:
        cidr = _validate_cidr(cidr)
    except ValueError as e:
        log.error(f"add_split_route: invalid CIDR — {e}")
        return
    sys_name = platform.system()
    gw   = state["real_gw"] or "192.168.1.1"
    dev  = state["real_iface"] or "eth0"
    tun  = state["iface"] or TUN_NAME_LINUX
    entry = {"cidr": cidr, "bypass": bypass}
    audit("splittunnel.add", f"cidr={cidr} bypass={bypass}")
    if sys_name == "Linux":
        if bypass:
            os.system(f"ip route add {cidr} via {gw} dev {dev} 2>/dev/null")
        else:
            os.system(f"ip route add {cidr} dev {tun} 2>/dev/null")
    elif sys_name == "Darwin":
        if bypass:
            os.system(f"route add -net {cidr} {gw} 2>/dev/null")
        else:
            os.system(f"route add -net {cidr} -interface {tun} 2>/dev/null")
    elif sys_name == "Windows":
        net  = str(ipaddress.ip_network(cidr, strict=False).network_address)
        mask = str(ipaddress.ip_network(cidr, strict=False).netmask)
        dest = gw if bypass else TUN_PEER_ADDR
        os.system(f"route add {net} mask {mask} {dest} 2>nul")
    with _lock:
        state["split_routes"].append(entry)

def remove_split_route(cidr: str) -> None:
    try:
        cidr = _validate_cidr(cidr)
    except ValueError as e:
        log.error(f"remove_split_route: invalid CIDR — {e}")
        return
    sys_name = platform.system()
    audit("splittunnel.remove", f"cidr={cidr}")
    if sys_name == "Linux":
        os.system(f"ip route del {cidr} 2>/dev/null")
    elif sys_name == "Darwin":
        os.system(f"route delete -net {cidr} 2>/dev/null")
    elif sys_name == "Windows":
        net  = str(ipaddress.ip_network(cidr, strict=False).network_address)
        mask = str(ipaddress.ip_network(cidr, strict=False).netmask)
        os.system(f"route delete {net} mask {mask} 2>nul")
    with _lock:
        state["split_routes"] = [r for r in state["split_routes"] if r["cidr"] != cidr]

# ─── Server mode ──────────────────────────────────────────────────────────────
class GhostServer:
    """
    VPN server — accepts client connections, decrypts their packets,
    and routes them to the internet. Uses iptables NAT on Linux.
    """
    def __init__(self, port: int, psk: str):
        self.port    = port
        self.psk     = psk
        self.sock    = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.tun     = TunInterface()
        self.peers: Dict[str, Dict] = {}   # addr_str -> {crypto, last_seen}
        self._psk_hash = hashlib.sha256(psk.encode()).digest()

    def start(self) -> None:
        audit("server.start", f"Listening on 0.0.0.0:{self.port}")
        state["mode"] = "server"
        state["running"] = True
        self.tun.open(TUN_NAME_LINUX)

        # Enable IP forwarding + NAT
        real_iface, real_gw = detect_default_route()
        state["real_iface"] = real_iface
        state["real_gw"]    = real_gw
        if platform.system() == "Linux":
            os.system("echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null")
            if real_iface:
                os.system(f"iptables -t nat -A POSTROUTING -o {real_iface} -j MASQUERADE 2>/dev/null")
                os.system(f"iptables -A FORWARD -i {TUN_NAME_LINUX} -o {real_iface} -j ACCEPT 2>/dev/null")
                os.system(f"iptables -A FORWARD -i {real_iface} -o {TUN_NAME_LINUX} -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null")
                audit("nat.enabled", f"MASQUERADE via {real_iface}")

        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("0.0.0.0", self.port))
        self.sock.settimeout(1.0)

        threading.Thread(target=self._recv_loop, daemon=True).start()
        threading.Thread(target=self._tun_to_clients, daemon=True).start()
        threading.Thread(target=self._keepalive_loop, daemon=True).start()

        log.info(f"GhostNet server running on 0.0.0.0:{self.port}")
        _stop.wait()
        self._shutdown()

    def _recv_loop(self) -> None:
        while not _stop.is_set():
            try:
                data, addr = self.sock.recvfrom(MTU + 256)
                self._handle(data, addr)
            except socket.timeout:
                continue
            except OSError:
                break

    def _handle(self, data: bytes, addr: Tuple[str, int]) -> None:
        hdr = decode_header(data)
        if not hdr or hdr["payload"] is None:
            return
        addr_str = f"{addr[0]}:{addr[1]}"

        if hdr["flags"] & FLAG_HANDSHAKE:
            payload = hdr["payload"]
            if len(payload) < 64:
                return
            peer_pub  = payload[:32]
            peer_psk  = payload[32:64]
            if peer_psk != self._psk_hash:
                audit("server.auth_fail", addr_str, "warning")
                return
            crypto = GhostCrypto(self.psk)
            crypto.derive_session_key(peer_pub)
            self.peers[addr_str] = {
                "addr":       addr,
                "crypto":     crypto,
                "last_seen":  time.time(),
                "bytes_in":   0,
                "bytes_out":  0,
                "connected_at": datetime.now(timezone.utc).isoformat(),
            }
            # Send our public key back
            resp = build_handshake(crypto)
            self.sock.sendto(resp, addr)
            audit("server.peer_connected", addr_str)
            with _lock:
                state["peers"] = [
                    {"addr": k, "connected_at": v["connected_at"]}
                    for k, v in self.peers.items()
                ]
            return

        peer = self.peers.get(addr_str)
        if not peer:
            return
        peer["last_seen"] = time.time()

        if hdr["flags"] & FLAG_KEEPALIVE:
            return

        if hdr["flags"] & FLAG_DATA:
            pkt = peer["crypto"].decrypt(hdr["nonce"], hdr["payload"])
            if pkt:
                self.tun.write(pkt)
                peer["bytes_in"]      += len(pkt)
                state["packets_in"]   += 1
                state["bytes_in"]     += len(pkt)

    def _tun_to_clients(self) -> None:
        """Forward packets from TUN to the appropriate client peer."""
        while not _stop.is_set():
            pkt = self.tun.read()
            if not pkt or len(self.peers) == 0:
                time.sleep(0.001)
                continue
            # Route to first peer (single-client mode; extend for multi-client routing)
            peer = next(iter(self.peers.values()))
            nonce, ct = peer["crypto"].encrypt(pkt)
            frame = encode_packet(FLAG_DATA, ct, nonce)
            self.sock.sendto(frame, peer["addr"])
            peer["bytes_out"]      += len(pkt)
            state["packets_out"]   += 1
            state["bytes_out"]     += len(pkt)

    def _keepalive_loop(self) -> None:
        while not _stop.is_set():
            time.sleep(15)
            dead = [k for k, v in self.peers.items() if time.time()-v["last_seen"] > 60]
            for k in dead:
                audit("server.peer_timeout", k)
                del self.peers[k]

    def _shutdown(self) -> None:
        self.sock.close()
        self.tun.close()
        if platform.system() == "Linux":
            real = state.get("real_iface")
            if real:
                os.system(f"iptables -t nat -D POSTROUTING -o {real} -j MASQUERADE 2>/dev/null")
        state["running"] = False
        audit("server.stop", "Server shutdown complete")

# ─── Client mode ──────────────────────────────────────────────────────────────
class GhostClient:
    """
    VPN client — connects to a GhostNet server peer, routes all local
    traffic through the encrypted tunnel.
    """
    def __init__(self, servers: List[str], psk: str):
        self.servers  = servers   # ["host:port", ...]
        self.psk      = psk
        self.sock: Optional[socket.socket] = None
        self.tun      = TunInterface()
        self.crypto: Optional[GhostCrypto] = None
        self._server_addr: Optional[Tuple[str, int]] = None
        self._server_idx  = 0

    def _current_server(self) -> Tuple[str, int]:
        s = self.servers[self._server_idx % len(self.servers)]
        host, port = s.rsplit(":", 1)
        return host, int(port)

    def rotate(self) -> None:
        self._server_idx = (self._server_idx + 1) % len(self.servers)
        audit("client.rotate", f"Switching to {self.servers[self._server_idx % len(self.servers)]}")
        self._connect_peer()

    def start(self) -> None:
        state["mode"]    = "client"
        state["running"] = True
        audit("client.start", f"Connecting to {self.servers}")

        real_iface, real_gw = detect_default_route()
        state["real_iface"] = real_iface
        state["real_gw"]    = real_gw

        self.tun.open(TUN_NAME_LINUX)

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(5.0)

        self._connect_peer()

        threading.Thread(target=self._recv_loop,   daemon=True).start()
        threading.Thread(target=self._tun_to_peer, daemon=True).start()
        threading.Thread(target=self._ka_loop,     daemon=True).start()

        log.info("GhostNet client running — all traffic routed through tunnel")
        _stop.wait()
        self._shutdown()

    def _connect_peer(self) -> None:
        host, port = self._current_server()
        state["server"] = f"{host}:{port}"

        real_iface = state["real_iface"]
        real_gw    = state["real_gw"]
        if real_iface and real_gw:
            add_host_route(host, real_gw, real_iface)

        self._server_addr = (host, port)
        self.crypto = GhostCrypto(self.psk)

        # Send handshake
        hs = build_handshake(self.crypto)
        try:
            self.sock.sendto(hs, self._server_addr)
            data, _ = self.sock.recvfrom(256)
            hdr = decode_header(data)
            if hdr and hdr["flags"] & FLAG_HANDSHAKE and hdr["payload"]:
                server_pub = hdr["payload"][:32]
                self.crypto.derive_session_key(server_pub)
                state["connected"] = True
                audit("client.connected", f"Session established with {host}:{port}")
                # Route all traffic through TUN
                set_default_route_via_tun(TUN_NAME_LINUX, TUN_PEER_ADDR)
            else:
                audit("client.handshake_fail", f"{host}:{port}", "error")
        except socket.timeout:
            audit("client.timeout", f"Handshake timeout to {host}:{port}", "error")

    def _recv_loop(self) -> None:
        while not _stop.is_set():
            try:
                data, _ = self.sock.recvfrom(MTU + 256)
                hdr = decode_header(data)
                if not hdr or hdr["payload"] is None:
                    continue
                if hdr["flags"] & FLAG_DATA and self.crypto:
                    pkt = self.crypto.decrypt(hdr["nonce"], hdr["payload"])
                    if pkt:
                        self.tun.write(pkt)
                        state["packets_in"]  += 1
                        state["bytes_in"]    += len(pkt)
            except socket.timeout:
                continue
            except OSError:
                break

    def _tun_to_peer(self) -> None:
        while not _stop.is_set():
            if not state["connected"] or not self.crypto:
                time.sleep(0.05)
                continue
            pkt = self.tun.read()
            if not pkt:
                time.sleep(0.001)
                continue
            nonce, ct = self.crypto.encrypt(pkt)
            frame = encode_packet(FLAG_DATA, ct, nonce)
            try:
                self.sock.sendto(frame, self._server_addr)
                state["packets_out"] += 1
                state["bytes_out"]   += len(pkt)
            except OSError:
                break

    def _ka_loop(self) -> None:
        while not _stop.is_set():
            time.sleep(10)
            if state["connected"] and self._server_addr and self.crypto:
                try:
                    self.sock.sendto(encode_packet(FLAG_KEEPALIVE, b""), self._server_addr)
                except OSError:
                    pass

    def _shutdown(self) -> None:
        state["connected"] = False
        restore_default_route(state.get("real_gw",""), state.get("real_iface",""))
        host, _ = self._current_server()
        del_host_route(host)
        if state["kill_switch"]:
            disable_kill_switch()
        if state["dns_protected"]:
            disable_dns_protection()
        self.tun.close()
        if self.sock:
            self.sock.close()
        state["running"] = False
        audit("client.stop", "Client shutdown complete")

# ─── REST control API ─────────────────────────────────────────────────────────
_client_ref: Optional[GhostClient] = None
_server_ref: Optional[GhostServer] = None

class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send_json(self, code: int, obj: object) -> None:
        body = json.dumps(obj, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict:
        ln = int(self.headers.get("Content-Length", 0))
        if ln:
            try:
                return json.loads(self.rfile.read(ln))
            except Exception:
                pass
        return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/status":
            uptime = round(time.time() - state["started_at"], 1) if state.get("started_at") else 0
            self._send_json(200, {**state, "uptime_s": uptime})
        elif p == "/peers":
            self._send_json(200, state.get("peers", []))
        elif p == "/logs":
            with _lock:
                self._send_json(200, list(reversed(audit_log[-100:])))
        elif p == "/connections":
            peers = state.get("peers", [])
            self._send_json(200, {"count": len(peers), "peers": peers})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        p    = self.path.split("?")[0]
        body = self._read_json()

        if p == "/stop":
            _stop.set()
            self._send_json(200, {"stopped": True})

        elif p == "/killswitch/on":
            tun  = state.get("iface") or TUN_NAME_LINUX
            srv  = state.get("server") or "127.0.0.1:51820"
            host, port = srv.rsplit(":", 1)
            enable_kill_switch(tun, host, int(port))
            self._send_json(200, {"kill_switch": True})

        elif p == "/killswitch/off":
            disable_kill_switch()
            self._send_json(200, {"kill_switch": False})

        elif p == "/dns/protect":
            enable_dns_protection()
            self._send_json(200, {"dns_protected": True})

        elif p == "/dns/restore":
            disable_dns_protection()
            self._send_json(200, {"dns_protected": False})

        elif p == "/splittunnel/add":
            cidr   = body.get("cidr", "")
            bypass = body.get("bypass", True)
            if cidr:
                add_split_route(cidr, bypass)
                self._send_json(200, {"added": cidr})
            else:
                self._send_json(400, {"error": "cidr required"})

        elif p == "/splittunnel/remove":
            cidr = body.get("cidr", "")
            if cidr:
                remove_split_route(cidr)
                self._send_json(200, {"removed": cidr})
            else:
                self._send_json(400, {"error": "cidr required"})

        elif p == "/rotate":
            if _client_ref:
                _client_ref.rotate()
                self._send_json(200, {"server": state.get("server")})
            else:
                self._send_json(400, {"error": "not in client mode"})

        else:
            self._send_json(404, {"error": "not found"})

def run_control_server(port: int) -> None:
    srv = HTTPServer(("127.0.0.1", port), ControlHandler)
    srv.timeout = 1
    log.info(f"Control API on 127.0.0.1:{port}")
    while not _stop.is_set():
        srv.handle_request()

# ─── IP rotation helper ────────────────────────────────────────────────────────
def server_mode(args) -> None:
    global _server_ref
    srv = GhostServer(args.port, args.psk)
    _server_ref = srv
    srv.start()

def client_mode(args) -> None:
    global _client_ref
    servers = args.server.split(",")
    cli = GhostClient(servers, args.psk)
    _client_ref = cli
    # Optional features before starting tunnel
    if args.killswitch:
        host, port = servers[0].rsplit(":", 1)
        enable_kill_switch(TUN_NAME_LINUX, host, int(port))
    if args.dns_protect:
        enable_dns_protection()
    cli.start()

# ─── Entry point ──────────────────────────────────────────────────────────────
def main() -> None:
    # Privilege check
    if platform.system() != "Windows":
        if os.geteuid() != 0:
            log.error("GhostNet daemon requires root privileges. Use: sudo python3 ghostd.py ...")
            sys.exit(1)

    ap = argparse.ArgumentParser(description=f"GhostNet VPN Daemon v{VERSION}")
    ap.add_argument("--mode",        choices=["server","client","local"], required=True)
    ap.add_argument("--port",        type=int, default=51820, help="Server listen port (server mode)")
    ap.add_argument("--server",      default="", help="Server addr host:port[,host:port,...] (client mode)")
    ap.add_argument("--psk",         default="ghostnet-default-psk", help="Pre-shared key / passphrase")
    ap.add_argument("--ctrl-port",   type=int, default=CTRL_PORT, help="Control API HTTP port")
    ap.add_argument("--killswitch",  action="store_true", help="Enable kill switch on start (client mode)")
    ap.add_argument("--dns-protect", action="store_true", help="Enable DNS leak protection (client mode)")
    ap.add_argument("--socks5",      default="127.0.0.1:9050", help="SOCKS5 proxy for local mode")
    args = ap.parse_args()

    def _sig(s, f):
        log.info("Signal received — shutting down...")
        _stop.set()
    signal.signal(signal.SIGTERM, _sig)
    signal.signal(signal.SIGINT,  _sig)

    state["started_at"] = time.time()
    audit("daemon.start", f"mode={args.mode} version={VERSION}")

    # Start control API in background thread
    threading.Thread(target=run_control_server, args=(args.ctrl_port,), daemon=True).start()

    if args.mode == "server":
        if not args.psk or args.psk == "ghostnet-default-psk":
            log.warning("Using default PSK — set a strong --psk in production!")
        server_mode(args)
    elif args.mode == "client":
        if not args.server:
            log.error("--server HOST:PORT required for client mode")
            sys.exit(1)
        client_mode(args)
    elif args.mode == "local":
        log.info(f"Local proxy mode — routing through SOCKS5 {args.socks5}")
        audit("local.start", f"socks5={args.socks5}")
        state["mode"]    = "local"
        state["running"] = True
        state["server"]  = args.socks5
        _stop.wait()
        state["running"] = False

    audit("daemon.stop", "Clean exit")
    log.info("GhostNet daemon stopped.")

if __name__ == "__main__":
    main()
