import { Router } from "express";
import { db } from "@workspace/db";
import { firewallRulesTable, firewallStatusTable, blockedIpsTable } from "@workspace/db";
import { eq, sql, lt } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Expired blocked-IP cleanup — runs every 5 minutes ─────────────────────
setInterval(async () => {
  try {
    await db.delete(blockedIpsTable).where(lt(blockedIpsTable.expiresAt, new Date()));
  } catch { /* silent — non-critical maintenance task */ }
}, 5 * 60 * 1000);

async function getOrCreateStatus() {
  const rows = await db.select().from(firewallStatusTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [status] = await db.insert(firewallStatusTable).values({
    enabled: true,
    mode: "stealth",
    packetsBlocked: 0,
    packetsAllowed: 0,
    ispMasqueradeActive: true,
    localhostHidden: true,
    dnsMasked: true,
    lastUpdated: new Date(),
  }).returning();
  return status;
}

router.get("/rules", async (req, res) => {
  const rules = await db.select().from(firewallRulesTable).orderBy(sql`priority ASC`);
  res.json({ rules, total: rules.length, enabledCount: rules.filter((r) => r.enabled).length });
});

router.post("/rules", async (req, res) => {
  const body = z.object({
    name: z.string(),
    direction: z.enum(["inbound", "outbound", "both"]),
    action: z.enum(["allow", "deny", "drop", "reject", "masquerade", "log"]),
    protocol: z.enum(["tcp", "udp", "icmp", "any"]),
    sourceIp: z.string().optional(),
    sourcePort: z.string().optional(),
    destIp: z.string().optional(),
    destPort: z.string().optional(),
    priority: z.number().optional().default(100),
    description: z.string().optional(),
    isIspMasquerade: z.boolean().optional().default(false),
  }).parse(req.body);

  const [rule] = await db.insert(firewallRulesTable).values({
    ...body,
    enabled: true,
    hitCount: 0,
    createdAt: new Date(),
  }).returning();
  res.status(201).json(rule);
});

router.put("/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(),
    direction: z.enum(["inbound", "outbound", "both"]).optional(),
    action: z.enum(["allow", "deny", "drop", "reject", "masquerade", "log"]).optional(),
    protocol: z.enum(["tcp", "udp", "icmp", "any"]).optional(),
    sourceIp: z.string().optional(),
    sourcePort: z.string().optional(),
    destIp: z.string().optional(),
    destPort: z.string().optional(),
    priority: z.number().optional(),
    enabled: z.boolean().optional(),
    description: z.string().optional(),
    isIspMasquerade: z.boolean().optional(),
  }).parse(req.body);

  const [rule] = await db.update(firewallRulesTable).set(body).where(eq(firewallRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  res.json(rule);
});

router.delete("/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(firewallRulesTable).where(eq(firewallRulesTable.id, id));
  res.status(204).send();
});

router.get("/status", async (req, res) => {
  const status = await getOrCreateStatus();
  const rules = await db.select().from(firewallRulesTable);
  const blocked = await db.select().from(blockedIpsTable);
  res.json({
    ...status,
    totalRules: rules.length,
    enabledRules: rules.filter((r) => r.enabled).length,
    blockedIps: blocked.length,
  });
});

router.post("/toggle", async (req, res) => {
  const body = z.object({
    enabled: z.boolean(),
    mode: z.enum(["stealth", "strict", "standard", "learning"]).optional(),
  }).parse(req.body);

  const status = await getOrCreateStatus();
  const [updated] = await db.update(firewallStatusTable)
    .set({ enabled: body.enabled, mode: body.mode ?? status.mode, lastUpdated: new Date() })
    .where(eq(firewallStatusTable.id, status.id))
    .returning();

  const rules = await db.select().from(firewallRulesTable);
  const blocked = await db.select().from(blockedIpsTable);
  res.json({ ...updated, totalRules: rules.length, enabledRules: rules.filter((r) => r.enabled).length, blockedIps: blocked.length });
});

router.get("/blocked-ips", async (req, res) => {
  const blockedIps = await db.select().from(blockedIpsTable).orderBy(sql`blocked_at DESC`);
  res.json({ blockedIps, total: blockedIps.length });
});

router.post("/blocked-ips", async (req, res) => {
  const body = z.object({
    ip: z.string(),
    reason: z.string(),
    expiresInMinutes: z.number().optional(),
  }).parse(req.body);

  const expiresAt = body.expiresInMinutes
    ? new Date(Date.now() + body.expiresInMinutes * 60 * 1000)
    : undefined;

  const [blocked] = await db.insert(blockedIpsTable).values({
    ip: body.ip,
    reason: body.reason,
    autoBlocked: false,
    hitCount: 1,
    blockedAt: new Date(),
    expiresAt,
  }).returning();
  res.status(201).json(blocked);
});

