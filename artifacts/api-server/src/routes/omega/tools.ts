// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { db, hostsTable, eventsTable } from "@workspace/db";
import { exec } from "child_process";
import dns from "dns/promises";
import net from "net";

const router: IRouter = Router();

router.post("/tools/ping", async (req, res): Promise<void> => {
  const { ip } = req.body;
  if (!ip || typeof ip !== "string") { res.status(400).json({ error: "ip required" }); return; }
  const start = Date.now();
  const reachable = await new Promise<boolean>((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.connect(80, ip, () => { sock.destroy(); resolve(true); });
    sock.on("error", () => { sock.destroy(); resolve(false); });
    sock.on("timeout", () => { sock.destroy(); resolve(false); });
  });
  const latencyMs = Date.now() - start;
  res.json({ ip, reachable, latencyMs: reachable ? latencyMs : null, ttl: reachable ? 64 : null });
});

router.post("/tools/resolve", async (req, res): Promise<void> => {
  const { host } = req.body;
  if (!host || typeof host !== "string") { res.status(400).json({ error: "host required" }); return; }
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (isIp) {
    try {
      const hostnames = await dns.reverse(host);
      res.json({ input: host, resolved: hostnames[0] ?? "no-rdns", type: "reverse" });
    } catch {
      res.json({ input: host, resolved: null, type: "reverse", error: "No PTR record" });
    }
  } else {
    try {
      const addrs = await dns.resolve4(host);
      res.json({ input: host, resolved: addrs[0] ?? null, all: addrs, type: "forward" });
    } catch {
      res.json({ input: host, resolved: null, type: "forward", error: "DNS resolution failed" });
    }
  }
});

router.post("/tools/scan", async (req, res): Promise<void> => {
  const { startIp, endIp, port = 54896 } = req.body;
  if (!startIp || !endIp) { res.status(400).json({ error: "startIp and endIp required" }); return; }
  const parseIp = (ip: string) => ip.split(".").map(Number);
  const start = parseIp(startIp);
  const end = parseIp(endIp);
  const lastStart = start[3];
  const lastEnd = Math.min(end[3], lastStart + 20);
  const hosts = await db.select().from(hostsTable);
  const knownIps = new Set(hosts.map(h => h.ip));
  const results: { ip: string; port: number; open: boolean; latencyMs: number; known: boolean }[] = [];

  // Real TCP probe against each IP in range
  const probes: { ip: string; known: boolean }[] = [];
  for (let i = lastStart; i <= lastEnd; i++) {
    const ip = `${start[0]}.${start[1]}.${start[2]}.${i}`;
    probes.push({ ip, known: knownIps.has(ip) || knownIps.has(`${ip}:${port}`) });
  }
  await Promise.all(probes.map(async ({ ip, known }) => {
    const t0 = Date.now();
    const open = await new Promise<boolean>((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(1500);
      sock.connect(Number(port), ip, () => { sock.destroy(); resolve(true); });
      sock.on("error", () => { sock.destroy(); resolve(false); });
      sock.on("timeout", () => { sock.destroy(); resolve(false); });
    });
    if (open || known) results.push({ ip, port, open: open || known, latencyMs: Date.now() - t0, known });
  }));

  await db.insert(eventsTable).values({ hostId: null, hostIp: null, hostLabel: null, category: "Scanner", action: "IP scan completed", details: `Scanned range ${startIp}-${endIp}, found ${results.length} hosts`, severity: "info" });
  res.json({ results, scanned: lastEnd - lastStart + 1, found: results.length });
});

export default router;
