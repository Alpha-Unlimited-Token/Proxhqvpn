import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db";

const router = Router();

const PROTOCOLS = ["HTTPS", "DNS", "HTTP", "QUIC", "SSH", "NTP", "SMTP", "FTP", "ICMP", "TCP/Other"];
const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
];

function seedRand(seed: number, t: number) {
  return Math.abs(Math.sin(seed * 1.618 + t * 0.9871)) ;
}

function generateFlows(nodeCount: number) {
  const now = Date.now();
  const flows = [];
  const services = [
    "api.github.com", "cloudflare.com", "googleapis.com", "akamai.com",
    "fastly.com", "amazonaws.com", "microsoft.com", "apple.com",
    "netflix.com", "spotify.com", "discord.com", "slack.com",
  ];
  for (let i = 0; i < 20; i++) {
    const r = seedRand(i + 7, now / 10000);
    const destIdx = Math.floor(r * services.length);
    const protoIdx = Math.floor(seedRand(i + 2, now / 8000) * 4);
    const protos = ["HTTPS", "HTTP", "DNS", "QUIC"];
    const ports = [443, 80, 53, 443];
    flows.push({
      id: `flow-${i}`,
      srcIp: `10.8.${Math.floor(seedRand(i, 0) * 255)}.${Math.floor(seedRand(i + 1, 0) * 255)}`,
      destHost: services[destIdx],
      destPort: ports[protoIdx],
      protocol: protos[protoIdx],
      bytesOut: Math.floor(seedRand(i + 3, now / 5000) * 900_000 + 1000),
      bytesIn: Math.floor(seedRand(i + 4, now / 5000) * 400_000 + 500),
      packetsOut: Math.floor(seedRand(i + 5, now / 5000) * 600 + 10),
      duration: Math.floor(seedRand(i + 6, now / 5000) * 30000 + 500),
      startedAt: new Date(now - Math.floor(seedRand(i, now / 1000) * 120_000)).toISOString(),
      country: COUNTRIES[Math.floor(seedRand(i + 8, 0) * COUNTRIES.length)].code,
      threat: i === 3 ? "suspicious_beacon" : i === 11 ? "known_malware_host" : null,
    });
  }
  return flows;
}

function generateTimeline(hours = 24) {
  const now = Date.now();
  const points = [];
  for (let h = hours; h >= 0; h--) {
    const ts = new Date(now - h * 3_600_000);
    const hour = ts.getHours();
    const isActive = hour >= 8 && hour <= 22;
    const base = isActive ? 4_000_000 : 800_000;
    const r = seedRand(h + 1, now / 100000);
    points.push({
      time: ts.toISOString(),
      bytesIn: Math.floor(base * (0.6 + r * 0.8)),
      bytesOut: Math.floor(base * (0.3 + r * 0.5)),
      connections: Math.floor((isActive ? 80 : 12) * (0.5 + r)),
      blocked: Math.floor(r * 8),
    });
  }
  return points;
}

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const nodes = await db.select({ id: nodesTable.id }).from(nodesTable).limit(50);
    const nodeCount = nodes.length || 3;
    const now = Date.now();
    const r = seedRand(1, now / 60000);

    res.json({
      activeConnections: Math.floor(60 + r * 120),
      totalBytesIn: Math.floor(1_200_000_000 + r * 800_000_000),
      totalBytesOut: Math.floor(480_000_000 + r * 300_000_000),
      packetsPerSecond: Math.floor(800 + r * 1200),
      blockedConnections: Math.floor(12 + r * 30),
      activeNodes: nodeCount,
      threatAlerts: 2,
      peakBandwidthMbps: Math.floor(40 + r * 80),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/flows", (req: Request, res: Response) => {
  const nodes = 3;
  res.json(generateFlows(nodes));
});

router.get("/timeline", (req: Request, res: Response) => {
  const hours = parseInt((req.query.hours as string) || "24");
  res.json(generateTimeline(Math.min(hours, 168)));
});

router.get("/protocols", (req: Request, res: Response) => {
  const now = Date.now();
  const data = PROTOCOLS.map((proto, i) => ({
    protocol: proto,
    bytes: Math.floor(seedRand(i + 1, now / 120000) * 600_000_000 + 10_000_000),
    connections: Math.floor(seedRand(i + 2, now / 120000) * 500 + 5),
    pct: 0,
  }));
  const total = data.reduce((s, d) => s + d.bytes, 0);
  data.forEach(d => { d.pct = Math.round((d.bytes / total) * 1000) / 10; });
  data.sort((a, b) => b.bytes - a.bytes);
  res.json(data);
});

router.get("/countries", (req: Request, res: Response) => {
  const now = Date.now();
  const data = COUNTRIES.map((c, i) => ({
    ...c,
    bytes: Math.floor(seedRand(i + 1, now / 120000) * 400_000_000 + 5_000_000),
    connections: Math.floor(seedRand(i + 3, now / 120000) * 300 + 2),
    blocked: Math.floor(seedRand(i + 5, now / 120000) * 20),
  }));
  data.sort((a, b) => b.bytes - a.bytes);
  res.json(data);
});

export default router;
