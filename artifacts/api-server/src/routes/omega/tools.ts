// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { db, hostsTable, eventsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/tools/ping", async (req, res): Promise<void> => {
  const { ip } = req.body;
  if (!ip || typeof ip !== "string") { res.status(400).json({ error: "ip required" }); return; }
  await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
  const latency = Math.floor(Math.random() * 120) + 5;
  const reachable = Math.random() > 0.15;
  res.json({ ip, reachable, latencyMs: reachable ? latency : null, ttl: reachable ? 64 : null });
});

router.post("/tools/resolve", async (req, res): Promise<void> => {
  const { host } = req.body;
  if (!host || typeof host !== "string") { res.status(400).json({ error: "host required" }); return; }
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (isIp) {
    const octets = host.split(".");
    res.json({ input: host, resolved: `host-${octets[3]}.local.net`, type: "reverse" });
  } else {
    const ip = `192.168.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 254) + 1}`;
    res.json({ input: host, resolved: ip, type: "forward" });
  }
});

router.post("/tools/scan", async (req, res): Promise<void> => {
  const { startIp, endIp, port = 54896 } = req.body;
  if (!startIp || !endIp) { res.status(400).json({ error: "startIp and endIp required" }); return; }
  await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
  const parseIp = (ip: string) => ip.split(".").map(Number);
  const start = parseIp(startIp);
  const end = parseIp(endIp);
  const lastStart = start[3];
  const lastEnd = Math.min(end[3], lastStart + 20);
  const hosts = await db.select().from(hostsTable);
  const knownIps = new Set(hosts.map(h => h.ip));
  const results = [];
  for (let i = lastStart; i <= lastEnd; i++) {
    const ip = `${start[0]}.${start[1]}.${start[2]}.${i}`;
    const known = knownIps.has(ip) || knownIps.has(`${ip}:${port}`);
    const open = known || Math.random() > 0.75;
    if (open) results.push({ ip, port, open: true, latencyMs: Math.floor(Math.random() * 60) + 5, known });
  }
  await db.insert(eventsTable).values({ hostId: null, hostIp: null, hostLabel: null, category: "Scanner", action: "IP scan completed", details: `Scanned range ${startIp}-${endIp}, found ${results.length} hosts`, severity: "info" });
  res.json({ results, scanned: lastEnd - lastStart + 1, found: results.length });
});

export default router;
