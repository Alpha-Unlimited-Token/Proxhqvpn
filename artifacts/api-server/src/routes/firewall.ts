// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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

// GET /api/firewall/audit-exemptions
// Returns pre-built iptables/nftables/WireGuard rules that exempt audit-tagged tool
// traffic (fwmark 0x5050) from the kill switch — distinguishes tools from real attacks
router.get("/audit-exemptions", (_req, res) => {
  const fwmark = "0x5050";
  const iptablesRules = [
    `# ProxhqVPN Audit Exemption — iptables`,
    `# Audit fwmark ${fwmark} is set by the API server on all outbound security tool requests.`,
    `# Marked traffic bypasses the kill switch so tools can operate through the VPN tunnel.`,
    ``,
    `# Allow audit-marked outbound traffic through the kill switch`,
    `iptables -A OUTPUT -m mark --mark ${fwmark} -j ACCEPT`,
    ``,
    `# Allow established/related inbound (responses to tool requests)`,
    `iptables -A INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`,
    ``,
    `# Block anything else inbound that is NOT an established session (real attacks)`,
    `iptables -A INPUT  -m conntrack --ctstate INVALID -j DROP`,
  ].join("\n");

  const nftablesRules = [
    `#!/usr/sbin/nft -f`,
    `# ProxhqVPN Audit Exemption — nftables`,
    `table inet proxhq_audit {`,
    `  chain output {`,
    `    type filter hook output priority filter;`,
    `    meta mark ${fwmark} accept comment "audit-tagged tool traffic"`,
    `  }`,
    `  chain input {`,
    `    type filter hook input priority filter;`,
    `    ct state established,related accept comment "responses to audit sessions"`,
    `    ct state invalid drop comment "block invalid — real attacks"`,
    `  }`,
    `}`,
  ].join("\n");

  const wireguardPostUp = `PostUp = iptables -A OUTPUT -m mark --mark ${fwmark} -j ACCEPT; iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`;
  const wireguardPostDown = `PostDown = iptables -D OUTPUT -m mark --mark ${fwmark} -j ACCEPT 2>/dev/null; iptables -D INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null`;

  const classificationRules = {
    auditTraffic: {
      detection: `Header X-Proxhq-Audit-Session: <userId>:<sessionId> present and valid`,
      severity: "info",
      action: "log only — do not block",
      fwmark,
    },
    attackTraffic: {
      detection: "No audit session header, or header fails validation",
      severity: "low → critical based on probe type",
      action: "block + alert + honeypot trap if SilkWeb active",
    },
  };

  res.json({
    description: "Rules to allow ProxhqVPN security tools through the kill switch without being blocked. Audit traffic is tagged with fwmark 0x5050 at the API layer before packets leave the server.",
    auditFwmark: fwmark,
    iptablesRules,
    nftablesRules,
    wireguardPostUp,
    wireguardPostDown,
    classificationRules,
    setupInstructions: [
      "1. Apply iptables rules above on your VPN server (run as root).",
      "2. If using WireGuard kill switch, add PostUp/PostDown lines to your [Interface] block.",
      "3. All ProxhqVPN security tool traffic is automatically tagged — no client changes needed.",
      "4. Untagged inbound traffic is still processed normally and triggers beacon alerts if suspicious.",
      "5. To verify: run 'iptables -L -n -v | grep AUDIT' — you should see the rule with hit counters.",
    ],
    generatedAt: new Date().toISOString(),
  });
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