router.post("/blocked-ips/:id/unblock", async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await db.delete(blockedIpsTable).where(eq(blockedIpsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/generate-iptables", async (req, res) => {
  const rules = await db.select().from(firewallRulesTable).where(eq(firewallRulesTable.enabled, true));
  const blocked = await db.select().from(blockedIpsTable);

  const iptablesLines = [
    "# ProxhqVPN Firewall — iptables ruleset",
    "# Generated by ProxhqVPN VPN Management Platform",
    "*filter",
    ":INPUT DROP [0:0]",
    ":FORWARD DROP [0:0]",
    ":OUTPUT ACCEPT [0:0]",
    "-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
    "-A INPUT -i lo -j ACCEPT",
    ...blocked.map((b) => `-A INPUT -s ${b.ip} -j DROP  # ${b.reason}`),
    ...rules.map((r) => {
      const proto = r.protocol !== "any" ? `-p ${r.protocol}` : "";
      const src = r.sourceIp ? `-s ${r.sourceIp}` : "";
      const dst = r.destIp ? `-d ${r.destIp}` : "";
      const dport = r.destPort ? `--dport ${r.destPort}` : "";
      const chain = r.direction === "inbound" ? "INPUT" : r.direction === "outbound" ? "OUTPUT" : "FORWARD";
      const action = r.action === "allow" ? "ACCEPT" : r.action === "log" ? "LOG" : "DROP";
      return `-A ${chain} ${proto} ${src} ${dst} ${dport} -j ${action}  # ${r.name}`.replace(/\s+/g, " ").trim();
    }),
    "COMMIT",
    "*nat",
    ":PREROUTING ACCEPT [0:0]",
    ":OUTPUT ACCEPT [0:0]",
    ":POSTROUTING ACCEPT [0:0]",
    "# ISP + localhost masquerade — hides real IP from internet",
    "-A POSTROUTING -o eth0 -j MASQUERADE",
    "-A POSTROUTING -o wg+ -j MASQUERADE",
    "COMMIT",
  ];

  const nftablesLines = [
    "#!/usr/sbin/nft -f",
    "# ProxhqVPN nftables ruleset",
    "flush ruleset",
    "table inet proxhq {",
    "  chain input { type filter hook input priority 0; policy drop;",
    "    ct state established,related accept",
    "    iif lo accept",
    ...blocked.map((b) => `    ip saddr ${b.ip} drop`),
    "  }",
    "  chain forward { type filter hook forward priority 0; policy drop; }",
    "  chain output { type filter hook output priority 0; policy accept; }",
    "}",
    "table ip nat {",
    "  chain postrouting { type nat hook postrouting priority 100;",
    "    oif eth0 masquerade",
    "    oifname \"wg*\" masquerade",
    "  }",
    "}",
  ];

  const wgMasquerade = [
    "# WireGuard per-hop MASQUERADE — run on each relay node",
    "# Hides source IP at every hop — no single node sees both source and destination",
    "for i in $(seq 0 49); do",
    "  iptables -t nat -A POSTROUTING -o wg${i} -j MASQUERADE",
    "  iptables -t mangle -A PREROUTING -i wg${i} -j MARK --set-mark $((i+1))",
    "  ip rule add fwmark $((i+1)) table $((2000+i))",
    "  ip route add default dev wg${i} table $((2000+i))",
    "done",
  ];

  const portKnockRules = [
    "# Secfense Ghost — Port Knocking (invisible VPN gateway)",
    "# Install knockd: apt install knockknockd",
    "# /etc/knockd.conf:",
    "[opencloseSSH]",
    "  sequence    = 7000,8000,9000",
    "  seq_timeout = 10",
    "  command     = /sbin/iptables -I INPUT -s %IP% -p tcp --dport 51820 -j ACCEPT",
    "  tcpflags    = syn",
    "[closeSSH]",
    "  sequence    = 9000,8000,7000",
    "  seq_timeout = 10",
    "  command     = /sbin/iptables -D INPUT -s %IP% -p tcp --dport 51820 -j ACCEPT",
    "# Default: WireGuard port 51820 is CLOSED to all until knock sequence received",
    "iptables -A INPUT -p tcp --dport 51820 -j DROP",
    "iptables -A INPUT -p udp --dport 51820 -j DROP",
  ];

  res.json({
    iptablesRules: iptablesLines.join("\n"),
    nftablesRules: nftablesLines.join("\n"),
    wireguardMasquerade: wgMasquerade.join("\n"),
    portKnockRules: portKnockRules.join("\n"),
    exportedAt: new Date().toISOString(),
  });
});

export default router;
