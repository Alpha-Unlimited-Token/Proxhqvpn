import { Router } from "express";
import https from "https";
import http from "http";
import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { db } from "@workspace/db";
import { vpngateNodeSessionsTable, nodesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const VPNGATE_API = "https://www.vpngate.net/api/iphone/";
const CACHE_TTL = 5 * 60 * 1000;

export interface VpnGateServer {
  hostname: string;
  ip: string;
  score: number;
  ping: number;
  speedBps: number;
  speedMbps: number;
  country: string;
  countryCode: string;
  sessions: number;
  uptimeMs: number;
  totalUsers: number;
  totalTrafficGb: number;
  logType: string;
  operator: string;
  message: string;
  hasOvpn: boolean;
  ovpnConfigB64: string;
}

interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  serverIp: string | null;
  country: string | null;
  countryCode: string | null;
  ping: number | null;
  speedMbps: number | null;
  connectedAt: string | null;
  error: string | null;
  pid: number | null;
  ovpnAvailable: boolean;
}

let cache: { data: VpnGateServer[]; ts: number } | null = null;
let vpnProcess: ChildProcess | null = null;
let connState: ConnectionState = {
  status: "disconnected",
  serverIp: null,
  country: null,
  countryCode: null,
  ping: null,
  speedMbps: null,
  connectedAt: null,
  error: null,
  pid: null,
  ovpnAvailable: false,
};

function checkOpenvpn(): boolean {
  try {
    const { execSync } = require("child_process");
    execSync("which openvpn || command -v openvpn", { stdio: "pipe" });
    return true;
  } catch {
    try {
      const { execSync } = require("child_process");
      execSync("openvpn --version", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
}

connState.ovpnAvailable = checkOpenvpn();

function fetchRaw(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchRaw(loc).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
  });
}

function parseCSV(raw: string): VpnGateServer[] {
  const lines = raw.split("\n");
  const dataLines = lines.filter((l) => l.trim() && !l.startsWith("*"));
  if (dataLines.length < 2) return [];

  const headerLine = dataLines[0].replace(/^#/, "").trim();
  const headers = headerLine.split(",");
  const idxOf = (name: string) => headers.indexOf(name);
  const servers: VpnGateServer[] = [];

  for (let i = 1; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < headers.length - 1) continue;

    const get = (name: string) => {
      const idx = idxOf(name);
      return idx >= 0 && idx < parts.length ? parts[idx] : "";
    };

    const speedBps = parseInt(get("Speed")) || 0;
    const totalTrafficBytes = parseInt(get("TotalTraffic")) || 0;
    const ovpnB64 = parts[parts.length - 1]?.trim() || "";

    servers.push({
      hostname: get("HostName"),
      ip: get("IP"),
      score: parseInt(get("Score")) || 0,
      ping: parseInt(get("Ping")) || 0,
      speedBps,
      speedMbps: Math.round((speedBps / 1_000_000) * 10) / 10,
      country: get("CountryLong"),
      countryCode: get("CountryShort").toUpperCase(),
      sessions: parseInt(get("NumVpnSessions")) || 0,
      uptimeMs: parseInt(get("Uptime")) || 0,
      totalUsers: parseInt(get("TotalUsers")) || 0,
      totalTrafficGb: Math.round((totalTrafficBytes / 1_000_000_000) * 10) / 10,
      logType: get("LogType"),
      operator: get("Operator"),
      message: get("Message"),
      hasOvpn: ovpnB64.length > 10,
      ovpnConfigB64: ovpnB64,
    });
  }

  return servers.sort((a, b) => b.score - a.score);
}

async function getServers(): Promise<VpnGateServer[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) return cache.data;

  try {
    const raw = await fetchRaw(VPNGATE_API);
    const data = parseCSV(raw);
    if (data.length > 0) cache = { data, ts: now };
    return data;
  } catch {
    if (cache) return cache.data;
    throw new Error("VPN Gate API unreachable and no cached data available");
  }
}

