// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import https from "https";
import http from "http";

const execAsync = promisify(exec);
const router = Router();

// ---------------------------------------------------------------------------
// Real connection data from the OS via `ss`
// ---------------------------------------------------------------------------

interface Connection {
  id: string;
  localAddress: string;
  remoteAddress: string;
  protocol: "TCP" | "UDP" | "WireGuard";
  state: string;
  process: string;
  pid?: number;
  nodeId?: number;
}

async function getRealConnections(): Promise<Connection[]> {
  try {
    const { stdout } = await execAsync("ss -tupn 2>/dev/null || netstat -tupn 2>/dev/null");
    const lines = stdout.split("\n").slice(1).filter(Boolean);
    const results: Connection[] = [];
    let id = 1;
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;
      const proto = parts[0]?.toUpperCase();
      if (!proto || !["TCP", "UDP"].includes(proto)) continue;
      const state = proto === "TCP" ? (parts[1] || "UNKNOWN") : "";
      const localIdx = proto === "TCP" ? 3 : 3;
      const remoteIdx = proto === "TCP" ? 4 : 4;
      const local = parts[localIdx] || "";
      const remote = parts[remoteIdx] || "0.0.0.0:*";
      // Parse process name from "users:(("name",pid=NNN,...))"
      const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      const procName = procMatch ? procMatch[1] : "unknown";
      const pid = procMatch ? parseInt(procMatch[2], 10) : undefined;
      // Only include established or listening connections
      if (remote === "0.0.0.0:*" || remote === "*:*") continue;
      results.push({
        id: String(id++),
        localAddress: local,
        remoteAddress: remote,
        protocol: proto as "TCP" | "UDP",
        state: state || "ESTABLISHED",
        process: procName,
        pid,
      });
      if (results.length >= 30) break;
    }
    // Also check for WireGuard interfaces
    try {
      const { stdout: wgOut } = await execAsync("wg show 2>/dev/null");
      if (wgOut.includes("peer:")) {
        const peerMatches = wgOut.match(/endpoint: ([^\s]+)/g) || [];
        for (const match of peerMatches.slice(0, 5)) {
          const ep = match.replace("endpoint: ", "");
          results.push({
            id: String(id++),
            localAddress: "0.0.0.0:51820",
            remoteAddress: ep,
            protocol: "WireGuard",
            state: "ESTABLISHED",
            process: "wg-quick",
          });
        }
      }
    } catch {}
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Real network I/O from /proc/net/dev
// ---------------------------------------------------------------------------

async function getNetworkIO(): Promise<{ inMbps: number; outMbps: number }> {
  try {
    const read = async () => {
      const { stdout } = await execAsync("cat /proc/net/dev 2>/dev/null");
      let totalRx = 0;
      let totalTx = 0;
      for (const line of stdout.split("\n").slice(2)) {
        const parts = line.trim().split(/\s+/);
        if (!parts[0] || parts[0].startsWith("lo:")) continue;
        totalRx += parseInt(parts[1] || "0", 10);
        totalTx += parseInt(parts[9] || "0", 10);
      }
      return { rx: totalRx, tx: totalTx, ts: Date.now() };
    };
    const s1 = await read();
    await new Promise((r) => setTimeout(r, 500));
    const s2 = await read();
    const dtSec = (s2.ts - s1.ts) / 1000;
    const inMbps = Math.round(((s2.rx - s1.rx) * 8) / dtSec / 1_000_000 * 10) / 10;
    const outMbps = Math.round(((s2.tx - s1.tx) * 8) / dtSec / 1_000_000 * 10) / 10;
    return { inMbps: Math.max(0, inMbps), outMbps: Math.max(0, outMbps) };
  } catch {
    return { inMbps: 0, outMbps: 0 };
  }
}

// ---------------------------------------------------------------------------
// Real WireGuard tunnel count
// ---------------------------------------------------------------------------

async function getWgTunnelCount(): Promise<number> {
  try {
    const { stdout } = await execAsync("wg show interfaces 2>/dev/null");
    return stdout.trim().split(/\s+/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Real external IP
// ---------------------------------------------------------------------------

let cachedExternalIp: string | null = null;
let externalIpTs = 0;
const EXTERNAL_IP_TTL = 5 * 60 * 1000; // 5 min

function fetchExternalIp(): Promise<string | null> {
  return new Promise((resolve) => {
    if (cachedExternalIp && Date.now() - externalIpTs < EXTERNAL_IP_TTL) {
      return resolve(cachedExternalIp);
    }
    const req = https.get("https://api.ipify.org?format=json", { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const ip = JSON.parse(data).ip || null;
          cachedExternalIp = ip;
          externalIpTs = Date.now();
          resolve(ip);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/connections", async (_req, res) => {
  const connections = await getRealConnections();
  res.json({ connections, total: connections.length });
});

router.get("/stats", async (_req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptimeSecs = os.uptime();
  const hours = Math.floor(uptimeSecs / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);

  // CPU — try real top, fall back to os.loadavg estimate
  let cpuPercent = 0;
  try {
    const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
    const parsed = parseFloat(stdout.trim());
    if (!isNaN(parsed)) cpuPercent = parsed;
    else {
      const load = os.loadavg()[0];
      cpuPercent = Math.min(100, Math.round((load / cpus.length) * 100 * 10) / 10);
    }
  } catch {
    const load = os.loadavg()[0];
    cpuPercent = Math.min(100, Math.round((load / cpus.length) * 100 * 10) / 10);
  }

  const [netIO, wgTunnels, externalIp] = await Promise.all([
    getNetworkIO(),
    getWgTunnelCount(),
    fetchExternalIp(),
  ]);

  res.json({
    cpuPercent,
    memoryPercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    memoryUsedMb: Math.round(usedMem / 1024 / 1024),
    memoryTotalMb: Math.round(totalMem / 1024 / 1024),
    networkInMbps: netIO.inMbps,
    networkOutMbps: netIO.outMbps,
    uptime: `${hours}h ${mins}m`,
    platform: `${os.platform()} ${os.arch()}`,
    activeUsers: 1,
    wireguardTunnels: wgTunnels,
    externalIp: externalIp ?? "unavailable",
  });
});

export default router;
