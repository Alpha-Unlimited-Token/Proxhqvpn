import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

function generateWgPrivateKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

function generateWgPublicKey(privateKey: string): string {
  return crypto.createHash("sha256").update(privateKey).digest("base64");
}

function randomIp(layer: string, hopIndex: number): string {
  if (layer === "outer") return `10.${Math.floor(hopIndex / 10)}.${hopIndex % 10}.${Math.floor(Math.random() * 254) + 1}`;
  return `172.16.${hopIndex}.${Math.floor(Math.random() * 254) + 1}`;
}

router.get("/", async (req, res) => {
  const { layer } = req.query as { layer?: string };
  let query = db.select().from(nodesTable);
  const nodes = await query;
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
    hasBeacon: z.boolean().optional().default(true),
    hasSpider: z.boolean().optional().default(true),
    hasWorm: z.boolean().optional().default(true),
  }).parse(req.body);

  const existingNodes = await db.select().from(nodesTable).where(eq(nodesTable.layer, body.layer));
  const hopIndex = existingNodes.length + 1;
  const privateKey = generateWgPrivateKey();

  const [node] = await db.insert(nodesTable).values({
    ...body,
    hopIndex,
    ipAddress: randomIp(body.layer, hopIndex),
    publicKey: generateWgPublicKey(privateKey),
    privateKey,
    listenPort: 51820 + hopIndex,
    latencyMs: Math.random() * 80 + 5,
    lastSeen: new Date(),
  }).returning();

  res.status(201).json(node);
});

router.get("/stats/summary", async (req, res) => {
  const nodes = await db.select().from(nodesTable);
  const active = nodes.filter((n) => n.status === "active");
  const avgLatency = nodes.length ? nodes.reduce((s, n) => s + n.latencyMs, 0) / nodes.length : 0;
  res.json({
    totalNodes: nodes.length,
    activeNodes: active.length,
    outerNodes: nodes.filter((n) => n.layer === "outer").length,
    innerNodes: nodes.filter((n) => n.layer === "inner").length,
    avgLatencyMs: Math.round(avgLatency * 10) / 10,
    totalTrafficGb: Math.round(Math.random() * 500 * 100) / 100,
    rotationsToday: Math.floor(Math.random() * 20),
    alertsToday: Math.floor(Math.random() * 8),
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

  const newIp = randomIp(node.layer, node.hopIndex);
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

function randomBatchTag(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

router.post("/:id/replace", async (req, res) => {
  const id = parseInt(req.params.id);
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const newPrivateKey = generateWgPrivateKey();
  const newRegion = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  const newIp = randomIp(node.layer, node.hopIndex);
  const batchTag = randomBatchTag();
  const prefix = node.layer === "outer" ? "GhostNode-OUT" : "GhostNode-IN";
  const newName = `${prefix}-${String(node.hopIndex).padStart(2, "0")}-${batchTag}`;

  const [updated] = await db.update(nodesTable).set({
    name: newName,
    ipAddress: newIp,
    region: newRegion,
    privateKey: newPrivateKey,
    publicKey: generateWgPublicKey(newPrivateKey),
    listenPort: 51820 + node.hopIndex + Math.floor(Math.random() * 50),
    latencyMs: parseFloat((Math.random() * 80 + 3).toFixed(1)),
    status: "active",
    lastSeen: new Date(),
  }).where(eq(nodesTable.id, id)).returning();

  res.json(updated);
});

router.post("/bulk-replace", async (req, res) => {
  const body = z.object({ ids: z.array(z.number()).max(20) }).parse(req.body);
  const results = [];
  for (const id of body.ids) {
    const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
    if (!node) continue;
    const newPrivateKey = generateWgPrivateKey();
    const newRegion = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const newIp = randomIp(node.layer, node.hopIndex);
    const batchTag = randomBatchTag();
    const prefix = node.layer === "outer" ? "GhostNode-OUT" : "GhostNode-IN";
    const newName = `${prefix}-${String(node.hopIndex).padStart(2, "0")}-${batchTag}`;
    const [updated] = await db.update(nodesTable).set({
      name: newName, ipAddress: newIp, region: newRegion,
      privateKey: newPrivateKey, publicKey: generateWgPublicKey(newPrivateKey),
      listenPort: 51820 + node.hopIndex + Math.floor(Math.random() * 50),
      latencyMs: parseFloat((Math.random() * 80 + 3).toFixed(1)),
      status: "active", lastSeen: new Date(),
    }).where(eq(nodesTable.id, id)).returning();
    results.push(updated);
  }
  res.json({ replaced: results.length, nodes: results });
});

router.post("/shuffle-all", async (_req, res) => {
  const allNodes = await db.select().from(nodesTable);
  const now = new Date();
  const updates = allNodes.map((node) => {
    const newIp = randomIp(node.layer, node.hopIndex);
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