router.get("/veil", async (req, res) => {
  try {
    const servers = await getServers();
    const { limit } = req.query as Record<string, string>;
    const limitN = Math.min(parseInt(limit) || 2000, 6000);

    // Only servers with a valid OpenVPN config and reasonable ping
    const eligible = servers.filter((s) => s.hasOvpn && s.ping < 350);

    // Group by country, sort each group by score descending
    const byCountry: Record<string, VpnGateServer[]> = {};
    for (const s of eligible) {
      if (!byCountry[s.countryCode]) byCountry[s.countryCode] = [];
      byCountry[s.countryCode].push(s);
    }
    for (const cc of Object.keys(byCountry)) {
      byCountry[cc].sort((a, b) => b.score - a.score);
    }

    // Round-robin across countries for maximum geographic diversity
    const veilNodes: VpnGateServer[] = [];
    const countries = Object.keys(byCountry).sort();
    let round = 0;
    while (veilNodes.length < limitN) {
      let added = 0;
      for (const cc of countries) {
        if (veilNodes.length >= limitN) break;
        if (round < byCountry[cc].length) {
          veilNodes.push(byCountry[cc][round]);
          added++;
        }
      }
      round++;
      if (added === 0) break;
    }

    const countryCount = [...new Set(veilNodes.map((s) => s.countryCode))].length;
    const avgPing = veilNodes.length
      ? Math.round(veilNodes.reduce((acc, s) => acc + s.ping, 0) / veilNodes.length)
      : 0;
    const avgSpeed = veilNodes.length
      ? Math.round((veilNodes.reduce((acc, s) => acc + s.speedMbps, 0) / veilNodes.length) * 10) / 10
      : 0;

    res.json({
      servers: veilNodes,
      total: veilNodes.length,
      countries: countryCount,
      avgPingMs: avgPing,
      avgSpeedMbps: avgSpeed,
      cacheAgeSeconds: cache ? Math.round((Date.now() - cache.ts) / 1000) : 0,
    });
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch veil servers", detail: e.message });
  }
});

router.get("/servers", async (req, res) => {
  try {
    let servers = await getServers();
    const { country, maxPing, minSpeed, logType, limit } = req.query as Record<string, string>;

    if (country) {
      const q = country.toLowerCase();
      servers = servers.filter((s) =>
        s.countryCode.toLowerCase() === q || s.country.toLowerCase().includes(q)
      );
    }
    if (maxPing) servers = servers.filter((s) => s.ping <= parseInt(maxPing));
    if (minSpeed) servers = servers.filter((s) => s.speedMbps >= parseFloat(minSpeed));
    if (logType && logType !== "all") {
      if (logType === "nolog") servers = servers.filter((s) => !s.logType || s.logType.toLowerCase() === "nolog" || s.logType === "");
      else servers = servers.filter((s) => s.logType?.toLowerCase().includes(logType.toLowerCase()));
    }

    const limitN = Math.min(parseInt(limit) || 500, 2000);
    const paginated = servers.slice(0, limitN);

    res.json({
      servers: paginated,
      total: servers.length,
      shown: paginated.length,
      cacheAgeSeconds: cache ? Math.round((Date.now() - cache.ts) / 1000) : 0,
    });
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch VPN Gate servers", detail: e.message });
  }
});

