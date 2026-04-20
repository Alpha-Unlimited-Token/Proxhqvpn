import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable, beaconAlertsTable } from "@workspace/db";
import { eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

function generateWgPrivateKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

function generateWgPublicKey(privateKey: string): string {
  return crypto.createHash("sha256").update(privateKey).digest("base64");
}

function allocateInternalIp(layer: string, hopIndex: number, existingIps: string[]): string {
  const base = layer === "outer" ? `10.${Math.floor(hopIndex / 10)}.${hopIndex % 10}` : `172.16.${hopIndex}`;
  for (let host = 1; host <= 254; host++) {
    const candidate = `${base}.${host}`;
    if (!existingIps.includes(candidate)) return candidate;
  }
  return `${base}.1`;
}

async function measureLatencyMs(ip: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`ping -c 2 -W 3 ${ip} 2>/dev/null`);
    const match = stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\//);
    if (match) return parseFloat(match[1]);
  } catch {}
  return 0;
}

async function countAlertsToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(beaconAlertsTable)
    .where(gte(beaconAlertsTable.detectedAt, startOfDay));
  return rows[0]?.count ?? 0;
}

router.get("/", async (req, res) => {
  const { layer } = req.query as { layer?: string };
  const nodes = await db.select().from(nodesTable);
  const filtered = layer && layer !== "all" ? nodes.filter((n) => n.layer === layer) : nodes;
  res.json({
    nodes: filtered,
    total: filtered.length,
    outerCount: nodes.filter((n) => n.layer === "outer").length,
    innerCount: nodes.filter((n) => n.layer === "inner").length,
  });
});

router.post("/", async (req, res) => {
  const body = z.object({
    name: z.string(),
    layer: z.enum(["outer", "inner"]),
    region: z.string(),
    publicIp: z.string().ip().optional(),
    hasBeacon: z.boolean().optional().default(true),
    hasSpider: z.boolean().optional().default(true),
    hasWorm: z.boolean().optional().default(true),
  }).parse(req.body);

  const existingNodes = await db.select().from(nodesTable).where(eq(nodesTable.layer, body.layer));
  const hopIndex = existingNodes.length + 1;
  const existingIps = existingNodes.map((n) => n.ipAddress);
  const privateKey = generateWgPrivateKey();
  const internalIp = allocateInternalIp(body.layer, hopIndex, existingIps);

  const latencyMs = body.publicIp ? await measureLatencyMs(body.publicIp) : 0;

  const [node] = await db.insert(nodesTable).values({
    name: body.name,
    layer: body.layer,
    region: body.region,
    hasBeacon: body.hasBeacon,
    hasSpider: body.hasSpider,
    hasWorm: body.hasWorm,
    hopIndex,
    ipAddress: internalIp,
    publicKey: generateWgPublicKey(privateKey),
    privateKey,
    listenPort: 51820 + hopIndex,
    latencyMs,
    lastSeen: new Date(),
  }).returning();

  res.status(201).json(node);
});

router.get("/stats/summary", async (req, res) => {
  const nodes = await db.select().from(nodesTable);
  const active = nodes.filter((n) => n.status === "active");

  const storedLatencies = nodes.filter((n) => n.latencyMs > 0).map((n) => n.latencyMs);
  const avgLatency = storedLatencies.length
    ? storedLatencies.reduce((s, l) => s + l, 0) / storedLatencies.length
    : 0;

  const alertsToday = await countAlertsToday();

  res.json({
    totalNodes: nodes.length,
    activeNodes: active.length,
    outerNodes: nodes.filter((n) => n.layer === "outer").length,
    innerNodes: nodes.filter((n) => n.layer === "inner").length,
    avgLatencyMs: Math.round(avgLatency * 10) / 10,
    totalTrafficGb: 0,
    rotationsToday: 0,
    alertsToday,
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Node not found" });
  res.json(node);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    hasBeacon: z.boolean().optional(),
    hasSpider: z.boolean().optional(),
    hasWorm: z.boolean().optional(),
    region: z.string().optional(),
    publicIp: z.string().ip().optional().nullable(),
    latencyMs: z.number().optional(),
  }).parse(req.body);

  const [node] = await db.update(nodesTable).set(body).where(eq(nodesTable.id, id)).returning();
  if (!node) return res.status(404).json({ error: "Node not found" });
  res.json(node);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(nodesTable).where(eq(nodesTable.id, id));
  res.status(204).send();
});

router.get("/:id/config", async (req, res) => {
  const id = parseInt(req.params.id);
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const allNodes = await db.select().from(nodesTable);
  const peers = allNodes
    .filter((n) => n.id !== node.id)
    .slice(0, 3)
    .map((n) => ({
      publicKey: n.publicKey,
      allowedIps: `${n.ipAddress}/32`,
      endpoint: `${n.ipAddress}:${n.listenPort}`,
    }));

  const configText = `[Interface]
PrivateKey = ${node.privateKey}
Address = ${node.ipAddress}/24
ListenPort = ${node.listenPort}
# Hop ${node.hopIndex} of ${node.layer === "outer" ? 50 : 10} — ${node.layer.toUpperCase()} layer
# Secfense Ghost: port only published post-auth
# Ghostunnel mTLS wrapper active on port ${node.listenPort + 1000}

# Per-hop policy routing table ${2000 + node.hopIndex}
PostUp = ip rule add fwmark ${node.hopIndex} table ${2000 + node.hopIndex}
PostUp = ip route add default dev wg${node.hopIndex - 1} table ${2000 + node.hopIndex}
PostUp = iptables -t nat -A POSTROUTING -o wg${node.hopIndex - 1} -j MASQUERADE
PostDown = ip rule del fwmark ${node.hopIndex} table ${2000 + node.hopIndex}
PostDown = iptables -t nat -D POSTROUTING -o wg${node.hopIndex - 1} -j MASQUERADE

${peers.map((p) => `[Peer]
PublicKey = ${p.publicKey}
AllowedIPs = ${p.allowedIps}
Endpoint = ${p.endpoint}
PersistentKeepalive = 25`).join("\n\n")}`;

  const routingTable = `ip rule add fwmark ${node.hopIndex} table ${2000 + node.hopIndex}
ip route add default dev wg${node.hopIndex - 1} table ${2000 + node.hopIndex}
ip route flush cache`;

  const iptablesRules = `# Hop ${node.hopIndex} MASQUERADE — hides source IP at each relay
iptables -t nat -A POSTROUTING -o wg${node.hopIndex - 1} -j MASQUERADE
iptables -t mangle -A PREROUTING -i wg${node.hopIndex} -j MARK --set-mark ${node.hopIndex}
# ISP masquerade — hides local host and ISP address
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT`;

  res.json({ nodeId: id, configText, peers, routingTable, iptablesRules });
});

