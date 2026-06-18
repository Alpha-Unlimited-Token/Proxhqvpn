// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// WireGuard Deception Layer — config management + server script generation.
//
// Architecture:
//   Real WireGuard  →  hidden port (e.g. 51280) — only known IPs allowed
//   Decoy port      →  well-known 51820 — nftables/iptables redirect to Ghost Daemon
//   Ghost Daemon    →  UDP process that mimics WG handshake responses + loop-traps scanners
//   Ghost Trap API  →  every probe logged, enriched, fed to SIEM

import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db } from "@workspace/db";
import { wgDeceptionConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRbac } from "../middlewares/requireRbac";
import { appendAuditEvent } from "../lib/audit-chain";

const router = Router();

function uid(req: Request): string {
  return (getAuth(req) as any).userId ?? "";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getOrCreateCfg(userId: string) {
  const [existing] = await db.select().from(wgDeceptionConfigTable)
    .where(eq(wgDeceptionConfigTable.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(wgDeceptionConfigTable)
    .values({ userId }).returning();
  return created!;
}

const ConfigSchema = z.object({
  realWgPort:          z.number().int().min(1024).max(65535).optional(),
  decoyPort:           z.number().int().min(1024).max(65535).optional(),
  ghostDaemonPort:     z.number().int().min(1024).max(65535).optional(),
  wgInterface:         z.string().min(2).max(20).optional(),
  firewallBackend:     z.enum(["nftables", "iptables"]).optional(),
  useNetns:            z.boolean().optional(),
  loopCount:           z.number().int().min(1).max(50).optional(),
  tarpitMs:            z.number().int().min(0).max(30000).optional(),
  apiCallbackUrl:      z.string().url().optional(),
  callbackPskHint:     z.string().max(200).optional(),
  ghostNodeId:         z.number().int().positive().optional(),
  authorizedPeerCidrs: z.array(z.string()).optional(),
  enabled:             z.boolean().optional(),
});

// ── GET /api/wg-deception/config ───────────────────────────────────────────────
router.get("/config", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const cfg = await getOrCreateCfg(userId);
  return res.json({ config: cfg });
});

// ── POST /api/wg-deception/config ─────────────────────────────────────────────
router.post("/config", requireRbac("ghost_node_admin"), async (req: Request, res: Response) => {
  const userId = uid(req);
  const parsed = ConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const cfg = await getOrCreateCfg(userId);
  const [updated] = await db.update(wgDeceptionConfigTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(wgDeceptionConfigTable.id, cfg.id))
    .returning();
  appendAuditEvent({ actor: userId, action: "wg_deception.config_update", resource: `wg_deception:${cfg.id}`, metadata: parsed.data });
  return res.json({ ok: true, config: updated });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ghost WireGuard Daemon (Python) ───────────────────────────────────────────
//
// This is a UDP listener that impersonates a WireGuard server on the DECOY port.
// When a scanner sends a WireGuard handshake initiation, the daemon:
//   1. Parses the WG Type-1 message and extracts the scanner's session index
//   2. Sends back a valid-structured (but cryptographically garbage) Type-2 response
//   3. Enters a loop: sends fake Transport Data (Type-4) packets to keep them
//      engaged and waste their time / burn their retry budget
//   4. Reports every probe to the ProxhqVPN Ghost Node API
//
// WireGuard message types (RFC-like spec):
//   Type 1 — Handshake Initiation (148 bytes)
//   Type 2 — Handshake Response   (92 bytes)
//   Type 3 — Cookie Reply          (64 bytes)
//   Type 4 — Transport Data        (header 32 bytes + encrypted payload)
//
function generateGhostDaemon(cfg: {
  ghostDaemonPort: number;
  decoyPort: number;
  realWgPort: number;
  loopCount: number;
  tarpitMs: number;
  apiCallbackUrl?: string | null;
  ghostNodeId?: number | null;
}): string {
  const apiBase = cfg.apiCallbackUrl ?? "https://your-proxhqvpn-domain.com";
  const nodeId  = cfg.ghostNodeId ?? 0;

  return `#!/usr/bin/env python3
# ============================================================
# ProxhqVPN Ghost WireGuard Daemon
# © 2026 Alpha Unlimited Technologies LLC
#
# PURPOSE:
#   Listens on UDP port ${cfg.ghostDaemonPort} (nftables redirects ${cfg.decoyPort} here).
#   Mimics a real WireGuard server to trap and log port scanners.
#   Responds with structurally valid but cryptographically fake WG messages,
#   keeping scanners in a tarpit loop while logging all activity.
#
# DEPLOYMENT:
#   1. Run deploy-wg-deception.sh to configure nftables and install this daemon.
#   2. Set HONEYPOT_PSK env var to your ProxhqVPN HONEYPOT_PSK secret.
#   3. systemd unit: ghost-wg-daemon.service
#
# ISOLATION:
#   Runs in a dedicated network namespace (ghost_ns) so it has ZERO access to
#   real WireGuard tunnels or production network routes.
# ============================================================

import socket
import struct
import os
import sys
import time
import threading
import signal
import logging
import json
import urllib.request
import urllib.error
from collections import defaultdict

# ── Configuration ─────────────────────────────────────────────────────────────
LISTEN_PORT       = int(os.environ.get("GHOST_LISTEN_PORT", "${cfg.ghostDaemonPort}"))
DECOY_PORT        = ${cfg.decoyPort}   # port scanners targeted (for logging only)
REAL_WG_PORT      = ${cfg.realWgPort}  # actual WireGuard port (never exposed here)
LOOP_COUNT        = int(os.environ.get("GHOST_LOOP_COUNT",  "${cfg.loopCount}"))
TARPIT_MS         = int(os.environ.get("GHOST_TARPIT_MS",  "${cfg.tarpitMs}"))  # ms per loop step
API_BASE          = os.environ.get("GHOST_API_BASE", "${apiBase}")
API_PSK           = os.environ.get("HONEYPOT_PSK",   "")
GHOST_NODE_ID     = int(os.environ.get("GHOST_NODE_ID",    "${nodeId}"))
LOG_LEVEL         = os.environ.get("GHOST_LOG_LEVEL", "INFO")

logging.basicConfig(
    level    = getattr(logging, LOG_LEVEL, logging.INFO),
    format   = "[%(asctime)s] %(levelname)s %(message)s",
    datefmt  = "%Y-%m-%dT%H:%M:%S",
    stream   = sys.stdout,
)
log = logging.getLogger("ghost-wg")

# ── Per-IP rate limiter (max 20 sessions/IP/60s) ──────────────────────────────
_ip_bucket: dict = defaultdict(lambda: {"count": 0, "reset": 0.0})
IP_RATE_LIMIT  = 20
IP_RATE_WIN_S  = 60.0

def check_rate(ip: str) -> bool:
    now = time.time()
    b   = _ip_bucket[ip]
    if now > b["reset"]:
        b["count"] = 0
        b["reset"]  = now + IP_RATE_WIN_S
    b["count"] += 1
    return b["count"] <= IP_RATE_LIMIT

# ── WireGuard message constants ───────────────────────────────────────────────
WG_TYPE_HANDSHAKE_INIT     = 0x01
WG_TYPE_HANDSHAKE_RESPONSE = 0x02
WG_TYPE_TRANSPORT_DATA     = 0x04
WG_INIT_SIZE               = 148
WG_RESPONSE_SIZE           = 92
WG_TRANSPORT_HDR_SIZE      = 32  # header before encrypted payload

# ── Parse handshake initiation ────────────────────────────────────────────────
def parse_init(data: bytes) -> dict | None:
    """Parse WireGuard Handshake Initiation (Type 1, 148 bytes)."""
    if len(data) < WG_INIT_SIZE:
        return None
    msg_type = data[0]
    if msg_type != WG_TYPE_HANDSHAKE_INIT:
        return None
    sender_index = struct.unpack_from("<I", data, 4)[0]
    eph_pubkey   = data[8:40]       # 32 bytes — initiator's ephemeral public key
    enc_static   = data[40:88]      # 48 bytes — encrypted static pubkey
    enc_ts       = data[88:116]     # 28 bytes — encrypted timestamp
    mac1         = data[116:132]    # 16 bytes
    return {
        "type":         "handshake_init",
        "sender_index": sender_index,
        "eph_pubkey":   eph_pubkey.hex(),
        "mac1":         mac1.hex(),
    }

# ── Build fake handshake response ─────────────────────────────────────────────
def build_fake_response(initiator_sender_index: int) -> bytes:
    """
    Build a structurally valid WireGuard Handshake Response (Type 2, 92 bytes).
    The ephemeral key and all encrypted fields are random garbage — the DH will
    fail on the attacker's side, but not before their client spends CPU time
    trying to process our response and sending follow-up packets.
    """
    fake_sender_index = int.from_bytes(os.urandom(4), "little")
    fake_eph_pubkey   = os.urandom(32)   # fake Curve25519 point
    enc_nothing       = os.urandom(16)   # AEAD( empty msg ) — fake
    mac1              = os.urandom(16)
    mac2              = os.urandom(16)

    msg = struct.pack(
        "<B3sII",
        WG_TYPE_HANDSHAKE_RESPONSE,
        b"\\x00\\x00\\x00",           # reserved
        fake_sender_index,
        initiator_sender_index,
    )
    msg += fake_eph_pubkey   # 32 bytes
    msg += enc_nothing       # 16 bytes
    msg += mac1              # 16 bytes
    msg += mac2              # 16 bytes
    # Total: 1+3+4+4+32+16+16+16 = 92 bytes ✓
    return msg

# ── Build fake transport data packet ─────────────────────────────────────────
def build_fake_transport(receiver_index: int, counter: int) -> bytes:
    """
    Build a fake WireGuard Transport Data packet (Type 4).
    Looks like an encrypted keepalive / ICMP ping from a real peer.
    """
    enc_payload = os.urandom(32)  # fake encrypted keepalive (32 bytes min)
    return struct.pack(
        "<B3sIQ",
        WG_TYPE_TRANSPORT_DATA,
        b"\\x00\\x00\\x00",
        receiver_index,
        counter,
    ) + enc_payload

# ── API callback — report probe to ProxhqVPN ─────────────────────────────────
def report_probe(ip: str, port: int, event_type: str, raw_hex: str = "") -> None:
    if not API_BASE or not GHOST_NODE_ID:
        return
    payload = json.dumps({
        "eventType":  event_type,
        "sourceIp":   ip,
        "sourcePort": port,
        "rawPayload": raw_hex[:200] if raw_hex else "",
        "severity":   "high" if event_type == "wireguard_handshake_init" else "warn",
    }).encode()
    url = f"{API_BASE}/api/ghost-nodes/{GHOST_NODE_ID}/event"
    try:
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Content-Type",  "application/json")
        req.add_header("X-Honeypot-PSK", API_PSK)
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        log.debug("[report_probe] API callback failed: %s", e)

# ── Handle a single scanner session in a thread ───────────────────────────────
def handle_session(sock: socket.socket, data: bytes, addr: tuple) -> None:
    ip, port = addr[0], addr[1]
    log.info("[session] probe from %s:%d  len=%d", ip, port, len(data))

    if not check_rate(ip):
        log.debug("[session] rate-limited %s", ip)
        return

    parsed = parse_init(data)

    if parsed:
        # It's a genuine WireGuard handshake initiation
        log.warning("[wg-init] WireGuard handshake init from %s:%d  idx=%d  eph=%s",
                    ip, port, parsed["sender_index"], parsed["eph_pubkey"][:16] + "…")

        # Step 1: Send the fake handshake response immediately
        response = build_fake_response(parsed["sender_index"])
        try:
            sock.sendto(response, addr)
            log.info("[wg-resp] Sent fake handshake response to %s:%d (%d bytes)", ip, port, len(response))
        except OSError as e:
            log.error("[wg-resp] Send failed: %s", e)
            return

        # Step 2: Report to ProxhqVPN in background
        threading.Thread(
            target=report_probe,
            args=(ip, port, "wireguard_handshake_init", data[:80].hex()),
            daemon=True,
        ).start()

        # Step 3: Tarpit loop — send fake transport data to waste their retry budget
        for i in range(LOOP_COUNT):
            time.sleep(TARPIT_MS / 1000.0)
            fake_pkt = build_fake_transport(parsed["sender_index"], i + 1)
            try:
                sock.sendto(fake_pkt, addr)
                log.debug("[loop %d/%d] Sent fake transport to %s", i+1, LOOP_COUNT, ip)
            except OSError:
                break

        # Step 4: Report loop completion
        threading.Thread(
            target=report_probe,
            args=(ip, port, "data_packet_after_fake_handshake", ""),
            daemon=True,
        ).start()

        log.info("[done] Trap loop completed for %s:%d (%d iterations)", ip, port, LOOP_COUNT)

    else:
        # Unknown / scanner / fuzzer probe — log and ignore
        log.info("[unknown] Non-WG probe from %s:%d  type=0x%02x  len=%d",
                 ip, port, data[0] if data else 0, len(data))
        threading.Thread(
            target=report_probe,
            args=(ip, port, "unknown_udp_probe", data[:40].hex()),
            daemon=True,
        ).start()

# ── Main listener loop ────────────────────────────────────────────────────────
def main() -> None:
    log.info("=" * 60)
    log.info("ProxhqVPN Ghost WireGuard Daemon starting")
    log.info("  Bind port  : %d  (nftables redirects %d → here)", LISTEN_PORT, DECOY_PORT)
    log.info("  Real WG    : %d  (protected, not exposed)", REAL_WG_PORT)
    log.info("  Loop count : %d  ×  %dms tarpit", LOOP_COUNT, TARPIT_MS)
    log.info("  API base   : %s  (node %d)", API_BASE, GHOST_NODE_ID)
    log.info("=" * 60)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
    sock.bind(("0.0.0.0", LISTEN_PORT))
    log.info("Listening on 0.0.0.0:%d", LISTEN_PORT)

    def _shutdown(sig, _frame):
        log.info("Shutting down (signal %d)", sig)
        sock.close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    while True:
        try:
            data, addr = sock.recvfrom(4096)
            t = threading.Thread(target=handle_session, args=(sock, data, addr), daemon=True)
            t.start()
        except OSError:
            break

if __name__ == "__main__":
    main()
`;
}

// ── nftables configuration ────────────────────────────────────────────────────
function generateNftables(cfg: {
  realWgPort: number;
  decoyPort: number;
  ghostDaemonPort: number;
  wgInterface: string;
  authorizedPeerCidrs?: unknown;
}): string {
  const peers = (Array.isArray(cfg.authorizedPeerCidrs) ? cfg.authorizedPeerCidrs : []) as string[];
  const peerSet = peers.length > 0
    ? peers.map(c => `        ${c}`).join(",\n")
    : "        # No authorized peers configured — add IPs/CIDRs here\n        # 1.2.3.4/32,\n        # 10.0.0.0/8";

  return `#!/usr/sbin/nft -f
# ============================================================
# ProxhqVPN Ghost Trap — nftables Configuration
# © 2026 Alpha Unlimited Technologies LLC
#
# Architecture:
#   ${cfg.decoyPort}/udp  → redirect to ghost daemon on ${cfg.ghostDaemonPort}
#   ${cfg.realWgPort}/udp → real WireGuard (authorized IPs only)
#   All other WG-like UDP → logged + dropped
#
# Apply:  nft -f /etc/proxhq/nftables-ghost-trap.nft
# Remove: nft delete table inet proxhq_ghost
# Status: nft list table inet proxhq_ghost
# ============================================================

# Flush any existing ProxhqVPN ghost table first
table inet proxhq_ghost {}
delete table inet proxhq_ghost

table inet proxhq_ghost {

    # ── Authorized WireGuard peer addresses ───────────────────────────────────
    # Only these IPs/CIDRs are allowed to reach the real WireGuard port.
    # All other traffic hitting the real port is silently dropped.
    set authorized_peers {
        type ipv4_addr
        flags interval
        elements = {
${peerSet}
        }
    }

    # ── Ghost trap session tracking ───────────────────────────────────────────
    # Track attacker IPs that have already been routed into the ghost daemon.
    # Used for logging and NeuralFence integration.
    set ghost_sessions {
        type ipv4_addr
        flags dynamic, timeout
        timeout 5m
        size 65536
    }

    # ── Prerouting: redirect decoy port to ghost daemon ───────────────────────
    chain ghost_prerouting {
        type nat hook prerouting priority dstnat; policy accept;

        # IPv6: redirect decoy port to ghost daemon
        meta nfproto ipv6 udp dport ${cfg.decoyPort} redirect to :${cfg.ghostDaemonPort}

        # IPv4: redirect decoy port (51820 — well-known WG port) to ghost daemon
        # This is what port scanners and automated attack bots target.
        # The ghost daemon replies with a fake WireGuard handshake to trap them.
        udp dport ${cfg.decoyPort} redirect to :${cfg.ghostDaemonPort}
    }

    # ── Input: protect the real WireGuard port ────────────────────────────────
    chain ghost_input {
        type filter hook input priority filter; policy accept;

        # Allow legitimate WireGuard traffic on the real hidden port
        # from authorized peers ONLY
        udp dport ${cfg.realWgPort} ip saddr @authorized_peers counter accept

        # Block anything else hitting the real WireGuard port
        # Log it first so NeuralFence/SIEM picks it up
        udp dport ${cfg.realWgPort} \\
            log prefix "PROXHQ_WG_PROBE: " \\
            level warn \\
            counter \\
            drop

        # Track IPs that hit the ghost daemon (via the redirected decoy port)
        # Rate-limit new ghost sessions to prevent flooding
        udp dport ${cfg.ghostDaemonPort} \\
            add @ghost_sessions { ip saddr timeout 5m } \\
            limit rate 30/minute burst 60 packets \\
            counter \\
            accept

        # Drop excess sessions from the same IP (flood protection)
        udp dport ${cfg.ghostDaemonPort} drop
    }

    # ── Output: block ghost daemon from making outbound connections ───────────
    # Critical: the ghost daemon MUST NOT be able to initiate outbound traffic.
    # This prevents an attacker from using the daemon as a relay.
    chain ghost_output {
        type filter hook output priority filter; policy accept;

        # The ghost daemon runs as user 'proxhq-ghost' (UID set in systemd unit)
        # Block all outbound TCP/UDP except to the ProxhqVPN API callback URL
        # Adjust the meta skuid to match your deployment UID
        meta skuid "proxhq-ghost" tcp dport != { 443, 80 } drop
        meta skuid "proxhq-ghost" udp dport != ${cfg.ghostDaemonPort} drop
    }
}

# ── Persist across reboots ────────────────────────────────────────────────────
# Add to /etc/nftables.conf:
#   include "/etc/proxhq/nftables-ghost-trap.nft"
#
# Then enable: systemctl enable --now nftables
`;
}

// ── iptables fallback ──────────────────────────────────────────────────────────
function generateIptables(cfg: {
  realWgPort: number;
  decoyPort: number;
  ghostDaemonPort: number;
  authorizedPeerCidrs?: unknown;
}): string {
  const peers = (Array.isArray(cfg.authorizedPeerCidrs) ? cfg.authorizedPeerCidrs : []) as string[];
  const authorizedRules = peers.length > 0
    ? peers.map(c => `-A PROXHQ_WG -s ${c} -p udp --dport ${cfg.realWgPort} -j ACCEPT`).join("\n")
    : `# No authorized peers — add rules like:
# -A PROXHQ_WG -s 1.2.3.4/32 -p udp --dport ${cfg.realWgPort} -j ACCEPT`;

  return `#!/usr/bin/env bash
# ============================================================
# ProxhqVPN Ghost Trap — iptables Configuration
# © 2026 Alpha Unlimited Technologies LLC
#
# Use this script if your server uses iptables instead of nftables.
# For most Ubuntu 22.04+ / Debian 12+ servers, prefer nftables.
#
# Apply:  bash iptables-ghost-trap.sh apply
# Remove: bash iptables-ghost-trap.sh remove
# ============================================================
set -euo pipefail

DECOY_PORT=${cfg.decoyPort}
REAL_WG_PORT=${cfg.realWgPort}
GHOST_PORT=${cfg.ghostDaemonPort}

apply() {
    echo "[ProxhqVPN] Applying iptables ghost trap rules..."

    # Create custom chains
    iptables -N PROXHQ_WG    2>/dev/null || iptables -F PROXHQ_WG
    iptables -N PROXHQ_GHOST 2>/dev/null || iptables -F PROXHQ_GHOST
    ip6tables -N PROXHQ_WG   2>/dev/null || ip6tables -F PROXHQ_WG
    ip6tables -N PROXHQ_GHOST 2>/dev/null || ip6tables -F PROXHQ_GHOST

    # ── PREROUTING: redirect decoy port → ghost daemon ────────────────────────
    # Remove any existing redirect rules first
    iptables  -t nat -D PREROUTING -p udp --dport "$DECOY_PORT" -j REDIRECT --to-port "$GHOST_PORT" 2>/dev/null || true
    ip6tables -t nat -D PREROUTING -p udp --dport "$DECOY_PORT" -j REDIRECT --to-port "$GHOST_PORT" 2>/dev/null || true

    iptables  -t nat -A PREROUTING -p udp --dport "$DECOY_PORT" -j REDIRECT --to-port "$GHOST_PORT"
    ip6tables -t nat -A PREROUTING -p udp --dport "$DECOY_PORT" -j REDIRECT --to-port "$GHOST_PORT"
    echo "  [✓] Decoy port \$DECOY_PORT → ghost daemon \$GHOST_PORT (IPv4+IPv6)"

    # ── INPUT: protect real WireGuard port ────────────────────────────────────
    # Authorized peers (add your peer IPs here)
    ${authorizedRules}

    # Log and drop everything else hitting the real WG port
    -A PROXHQ_WG -p udp --dport "$REAL_WG_PORT" -j LOG --log-prefix "PROXHQ_WG_PROBE: " --log-level 4
    -A PROXHQ_WG -p udp --dport "$REAL_WG_PORT" -j DROP

    # Hook into INPUT chain
    iptables  -D INPUT -j PROXHQ_WG 2>/dev/null || true
    iptables  -A INPUT -j PROXHQ_WG
    ip6tables -D INPUT -j PROXHQ_WG 2>/dev/null || true
    ip6tables -A INPUT -j PROXHQ_WG
    echo "  [✓] Real WG port \$REAL_WG_PORT protected"

    # ── Ghost daemon flood protection ─────────────────────────────────────────
    -A PROXHQ_GHOST -p udp --dport "$GHOST_PORT" -m hashlimit \\
        --hashlimit-mode srcip --hashlimit-name ghost_flood \\
        --hashlimit-above 30/min --hashlimit-burst 60 -j DROP
    -A PROXHQ_GHOST -p udp --dport "$GHOST_PORT" -j ACCEPT

    iptables  -D INPUT -j PROXHQ_GHOST 2>/dev/null || true
    iptables  -A INPUT -j PROXHQ_GHOST
    echo "  [✓] Ghost daemon flood protection enabled"

    # ── Save rules ────────────────────────────────────────────────────────────
    if command -v iptables-save >/dev/null; then
        iptables-save  > /etc/iptables/rules.v4 2>/dev/null || true
        ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
        echo "  [✓] Rules saved"
    fi

    echo "[ProxhqVPN] Ghost trap iptables rules applied successfully."
}

remove() {
    echo "[ProxhqVPN] Removing iptables ghost trap rules..."
    iptables  -t nat -D PREROUTING -p udp --dport "$DECOY_PORT" -j REDIRECT --to-port "$GHOST_PORT" 2>/dev/null || true
    ip6tables -t nat -D PREROUTING -p udp --dport "$DECOY_PORT" -j REDIRECT --to-port "$GHOST_PORT" 2>/dev/null || true
    iptables  -D INPUT -j PROXHQ_WG    2>/dev/null || true
    iptables  -D INPUT -j PROXHQ_GHOST 2>/dev/null || true
    iptables  -F PROXHQ_WG    2>/dev/null || true
    iptables  -F PROXHQ_GHOST 2>/dev/null || true
    iptables  -X PROXHQ_WG    2>/dev/null || true
    iptables  -X PROXHQ_GHOST 2>/dev/null || true
    ip6tables -D INPUT -j PROXHQ_WG    2>/dev/null || true
    ip6tables -D INPUT -j PROXHQ_GHOST 2>/dev/null || true
    ip6tables -F PROXHQ_WG    2>/dev/null || true
    ip6tables -F PROXHQ_GHOST 2>/dev/null || true
    ip6tables -X PROXHQ_WG    2>/dev/null || true
    ip6tables -X PROXHQ_GHOST 2>/dev/null || true
    echo "[ProxhqVPN] Ghost trap rules removed."
}

case "\${1:-apply}" in
    apply)  apply  ;;
    remove) remove ;;
    *)      echo "Usage: $0 [apply|remove]"; exit 1 ;;
esac
`;
}

// ── WireGuard port migration script ───────────────────────────────────────────
function generateMigrationScript(cfg: {
  realWgPort: number;
  decoyPort: number;
  ghostDaemonPort: number;
  wgInterface: string;
}): string {
  return `#!/usr/bin/env bash
# ============================================================
# ProxhqVPN — WireGuard Port Migration Script
# © 2026 Alpha Unlimited Technologies LLC
#
# Migrates WireGuard from the well-known port (${cfg.decoyPort}) to the
# hidden port (${cfg.realWgPort}), then deploys the Ghost WireGuard Daemon
# on ${cfg.ghostDaemonPort} to trap scanners on the old port.
#
# BEFORE RUNNING:
#   1. Ensure all peers have updated their Endpoint to the new port.
#   2. Run this script on the SERVER first, then update each peer's config.
#   3. Keep the firewall rules permissive until all peers reconnect.
#
# Usage:
#   bash wireguard-migrate-port.sh          # interactive mode
#   bash wireguard-migrate-port.sh --force  # skip confirmation
# ============================================================
set -euo pipefail

IFACE="${cfg.wgInterface}"
OLD_PORT=${cfg.decoyPort}
NEW_PORT=${cfg.realWgPort}
GHOST_PORT=${cfg.ghostDaemonPort}
WG_CONF="/etc/wireguard/\${IFACE}.conf"

RED='\\e[31m'; GREEN='\\e[32m'; YELLOW='\\e[33m'; CYAN='\\e[36m'; RESET='\\e[0m'
info()    { echo -e "\${CYAN}[INFO]\${RESET}  \$*"; }
success() { echo -e "\${GREEN}[OK]\${RESET}    \$*"; }
warn()    { echo -e "\${YELLOW}[WARN]\${RESET}  \$*"; }
error()   { echo -e "\${RED}[ERROR]\${RESET} \$*" >&2; }

# ── Preflight checks ──────────────────────────────────────────────────────────
[[ \$EUID -eq 0 ]] || { error "Run as root (sudo)"; exit 1; }
command -v wg       >/dev/null || { error "wg not found — install wireguard-tools"; exit 1; }
command -v wg-quick >/dev/null || { error "wg-quick not found"; exit 1; }
[[ -f "\$WG_CONF" ]] || { error "WireGuard config not found: \$WG_CONF"; exit 1; }

echo ""
echo -e "\${CYAN}╔══════════════════════════════════════════════════════════╗"
echo -e "║        ProxhqVPN WireGuard Port Migration              ║"
echo -e "╚══════════════════════════════════════════════════════════╝\${RESET}"
echo ""
info "Interface  : \$IFACE"
info "Old port   : \$OLD_PORT  (becomes the ghost trap decoy)"
info "New port   : \$NEW_PORT  (real, hidden WireGuard port)"
info "Ghost port : \$GHOST_PORT (ghost daemon internal listener)"
echo ""

if [[ "\${1:-}" != "--force" ]]; then
    warn "IMPORTANT: Update all peer configs to Endpoint port \$NEW_PORT before proceeding."
    warn "Peers still using port \$OLD_PORT will be disconnected until they update."
    echo ""
    read -r -p "Continue? [y/N] " CONFIRM
    [[ "\$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# ── Step 1: Backup current config ─────────────────────────────────────────────
BACKUP="/etc/wireguard/\${IFACE}.conf.bak-pre-migration-\$(date +%Y%m%d%H%M%S)"
cp "\$WG_CONF" "\$BACKUP"
success "Config backed up → \$BACKUP"

# ── Step 2: Update ListenPort in config ───────────────────────────────────────
if grep -q "^ListenPort" "\$WG_CONF"; then
    sed -i "s/^ListenPort\\s*=.*/ListenPort = \$NEW_PORT/" "\$WG_CONF"
    success "Updated ListenPort: \$OLD_PORT → \$NEW_PORT"
else
    # Insert ListenPort after the [Interface] line
    sed -i "/^\\[Interface\\]/a ListenPort = \$NEW_PORT" "\$WG_CONF"
    success "Inserted ListenPort = \$NEW_PORT"
fi

# ── Step 3: Hot-reload WireGuard with the new port ────────────────────────────
# wg set does a live port change without dropping tunnel state
if wg show "\$IFACE" >/dev/null 2>&1; then
    info "Applying live port change (no tunnel disruption)..."
    wg set "\$IFACE" listen-port "\$NEW_PORT"
    success "WireGuard now listening on port \$NEW_PORT (live, no restart)"
else
    warn "Interface \$IFACE not up — restarting with wg-quick"
    wg-quick down "\$IFACE" 2>/dev/null || true
    wg-quick up   "\$IFACE"
    success "WireGuard restarted on port \$NEW_PORT"
fi

# ── Step 4: Verify ────────────────────────────────────────────────────────────
ACTUAL_PORT=\$(wg show "\$IFACE" listen-port 2>/dev/null || echo "unknown")
if [[ "\$ACTUAL_PORT" == "\$NEW_PORT" ]]; then
    success "Verified: WireGuard listening on \$ACTUAL_PORT"
else
    error "Port mismatch — expected \$NEW_PORT, got \$ACTUAL_PORT"
    warn "Restoring backup..."
    cp "\$BACKUP" "\$WG_CONF"
    wg-quick down "\$IFACE" 2>/dev/null || true
    wg-quick up   "\$IFACE"
    exit 1
fi

# ── Step 5: Update firewall ───────────────────────────────────────────────────
info "Applying nftables ghost trap rules..."
if command -v nft >/dev/null; then
    if [[ -f /etc/proxhq/nftables-ghost-trap.nft ]]; then
        nft -f /etc/proxhq/nftables-ghost-trap.nft
        success "nftables ghost trap rules applied"
    else
        warn "nftables-ghost-trap.nft not found at /etc/proxhq/ — copy it there first"
        warn "Then run: nft -f /etc/proxhq/nftables-ghost-trap.nft"
    fi
elif command -v iptables >/dev/null; then
    if [[ -f /etc/proxhq/iptables-ghost-trap.sh ]]; then
        bash /etc/proxhq/iptables-ghost-trap.sh apply
        success "iptables ghost trap rules applied"
    else
        warn "iptables-ghost-trap.sh not found at /etc/proxhq/"
    fi
fi

# ── Step 6: Install and start ghost daemon ────────────────────────────────────
info "Installing ghost WireGuard daemon..."

# Create dedicated user for isolation
if ! id proxhq-ghost >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /sbin/nologin proxhq-ghost
    success "Created user: proxhq-ghost"
fi

# Install Python script
mkdir -p /opt/proxhq-ghost
cp /etc/proxhq/ghost-wg-daemon.py /opt/proxhq-ghost/
chown -R proxhq-ghost:proxhq-ghost /opt/proxhq-ghost/
chmod +x /opt/proxhq-ghost/ghost-wg-daemon.py
success "Ghost daemon installed → /opt/proxhq-ghost/ghost-wg-daemon.py"

# Install systemd unit
if [[ -f /etc/proxhq/ghost-wg-daemon.service ]]; then
    cp /etc/proxhq/ghost-wg-daemon.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable  ghost-wg-daemon
    systemctl restart ghost-wg-daemon
    sleep 2
    if systemctl is-active --quiet ghost-wg-daemon; then
        success "ghost-wg-daemon service is running"
    else
        error "ghost-wg-daemon failed to start — check: journalctl -u ghost-wg-daemon"
    fi
else
    warn "ghost-wg-daemon.service not found — install and start it manually"
fi

echo ""
echo -e "\${GREEN}═══════════════════════════════════════════════════════════"
echo -e "  Migration complete!"
echo -e "\${RESET}"
info "Real WireGuard port : \$NEW_PORT  (tell your peers to update)"
info "Decoy port          : \$OLD_PORT  (scanners now trapped here)"
info "Ghost daemon port   : \$GHOST_PORT (internal redirect target)"
echo ""
warn "ACTION REQUIRED: Update all peer configs:"
warn "  Change: Endpoint = <server-ip>:\$OLD_PORT"
warn "      To: Endpoint = <server-ip>:\$NEW_PORT"
echo ""
`;
}

// ── systemd service unit ───────────────────────────────────────────────────────
function generateSystemdUnit(cfg: {
  ghostDaemonPort: number;
  decoyPort: number;
  loopCount: number;
  tarpitMs: number;
  apiCallbackUrl?: string | null;
  ghostNodeId?: number | null;
}): string {
  return `[Unit]
Description=ProxhqVPN Ghost WireGuard Daemon
Documentation=https://proxhqvpn.com/docs/ghost-trap
After=network.target nftables.service
Wants=network.target
PartOf=proxhq.target

[Service]
Type=simple
User=proxhq-ghost
Group=proxhq-ghost
ExecStart=/usr/bin/python3 /opt/proxhq-ghost/ghost-wg-daemon.py
Restart=always
RestartSec=5s
TimeoutStopSec=10s

# ── Environment ───────────────────────────────────────────────────────────────
Environment=GHOST_LISTEN_PORT=${cfg.ghostDaemonPort}
Environment=GHOST_LOOP_COUNT=${cfg.loopCount}
Environment=GHOST_TARPIT_MS=${cfg.tarpitMs}
Environment=GHOST_API_BASE=${cfg.apiCallbackUrl ?? "https://your-proxhqvpn-domain.com"}
Environment=GHOST_NODE_ID=${cfg.ghostNodeId ?? 0}
Environment=GHOST_LOG_LEVEL=INFO
# HONEYPOT_PSK is set in the drop-in override (systemctl edit ghost-wg-daemon)
# so the secret is not visible in this file.

# ── Hardening ─────────────────────────────────────────────────────────────────
# Process isolation — the daemon has NO access to the real WG tunnel or filesystem
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
PrivateNetwork=no        # needs network for UDP listen + API callback
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictRealtime=yes
SystemCallFilter=@basic-io @network-io @system-service
SystemCallErrorNumber=EPERM
CapabilityBoundingSet=
AmbientCapabilities=
SecureBits=noroot

# ── Resource limits ───────────────────────────────────────────────────────────
LimitNOFILE=65536
LimitNPROC=64
MemoryLimit=128M
CPUQuota=25%

[Install]
WantedBy=multi-user.target
`;
}

// ── Master deployment script ───────────────────────────────────────────────────
function generateDeployScript(cfg: {
  realWgPort: number;
  decoyPort: number;
  ghostDaemonPort: number;
  wgInterface: string;
  firewallBackend: string;
  apiCallbackUrl?: string | null;
  ghostNodeId?: number | null;
}): string {
  return `#!/usr/bin/env bash
# ============================================================
# ProxhqVPN — WireGuard Deception Layer Full Deployment
# © 2026 Alpha Unlimited Technologies LLC
#
# This is the MASTER script that deploys the entire WireGuard
# deception stack in one shot:
#   1. Creates /etc/proxhq/ directory with all config files
#   2. Installs the ghost WireGuard daemon
#   3. Applies nftables / iptables rules
#   4. Runs the WG port migration (interactive confirmation)
#   5. Enables and starts systemd services
#
# Usage:
#   ./deploy-wg-deception.sh [--auto]
#
# Options:
#   --auto   Skip confirmations (for CI/provisioning scripts)
#
# Required files (in same directory as this script):
#   ghost-wg-daemon.py      — Ghost WG daemon (Python 3)
#   nftables-ghost-trap.nft — nftables configuration
#   iptables-ghost-trap.sh  — iptables fallback
#   wireguard-migrate-port.sh — WG port migration
#   ghost-wg-daemon.service — systemd unit
# ============================================================
set -euo pipefail
SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
AUTO="\${1:-}"

RED='\\e[31m'; GREEN='\\e[32m'; YELLOW='\\e[33m'; CYAN='\\e[36m'; BOLD='\\e[1m'; RESET='\\e[0m'
header() { echo -e "\\n\${BOLD}\${CYAN}━━━ \$* ━━━\${RESET}"; }
info()   { echo -e "  \${CYAN}▸\${RESET} \$*"; }
ok()     { echo -e "  \${GREEN}✓\${RESET} \$*"; }
warn()   { echo -e "  \${YELLOW}⚠\${RESET}  \$*"; }
fail()   { echo -e "  \${RED}✗\${RESET} \$*" >&2; exit 1; }

[[ \$EUID -eq 0 ]] || fail "Run as root: sudo \$0"

echo -e "\${BOLD}\${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║   ProxhqVPN — WireGuard Deception Layer Deployment    ║"
echo "  ║   Real WG: port ${cfg.realWgPort}  |  Decoy: ${cfg.decoyPort}  |  Ghost: ${cfg.ghostDaemonPort}     ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "\${RESET}"

# ── Verify all required files exist ───────────────────────────────────────────
header "Step 1 — Verify source files"
REQUIRED_FILES=(
    "ghost-wg-daemon.py"
    "ghost-wg-daemon.service"
    "wireguard-migrate-port.sh"
)
for f in "\${REQUIRED_FILES[@]}"; do
    if [[ -f "\$SCRIPT_DIR/\$f" ]]; then
        ok "\$f"
    else
        fail "Missing: \$SCRIPT_DIR/\$f"
    fi
done

# ── Install Python 3 if needed ────────────────────────────────────────────────
header "Step 2 — Python 3 dependency"
if ! command -v python3 >/dev/null; then
    info "Installing python3..."
    apt-get update -qq && apt-get install -y python3
fi
ok "Python3: \$(python3 --version)"

# ── Create /etc/proxhq config directory ───────────────────────────────────────
header "Step 3 — Install configuration files"
mkdir -p /etc/proxhq
cp "\$SCRIPT_DIR/ghost-wg-daemon.py"       /etc/proxhq/
cp "\$SCRIPT_DIR/ghost-wg-daemon.service"  /etc/proxhq/
cp "\$SCRIPT_DIR/wireguard-migrate-port.sh" /etc/proxhq/
[[ -f "\$SCRIPT_DIR/nftables-ghost-trap.nft" ]]  && cp "\$SCRIPT_DIR/nftables-ghost-trap.nft"  /etc/proxhq/
[[ -f "\$SCRIPT_DIR/iptables-ghost-trap.sh" ]]   && cp "\$SCRIPT_DIR/iptables-ghost-trap.sh"   /etc/proxhq/
chmod 750 /etc/proxhq
chmod 640 /etc/proxhq/*.py /etc/proxhq/*.nft /etc/proxhq/*.sh 2>/dev/null || true
ok "Configs installed to /etc/proxhq/"

# ── Create dedicated system user for the daemon ───────────────────────────────
header "Step 4 — System user (proxhq-ghost)"
if ! id proxhq-ghost >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /sbin/nologin proxhq-ghost
    ok "User created: proxhq-ghost"
else
    ok "User already exists: proxhq-ghost"
fi

# ── Install daemon to /opt ────────────────────────────────────────────────────
header "Step 5 — Ghost WireGuard daemon"
mkdir -p /opt/proxhq-ghost
cp /etc/proxhq/ghost-wg-daemon.py /opt/proxhq-ghost/
chown -R proxhq-ghost:proxhq-ghost /opt/proxhq-ghost/
chmod 750 /opt/proxhq-ghost/ghost-wg-daemon.py
ok "Daemon installed: /opt/proxhq-ghost/ghost-wg-daemon.py"

# ── Set HONEYPOT_PSK secret ───────────────────────────────────────────────────
header "Step 6 — Honeypot PSK secret"
if [[ -z "\${HONEYPOT_PSK:-}" ]]; then
    warn "HONEYPOT_PSK environment variable not set."
    warn "The ghost daemon will work but API callbacks won't be authenticated."
    warn "To set it: systemctl edit ghost-wg-daemon"
    warn "  [Service]"
    warn "  Environment=HONEYPOT_PSK=your_secret_here"
else
    # Create a systemd drop-in with the secret
    mkdir -p /etc/systemd/system/ghost-wg-daemon.service.d/
    cat > /etc/systemd/system/ghost-wg-daemon.service.d/psk.conf << EOF
[Service]
Environment=HONEYPOT_PSK=\${HONEYPOT_PSK}
Environment=GHOST_API_BASE=${cfg.apiCallbackUrl ?? "https://your-proxhqvpn-domain.com"}
Environment=GHOST_NODE_ID=${cfg.ghostNodeId ?? 0}
EOF
    chmod 600 /etc/systemd/system/ghost-wg-daemon.service.d/psk.conf
    ok "PSK drop-in configured"
fi

# ── Apply firewall rules ───────────────────────────────────────────────────────
header "Step 7 — Firewall rules"
if command -v nft >/dev/null && [[ "${cfg.firewallBackend}" == "nftables" ]]; then
    if [[ -f /etc/proxhq/nftables-ghost-trap.nft ]]; then
        nft -f /etc/proxhq/nftables-ghost-trap.nft
        ok "nftables rules applied"
        # Persist across reboots
        if [[ -f /etc/nftables.conf ]]; then
            if ! grep -q "proxhq/nftables-ghost-trap" /etc/nftables.conf; then
                echo 'include "/etc/proxhq/nftables-ghost-trap.nft"' >> /etc/nftables.conf
                ok "Added to /etc/nftables.conf (persists across reboots)"
            else
                ok "Already in /etc/nftables.conf"
            fi
        fi
    else
        warn "nftables-ghost-trap.nft not found — skipping"
    fi
elif command -v iptables >/dev/null; then
    if [[ -f /etc/proxhq/iptables-ghost-trap.sh ]]; then
        bash /etc/proxhq/iptables-ghost-trap.sh apply
        ok "iptables rules applied"
    else
        warn "iptables-ghost-trap.sh not found — skipping"
    fi
else
    warn "No supported firewall found — apply rules manually"
fi

# ── Install and start systemd service ─────────────────────────────────────────
header "Step 8 — systemd service"
cp /etc/proxhq/ghost-wg-daemon.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable  ghost-wg-daemon
systemctl restart ghost-wg-daemon
sleep 2
if systemctl is-active --quiet ghost-wg-daemon; then
    ok "ghost-wg-daemon is running"
else
    warn "ghost-wg-daemon failed to start"
    warn "Debug: journalctl -u ghost-wg-daemon --no-pager -n 30"
fi

# ── Run WireGuard port migration ───────────────────────────────────────────────
header "Step 9 — WireGuard port migration"
MIGRATE_FLAGS=""
[[ "\$AUTO" == "--auto" ]] && MIGRATE_FLAGS="--force"
bash /etc/proxhq/wireguard-migrate-port.sh \$MIGRATE_FLAGS

# ── Final summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "\${BOLD}\${GREEN}╔══════════════════════════════════════════════════════════╗"
echo -e "║              Deployment Complete!                      ║"
echo -e "╚══════════════════════════════════════════════════════════╝\${RESET}"
echo ""
ok "Real WireGuard port : ${cfg.realWgPort}   (secret — update all peers)"
ok "Decoy port          : ${cfg.decoyPort}  (scanners trapped here)"
ok "Ghost daemon        : ${cfg.ghostDaemonPort}  (internal redirect target)"
ok "Firewall            : ${cfg.firewallBackend}"
echo ""
warn "Next steps:"
warn "  1. Update all WireGuard peer configs: Endpoint = <ip>:${cfg.realWgPort}"
warn "  2. Test: wg show ${cfg.wgInterface}"
warn "  3. Monitor: journalctl -u ghost-wg-daemon -f"
warn "  4. View probes: Dashboard → Ghost Trap → WireGuard"
echo ""
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveConfig(req: Request) {
  const userId = uid(req);
  if (!userId) return null;
  return getOrCreateCfg(userId);
}

// GET /api/wg-deception/generate/ghost-daemon
router.get("/generate/ghost-daemon", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const script = generateGhostDaemon(cfg as Parameters<typeof generateGhostDaemon>[0]);
  res.setHeader("Content-Type", "text/x-python");
  res.setHeader("Content-Disposition", 'attachment; filename="ghost-wg-daemon.py"');
  return res.send(script);
});

// GET /api/wg-deception/generate/nftables
router.get("/generate/nftables", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const script = generateNftables(cfg as Parameters<typeof generateNftables>[0]);
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="nftables-ghost-trap.nft"');
  return res.send(script);
});

// GET /api/wg-deception/generate/iptables
router.get("/generate/iptables", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const script = generateIptables(cfg as Parameters<typeof generateIptables>[0]);
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="iptables-ghost-trap.sh"');
  return res.send(script);
});

// GET /api/wg-deception/generate/migrate-wg-port
router.get("/generate/migrate-wg-port", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const script = generateMigrationScript(cfg as Parameters<typeof generateMigrationScript>[0]);
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="wireguard-migrate-port.sh"');
  return res.send(script);
});

// GET /api/wg-deception/generate/systemd
router.get("/generate/systemd", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const unit = generateSystemdUnit(cfg as Parameters<typeof generateSystemdUnit>[0]);
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="ghost-wg-daemon.service"');
  return res.send(unit);
});

// GET /api/wg-deception/generate/deploy-script
router.get("/generate/deploy-script", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const script = generateDeployScript(cfg as Parameters<typeof generateDeployScript>[0]);
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="deploy-wg-deception.sh"');
  return res.send(script);
});

// GET /api/wg-deception/generate/all — returns all scripts as a JSON bundle
router.get("/generate/all", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const c = cfg as any;
  return res.json({
    ok: true,
    config: {
      realWgPort:      c.realWgPort,
      decoyPort:       c.decoyPort,
      ghostDaemonPort: c.ghostDaemonPort,
      wgInterface:     c.wgInterface,
      firewallBackend: c.firewallBackend,
    },
    files: {
      "ghost-wg-daemon.py":          generateGhostDaemon(c),
      "nftables-ghost-trap.nft":     generateNftables(c),
      "iptables-ghost-trap.sh":      generateIptables(c),
      "wireguard-migrate-port.sh":   generateMigrationScript(c),
      "ghost-wg-daemon.service":     generateSystemdUnit(c),
      "deploy-wg-deception.sh":      generateDeployScript(c),
    },
  });
});

// GET /api/wg-deception/generate/inline — returns all scripts as a single
// ready-to-paste bash heredoc (for users who can't download files to their server)
router.get("/generate/inline", async (req: Request, res: Response) => {
  const cfg = await resolveConfig(req);
  if (!cfg) return res.status(401).json({ error: "Unauthorized" });
  const c = cfg as any;

  const inline = [
    `#!/usr/bin/env bash`,
    `# ProxhqVPN WireGuard Deception Layer — Single-Command Inline Installer`,
    `# © 2026 Alpha Unlimited Technologies LLC`,
    `# Usage: curl -sSL <url> | sudo HONEYPOT_PSK=<psk> bash`,
    `set -euo pipefail`,
    `mkdir -p /etc/proxhq`,
    ``,
    `# ── ghost-wg-daemon.py ────────────────────────────────────────────────────`,
    `cat > /etc/proxhq/ghost-wg-daemon.py << 'GHOSTPY'`,
    generateGhostDaemon(c),
    `GHOSTPY`,
    ``,
    `# ── nftables-ghost-trap.nft ───────────────────────────────────────────────`,
    `cat > /etc/proxhq/nftables-ghost-trap.nft << 'NFTNFT'`,
    generateNftables(c),
    `NFTNFT`,
    ``,
    `# ── ghost-wg-daemon.service ───────────────────────────────────────────────`,
    `cat > /etc/proxhq/ghost-wg-daemon.service << 'SYSTEMD'`,
    generateSystemdUnit(c),
    `SYSTEMD`,
    ``,
    `# ── wireguard-migrate-port.sh ─────────────────────────────────────────────`,
    `cat > /etc/proxhq/wireguard-migrate-port.sh << 'MIGRATE'`,
    generateMigrationScript(c),
    `MIGRATE`,
    ``,
    `# ── Run master deployment ─────────────────────────────────────────────────`,
    `cat > /tmp/deploy-wg-deception.sh << 'DEPLOY'`,
    generateDeployScript(c),
    `DEPLOY`,
    `chmod +x /tmp/deploy-wg-deception.sh`,
    `bash /tmp/deploy-wg-deception.sh`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="proxhq-wg-deception-inline.sh"');
  return res.send(inline);
});

export default router;