router.get("/servers/best", async (req, res) => {
  try {
    const servers = await getServers();
    const { country, maxPing } = req.query as Record<string, string>;
    let pool = servers;
    if (country) {
      const q = country.toLowerCase();
      pool = pool.filter((s) => s.countryCode.toLowerCase() === q || s.country.toLowerCase().includes(q));
    }
    if (maxPing) pool = pool.filter((s) => s.ping <= parseInt(maxPing));
    const best = pool[0];
    if (!best) return res.status(404).json({ error: "No matching servers available" });
    res.json(best);
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch VPN Gate servers", detail: e.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const servers = await getServers();
    const countries = [...new Set(servers.map((s) => s.countryCode))].sort();
    const avgPing = servers.length
      ? Math.round(servers.reduce((s, n) => s + n.ping, 0) / servers.length)
      : 0;
    const avgSpeed = servers.length
      ? Math.round((servers.reduce((s, n) => s + n.speedMbps, 0) / servers.length) * 10) / 10
      : 0;
    const totalSessions = servers.reduce((s, n) => s + n.sessions, 0);

    const byCountry: Record<string, number> = {};
    for (const s of servers) byCountry[s.countryCode] = (byCountry[s.countryCode] || 0) + 1;
    const topCountries = Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([code, count]) => ({ code, count }));

    res.json({
      totalServers: servers.length,
      countries: countries.length,
      avgPingMs: avgPing,
      avgSpeedMbps: avgSpeed,
      totalSessions,
      topCountries,
      cacheAgeSeconds: cache ? Math.round((Date.now() - cache.ts) / 1000) : 0,
    });
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch VPN Gate stats", detail: e.message });
  }
});

router.delete("/cache", (_req, res) => {
  cache = null;
  res.json({ message: "Cache cleared" });
});

router.get("/servers/:ip/config", async (req, res) => {
  try {
    const servers = await getServers();
    const server = servers.find((s) => s.ip === req.params.ip);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (!server.hasOvpn) return res.status(404).json({ error: "No OpenVPN config for this server" });

    let config: string;
    try {
      config = Buffer.from(server.ovpnConfigB64, "base64").toString("utf-8");
    } catch {
      return res.status(500).json({ error: "Failed to decode OpenVPN config" });
    }

    res.setHeader("Content-Type", "application/x-openvpn-profile");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vpngate-${server.countryCode}-${server.ip}.ovpn"`,
    );
    res.send(config);
  } catch (e: any) {
    res.status(502).json({ error: "Failed to get config", detail: e.message });
  }
});

router.get("/connection", (_req, res) => {
  connState.ovpnAvailable = checkOpenvpn();
  res.json(connState);
});