router.post("/:id/rotate-ip", async (req, res) => {
  const id = parseInt(req.params.id);
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const allNodes = await db.select().from(nodesTable);
  const existingIps = allNodes.filter((n) => n.id !== id).map((n) => n.ipAddress);
  const newIp = allocateInternalIp(node.layer, node.hopIndex, existingIps);

  const [updated] = await db.update(nodesTable)
    .set({ ipAddress: newIp, status: "active", lastSeen: new Date() })
    .where(eq(nodesTable.id, id))
    .returning();

  res.json(updated);
});

const REGIONS = [
  "US-East","US-West","US-Central","EU-West","EU-Central","EU-North",
  "EU-East","AP-Tokyo","AP-Seoul","AP-Singapore","AP-Sydney","AP-Mumbai",
  "SA-Brazil","AF-Johannesburg","ME-Dubai","CA-Toronto","UK-London",
  "DE-Frankfurt","NL-Amsterdam","SE-Stockholm","CH-Zurich","JP-Osaka",
];

router.post("/:id/replace", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    region: z.string().optional(),
    publicIp: z.string().optional(),
  }).optional().default({});
  const parsed = body.parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const allNodes = await db.select().from(nodesTable);
  const existingIps = allNodes.filter((n) => n.id !== id).map((n) => n.ipAddress);

  const newPrivateKey = generateWgPrivateKey();
  const regionPool = parsed.region ? [parsed.region] : REGIONS;
  const newRegion = regionPool[node.hopIndex % regionPool.length];
  const newIp = allocateInternalIp(node.layer, node.hopIndex, existingIps);
  const batchTag = crypto.randomBytes(2).toString("hex").toUpperCase();
  const prefix = node.layer === "outer" ? "GhostNode-OUT" : "GhostNode-IN";
  const newName = `${prefix}-${String(node.hopIndex).padStart(2, "0")}-${batchTag}`;

  const latencyMs = parsed.publicIp ? await measureLatencyMs(parsed.publicIp) : node.latencyMs;

  const [updated] = await db.update(nodesTable).set({
    name: newName,
    ipAddress: newIp,
    region: newRegion,
    privateKey: newPrivateKey,
    publicKey: generateWgPublicKey(newPrivateKey),
    listenPort: 51820 + node.hopIndex,
    latencyMs,
    status: "active",
    lastSeen: new Date(),
  }).where(eq(nodesTable.id, id)).returning();

  res.json(updated);
});

router.post("/bulk-replace", async (req, res) => {
  const body = z.object({ ids: z.array(z.number()).max(20) }).parse(req.body);
  const allNodes = await db.select().from(nodesTable);
  const existingIpMap = new Map(allNodes.map((n) => [n.id, n.ipAddress]));

  const results = [];
  for (const id of body.ids) {
    const node = allNodes.find((n) => n.id === id);
    if (!node) continue;

    const usedIps = [...existingIpMap.values()].filter((_, i) => allNodes[i]?.id !== id);
    const newIp = allocateInternalIp(node.layer, node.hopIndex, usedIps);
    existingIpMap.set(id, newIp);

    const newPrivateKey = generateWgPrivateKey();
    const newRegion = REGIONS[node.hopIndex % REGIONS.length];
    const batchTag = crypto.randomBytes(2).toString("hex").toUpperCase();
    const prefix = node.layer === "outer" ? "GhostNode-OUT" : "GhostNode-IN";
    const newName = `${prefix}-${String(node.hopIndex).padStart(2, "0")}-${batchTag}`;

    const [updated] = await db.update(nodesTable).set({
      name: newName, ipAddress: newIp, region: newRegion,
      privateKey: newPrivateKey, publicKey: generateWgPublicKey(newPrivateKey),
      listenPort: 51820 + node.hopIndex,
      latencyMs: node.latencyMs,
      status: "active", lastSeen: new Date(),
    }).where(eq(nodesTable.id, id)).returning();
    results.push(updated);
  }
  res.json({ replaced: results.length, nodes: results });
});

router.post("/shuffle-all", async (_req, res) => {
  const allNodes = await db.select().from(nodesTable);
  const now = new Date();
  const usedIps: string[] = [];

  const updates = allNodes.map((node) => {
    const newIp = allocateInternalIp(node.layer, node.hopIndex, usedIps);
    usedIps.push(newIp);
    return db
      .update(nodesTable)
      .set({ ipAddress: newIp, status: "active", lastSeen: now })
      .where(eq(nodesTable.id, node.id))
      .returning();
  });
  const results = await Promise.all(updates);
  const updated = results.map((r) => r[0]).filter(Boolean);
  res.json({ shuffled: updated.length, timestamp: now.toISOString() });
});

export default router;