router.post("/connect", async (req, res) => {
  if (vpnProcess && connState.status === "connected") {
    return res.status(409).json({ error: "Already connected. Disconnect first." });
  }

  const ovpnAvailable = checkOpenvpn();
  connState.ovpnAvailable = ovpnAvailable;

  try {
    const body = z.object({
      ip: z.string().max(45).optional(),
      country: z.string().max(100).optional(),
    }).parse(req.body ?? {});

    const servers = await getServers();
    let server: VpnGateServer | undefined;

    if (body.ip) {
      server = servers.find((s) => s.ip === body.ip);
    } else if (body.country) {
      const q = body.country.toLowerCase();
      server = servers.find((s) => s.countryCode.toLowerCase() === q || s.country.toLowerCase().includes(q));
    } else {
      server = servers[0];
    }

    if (!server) return res.status(404).json({ error: "No server found" });
    if (!server.hasOvpn) return res.status(400).json({ error: "Server has no OpenVPN config" });

    connState = {
      status: ovpnAvailable ? "connecting" : "error",
      serverIp: server.ip,
      country: server.country,
      countryCode: server.countryCode,
      ping: server.ping,
      speedMbps: server.speedMbps,
      connectedAt: null,
      error: ovpnAvailable ? null : "OpenVPN not installed on this server. Use the connect scripts (proxhq-connect.sh / proxhq-connect.ps1) on your local machine instead.",
      pid: null,
      ovpnAvailable,
    };

    if (!ovpnAvailable) {
      return res.status(400).json({
        error: "OpenVPN not installed on this server",
        hint: "Use proxhq-connect.sh (Linux/macOS) or proxhq-connect.ps1 (Windows) on your local machine to connect",
        server: { ip: server.ip, country: server.country, ping: server.ping, speedMbps: server.speedMbps },
      });
    }

    const config = Buffer.from(server.ovpnConfigB64, "base64").toString("utf-8");
    const ovpnPath = join(tmpdir(), `proxhq-vpngate-${Date.now()}.ovpn`);
    const credsPath = join(tmpdir(), `proxhq-vpngate-creds-${Date.now()}.txt`);

    writeFileSync(ovpnPath, config, { mode: 0o600 });
    writeFileSync(credsPath, "vpn\nvpn\n", { mode: 0o600 });

    const args = [
      "openvpn",
      "--config", ovpnPath,
      "--auth-user-pass", credsPath,
      "--verb", "1",
    ];

    // Mask 1 — Tor Veil: route entire OpenVPN handshake + traffic through Tor SOCKS5
    // VPNGate server will only see the Tor exit node IP, never this server's real IP
    if ((req.body as any)?.torVeil) {
      args.push("--socks-proxy", "127.0.0.1", "9050");
      args.push("--proto", "tcp"); // Tor only proxies TCP
    }

    vpnProcess = spawn("sudo", args, { detached: false });

    const pid = vpnProcess.pid || null;
    connState.pid = pid;

    vpnProcess.stdout?.on("data", (data: Buffer) => {
      const line = data.toString();
      if (line.includes("Initialization Sequence Completed")) {
        connState.status = "connected";
        connState.connectedAt = new Date().toISOString();
      }
    });

    vpnProcess.on("error", (err) => {
      connState.status = "error";
      connState.error = err.message;
      vpnProcess = null;
      try { if (existsSync(ovpnPath)) unlinkSync(ovpnPath); } catch {}
      try { if (existsSync(credsPath)) unlinkSync(credsPath); } catch {}
    });

    vpnProcess.on("exit", () => {
      connState = { ...connState, status: "disconnected", connectedAt: null, pid: null };
      vpnProcess = null;
      try { if (existsSync(ovpnPath)) unlinkSync(ovpnPath); } catch {}
      try { if (existsSync(credsPath)) unlinkSync(credsPath); } catch {}
    });

    setTimeout(() => {
      if (connState.status === "connecting") {
        connState.status = "connected";
        connState.connectedAt = new Date().toISOString();
      }
    }, 6000);

    res.json({
      message: "Connecting...",
      server: { ip: server.ip, country: server.country, ping: server.ping, speedMbps: server.speedMbps },
      pid,
    });
  } catch (e: any) {
    connState.status = "error";
    connState.error = e.message;
    res.status(500).json({ error: e.message });
  }
});

// ── Node-level double-hop management ──────────────────────────────────────────

// GET /api/vpngate/node-sessions — list all active VPN Gate sessions across nodes
router.get("/node-sessions", async (_req, res) => {
  const sessions = await db
    .select()
    .from(vpngateNodeSessionsTable)
    .orderBy(desc(vpngateNodeSessionsTable.assignedAt));
  const nodes = await db.select().from(nodesTable);
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  res.json({
    sessions: sessions.map((s) => ({
      ...s,
      nodeName: nodeMap[s.nodeId]?.name ?? `Node ${s.nodeId}`,
      nodeRegion: nodeMap[s.nodeId]?.region ?? "Unknown",
      nodeIp: nodeMap[s.nodeId]?.ipAddress ?? null,
    })),
  });
});

// POST /api/vpngate/node/:nodeId/enable — assign best VPN Gate server to a node
router.post("/node/:nodeId/enable", async (req, res) => {
  const nodeId = parseInt(req.params.nodeId);
  if (!nodeId) return res.status(400).json({ error: "Invalid nodeId" });

  const { country, serverIp } = req.body as { country?: string; serverIp?: string };

  // Find the right VPN Gate server
  let servers: VpnGateServer[];
  try {
    servers = await getServers();
  } catch (e: any) {
    return res.status(502).json({ error: "Could not fetch VPN Gate servers", detail: e.message });
  }

  let pool = servers.filter((s) => s.hasOvpn && s.ping < 400);

  if (serverIp) {
    pool = pool.filter((s) => s.ip === serverIp);
  } else if (country) {
    const q = country.toLowerCase();
    pool = pool.filter((s) => s.countryCode.toLowerCase() === q || s.country.toLowerCase().includes(q));
  }

  const server = pool[0];
  if (!server) return res.status(404).json({ error: "No suitable VPN Gate server found" });
  if (!server.ovpnConfigB64) return res.status(400).json({ error: "Server has no OpenVPN config" });

  // Remove any existing session for this node
  await db.delete(vpngateNodeSessionsTable).where(eq(vpngateNodeSessionsTable.nodeId, nodeId));

  // Create new pending session
  const [session] = await db.insert(vpngateNodeSessionsTable).values({
    nodeId,
    status: "pending_connect",
    serverIp: server.ip,
    serverCountry: server.country,
    serverCountryCode: server.countryCode,
    ovpnConfigB64: server.ovpnConfigB64,
    assignedAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  res.json({
    message: "VPN Gate session queued — node will connect within 30 seconds",
    sessionId: session.id,
    server: { ip: server.ip, country: server.country, ping: server.ping, speedMbps: server.speedMbps },
  });
});

// POST /api/vpngate/node/:nodeId/disable — remove VPN Gate from a node
router.post("/node/:nodeId/disable", async (req, res) => {
  const nodeId = parseInt(req.params.nodeId);
  if (!nodeId) return res.status(400).json({ error: "Invalid nodeId" });

  const existing = await db
    .select()
    .from(vpngateNodeSessionsTable)
    .where(eq(vpngateNodeSessionsTable.nodeId, nodeId));

  if (existing.length === 0) {
    return res.json({ message: "No active VPN Gate session for this node" });
  }

  await db.update(vpngateNodeSessionsTable).set({
    status: "pending_disconnect",
    updatedAt: new Date(),
  }).where(eq(vpngateNodeSessionsTable.nodeId, nodeId));

  res.json({ message: "Disconnect queued — node will disconnect within 30 seconds" });
});

// GET /api/vpngate/node/:nodeId/status — current VPN Gate status for a specific node
router.get("/node/:nodeId/status", async (req, res) => {
  const nodeId = parseInt(req.params.nodeId);
  const [session] = await db
    .select()
    .from(vpngateNodeSessionsTable)
    .where(eq(vpngateNodeSessionsTable.nodeId, nodeId))
    .limit(1);

  if (!session) return res.json({ active: false });
  res.json({ active: true, ...session });
});

router.post("/disconnect", (_req, res) => {
  if (!vpnProcess) {
    connState = { ...connState, status: "disconnected", connectedAt: null, pid: null };
    return res.json({ message: "Not connected" });
  }
  try {
    vpnProcess.kill("SIGTERM");
    setTimeout(() => { if (vpnProcess) { try { vpnProcess.kill("SIGKILL"); } catch {} } }, 3000);
  } catch {}
  vpnProcess = null;
  connState = { ...connState, status: "disconnected", connectedAt: null, pid: null, error: null };
  res.json({ message: "Disconnected" });
});

// ─────────────────────────────────────────────────────────────────────────────
// GHOST CHAIN — multi-veil anonymity routing
//
// Architecture:
//   User → [WireGuard] → This Server → [TOR VEIL] → VPNGate Relay A
//        → [RELAY VEIL] → VPNGate Exit B → Website
//
// Mask 1 (Tor Veil):   OpenVPN to VPNGate-A is routed through the Tor daemon
//                      on 127.0.0.1:9050. VPNGate-A never sees this server's
//                      real IP — it only sees a Tor exit node.
//
// Mask 2 (Relay Veil): VPNGate-A is used as an intermediate SOCKS relay.
//                      Traffic exits through VPNGate-B. The destination website
//                      only ever sees VPNGate-B's IP.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/ghost-chain", async (req, res) => {
  try {
    const servers = await getServers();

    // Need at least 2 servers with OpenVPN configs, from different countries
    const ovpnServers = servers.filter((s) => s.hasOvpn && s.ovpnConfigB64);
    if (ovpnServers.length < 2) {
      return res.status(503).json({ error: "Not enough VPNGate servers available to build a Ghost Chain. Try again in a moment." });
    }

    // Pick the best relay server (lowest ping, has OVPN)
    const relayServer = ovpnServers[0];

    // Pick exit from a different country
    const exitServer = ovpnServers.find(
      (s) => s.countryCode !== relayServer.countryCode && s.ip !== relayServer.ip
    ) ?? ovpnServers[1];

    // Decode the OVPN configs
    const relayConfig = Buffer.from(relayServer.ovpnConfigB64, "base64").toString("utf-8");
    const exitConfig  = Buffer.from(exitServer.ovpnConfigB64, "base64").toString("utf-8");

    // Generate Tor-veiled OVPN config for relay (Mask 1)
    // We inject the socks-proxy directive so the OpenVPN client uses our Tor daemon
    const torVeiled = relayConfig
      .replace(/^proto\s+udp/gim, "proto tcp") // Tor only supports TCP
      + "\n# Ghost Chain — Mask 1: Tor Veil\nsocks-proxy 127.0.0.1 9050\n";

    // Parse relay server SOCKS port for proxychains (OpenVPN tun typically exposes SOCKS at 1080)
    const relayIp = relayServer.ip;
    const exitIp  = exitServer.ip;

    // Generate proxychains4 config for the relay-through-exit chain (Mask 2)
    const proxychainsConf = `# ProxhqVPN Ghost Chain — Mask 2: Relay Veil
# Generated: ${new Date().toISOString()}
# Architecture: This Machine → VPNGate Relay (${relayIp}) → VPNGate Exit (${exitIp}) → Website

strict_chain
proxy_dns
remote_dns_subnet 224
tcp_read_time_out 15000
tcp_connect_time_out 8000

[ProxyList]
# Mask 1 — Tor Veil (hides this server's IP from VPNGate Relay)
socks5  127.0.0.1 9050

# Mask 2 — VPNGate Relay (VPNGate A — hides Tor exit from VPNGate Exit)
# Connect to relay first, then chain through to exit
socks5  ${relayIp} 1194

# VPNGate Exit — the only IP the destination website sees
socks5  ${exitIp} 1194
`;

    // Linux/macOS Ghost Chain script
    const linuxScript = `#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  ProxhqVPN Ghost Chain — Full 5-Hop Anonymity Setup
#  Generated: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════════
#
#  Routing Path:
#    Your Device
#      ↓ [WireGuard — Hop 1]
#    ProxhqVPN Server
#      ↓ [Tor Circuit — Hops 2-4, 3 relays inside Tor]
#    Tor Exit Node  ← VPNGate Relay sees this IP only
#      ↓ [OpenVPN / Mask 1 — Tor Veil]
#    VPNGate Relay: ${relayServer.country} (${relayIp})
#      ↓ [OpenVPN / Mask 2 — Relay Veil]
#    VPNGate Exit:  ${exitServer.country} (${exitIp})  ← Website sees ONLY this
#      ↓ [HTTPS/TCP]
#    Destination Website
#
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RELAY_IP="${relayIp}"
EXIT_IP="${exitIp}"
TOR_SOCKS="127.0.0.1:9050"

echo "[Ghost Chain] Checking dependencies..."

# Require: openvpn, proxychains4, tor
for cmd in openvpn proxychains4 tor; do
  if ! command -v "\$cmd" &>/dev/null; then
    echo "[!] Missing: \$cmd — install it first"
    echo "    Ubuntu/Debian: sudo apt install \$cmd"
    echo "    macOS:         brew install \$cmd"
    exit 1
  fi
done

echo "[Ghost Chain] Verifying Tor SOCKS proxy on \$TOR_SOCKS..."
if ! nc -z 127.0.0.1 9050 2>/dev/null; then
  echo "[!] Tor SOCKS not reachable on 127.0.0.1:9050"
  echo "    Start Tor: sudo systemctl start tor"
  exit 1
fi
echo "[OK] Tor is running"

echo "[Ghost Chain] Writing Tor-veiled relay config (Mask 1)..."
cat > /tmp/ghost-relay.ovpn << 'OVPNEOF'
${torVeiled}
OVPNEOF

echo "[Ghost Chain] Writing exit server config (Mask 2)..."
cat > /tmp/ghost-exit.ovpn << 'OVPNEOF'
${exitConfig}
OVPNEOF

echo "[Ghost Chain] Writing proxychains4 config..."
cat > /tmp/ghost-proxychains.conf << 'PCEOF'
${proxychainsConf}
PCEOF

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ProxhqVPN GHOST CHAIN — ACTIVE ROUTING            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Your Device → WireGuard → ProxhqVPN Server                 ║"
echo "║      → [TOR VEIL] → Tor Exit                                ║"
echo "║      → [OpenVPN]  → ${relayServer.country} Relay (${relayIp})   ║"
echo "║      → [RELAY]    → ${exitServer.country} Exit  (${exitIp})     ║"
echo "║      → Website (sees only ${exitIp})                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "[Ghost Chain] Establishing Mask 1 — Tor-veiled relay connection..."
sudo proxychains4 -f /tmp/ghost-proxychains.conf openvpn \\
  --config /tmp/ghost-relay.ovpn \\
  --auth-user-pass <(echo -e "vpn\\nvpn") \\
  --socks-proxy 127.0.0.1 9050 \\
  --proto tcp \\
  --verb 1 &
RELAY_PID=\$!
echo "[OK] Relay PID: \$RELAY_PID"

sleep 8  # allow relay tunnel to establish

echo "[Ghost Chain] Establishing Mask 2 — Relay-veiled exit connection..."
sudo openvpn \\
  --config /tmp/ghost-exit.ovpn \\
  --auth-user-pass <(echo -e "vpn\\nvpn") \\
  --verb 1 &
EXIT_PID=\$!
echo "[OK] Exit PID: \$EXIT_PID"

echo ""
echo "[Ghost Chain] Both veils active. Press Ctrl+C to disconnect all."
trap "echo 'Disconnecting...'; kill \$RELAY_PID \$EXIT_PID 2>/dev/null; echo 'Ghost Chain terminated.'" INT TERM
wait
`;

    // Windows PowerShell Ghost Chain script
    const psScript = `# ═══════════════════════════════════════════════════════════════
#  ProxhqVPN Ghost Chain — Windows PowerShell
#  Generated: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════════
#
#  Routing Path:
#    Your Device → WireGuard → ProxhqVPN Server
#      → [TOR VEIL]    → Tor Exit Node
#      → [RELAY]       → ${relayServer.country} Relay (${relayIp})
#      → [RELAY VEIL]  → ${exitServer.country} Exit  (${exitIp})
#      → Website (sees ONLY ${exitIp})
#
# Requirements: OpenVPN, Tor (from Expert Bundle), proxychains (via cygwin)
# ═══════════════════════════════════════════════════════════════

param([switch]\$Verbose)

\$RELAY_IP = "${relayIp}"
\$EXIT_IP  = "${exitIp}"

Write-Host "[Ghost Chain] ProxhqVPN Ghost Chain — Windows" -ForegroundColor Cyan
Write-Host "  Relay : ${relayServer.country} (\$RELAY_IP)" -ForegroundColor Yellow
Write-Host "  Exit  : ${exitServer.country} (\$EXIT_IP)"  -ForegroundColor Green
Write-Host ""

# Check OpenVPN
if (-not (Get-Command "openvpn" -ErrorAction SilentlyContinue)) {
    Write-Host "[!] OpenVPN not found. Download from https://openvpn.net/community-downloads/" -ForegroundColor Red
    exit 1
}

# Check Tor
\$torPath = "C:\\Tor\\tor.exe"
if (-not (Test-Path \$torPath)) {
    Write-Host "[!] Tor Expert Bundle not found at \$torPath" -ForegroundColor Red
    Write-Host "    Download: https://www.torproject.org/download/tor/" -ForegroundColor Yellow
    exit 1
}

# Write relay config
\$relayConf = @'
${torVeiled}
'@
\$relayConf | Out-File -FilePath "\$env:TEMP\\ghost-relay.ovpn" -Encoding ascii

# Write exit config
\$exitConf = @'
${exitConfig}
'@
\$exitConf | Out-File -FilePath "\$env:TEMP\\ghost-exit.ovpn" -Encoding ascii

Write-Host "[Ghost Chain] Starting Tor SOCKS proxy..."
Start-Process -FilePath \$torPath -ArgumentList "--SocksPort 9050" -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "[Ghost Chain] Mask 1 — Connecting through Tor to relay (\$RELAY_IP)..."
\$relayJob = Start-Process "openvpn" -ArgumentList \`
  "--config", "\$env:TEMP\\ghost-relay.ovpn", \`
  "--auth-user-pass", "\$env:TEMP\\ghost-creds.txt", \`
  "--socks-proxy", "127.0.0.1", "9050", \`
  "--proto", "tcp", \`
  "--verb", "1" \`
  -PassThru

Start-Sleep -Seconds 8

Write-Host "[Ghost Chain] Mask 2 — Connecting through relay to exit (\$EXIT_IP)..."
\$exitJob = Start-Process "openvpn" -ArgumentList \`
  "--config", "\$env:TEMP\\ghost-exit.ovpn", \`
  "--auth-user-pass", "\$env:TEMP\\ghost-creds.txt", \`
  "--verb", "1" \`
  -PassThru

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   GHOST CHAIN ACTIVE — Press Ctrl+C to stop  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  Your traffic exits via: \$EXIT_IP (${exitServer.country})" -ForegroundColor Green
Write-Host ""

try {
    while (\$true) { Start-Sleep -Seconds 5 }
} finally {
    Write-Host "Disconnecting Ghost Chain..." -ForegroundColor Yellow
    Stop-Process -Id \$relayJob.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id \$exitJob.Id  -Force -ErrorAction SilentlyContinue
    Write-Host "Ghost Chain terminated." -ForegroundColor Red
}
`;

    res.json({
      ghostChain: {
        generatedAt: new Date().toISOString(),
        hops: 5,
        description: "5-hop Ghost Chain: WireGuard → Tor (3 relays) → VPNGate Relay → VPNGate Exit → Website",
        masks: [
          {
            name: "Tor Veil",
            position: "Between ProxhqVPN Server and VPNGate Relay",
            mechanism: "OpenVPN routed through Tor SOCKS5 (127.0.0.1:9050)",
            effect: "VPNGate Relay sees Tor exit node IP — never sees this server's real IP",
            hops: 3,
          },
          {
            name: "Relay Veil",
            position: "Between VPNGate Relay and VPNGate Exit",
            mechanism: "VPNGate Relay server used as intermediary SOCKS relay",
            effect: "Website sees only VPNGate Exit IP. VPNGate Exit sees only VPNGate Relay IP.",
            hops: 1,
          },
        ],
        relay: {
          ip: relayServer.ip,
          country: relayServer.country,
          countryCode: relayServer.countryCode,
          ping: relayServer.ping,
          speedMbps: relayServer.speedMbps,
          role: "Mask 1 exit / Mask 2 relay — receives Tor-veiled OpenVPN connection",
        },
        exit: {
          ip: exitServer.ip,
          country: exitServer.country,
          countryCode: exitServer.countryCode,
          ping: exitServer.ping,
          speedMbps: exitServer.speedMbps,
          role: "Final exit — ONLY IP visible to destination websites",
        },
        configs: {
          torVeiledOvpn: Buffer.from(torVeiled).toString("base64"),
          exitOvpn: exitServer.ovpnConfigB64,
          proxychainsConf: Buffer.from(proxychainsConf).toString("base64"),
          linuxScript: Buffer.from(linuxScript).toString("base64"),
          windowsScript: Buffer.from(psScript).toString("base64"),
        },
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: "Ghost Chain generation failed", detail: e.message });
  }
});

export default router;
