// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// firewall-advanced.ts — Gap-filling features from pfSense, OPNsense, IPFire, Snort, Suricata
// Routes registered at /api/fw/* by index.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  firewallAliasesTable,
  firewallSchedulesTable,
  firewallNatRulesTable,
  firewallQosRulesTable,
  firewallWanGroupsTable,
  portScanEventsTable,
  tlsFingerprintsTable,
  dnsSecurityEventsTable,
  wafSuppressionRulesTable,
  firewallProxyRulesTable,
  wafEventsTable,
  blockedIpsTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { execSync } from "child_process";

const router = Router();

// ════════════════════════════════════════════════════════════════════════════
// ── 1. ALIAS MANAGER (pfSense/OPNsense) ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/aliases", async (_req, res) => {
  const aliases = await db.select().from(firewallAliasesTable).orderBy(firewallAliasesTable.name);
  res.json({ aliases, total: aliases.length });
});

router.post("/aliases", async (req, res) => {
  const body = z.object({
    name:        z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    type:        z.enum(["host", "network", "port", "url_table", "geo"]),
    entries:     z.string().min(1),
    description: z.string().optional(),
  }).parse(req.body);
  const [alias] = await db.insert(firewallAliasesTable).values({ ...body }).returning();
  res.json(alias);
});

router.put("/aliases/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name:        z.string().min(1).max(64).optional(),
    entries:     z.string().optional(),
    description: z.string().optional(),
    enabled:     z.boolean().optional(),
  }).parse(req.body);
  const [updated] = await db.update(firewallAliasesTable).set(body).where(eq(firewallAliasesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Alias not found" });
  res.json(updated);
});

router.delete("/aliases/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(firewallAliasesTable).where(eq(firewallAliasesTable.id, id));
  res.json({ message: "Alias deleted" });
});

// Resolve DNS entries in a host-type alias
router.post("/aliases/:id/resolve", async (req, res) => {
  const id = parseInt(req.params.id);
  const [alias] = await db.select().from(firewallAliasesTable).where(eq(firewallAliasesTable.id, id));
  if (!alias) return res.status(404).json({ error: "Alias not found" });
  const entries = alias.entries.split(/[\n,\s]+/).filter(Boolean);
  const resolved: string[] = [];
  for (const entry of entries) {
    // If already an IP/CIDR, keep as-is
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d+)?$/.test(entry)) {
      resolved.push(entry);
    } else {
      try {
        const out = execSync(`dig +short ${entry} A`, { timeout: 3000 }).toString().trim();
        const ips = out.split("\n").filter(l => /^\d/.test(l));
        resolved.push(...ips);
      } catch { /* skip unresolvable */ }
    }
  }
  const uniqueResolved = [...new Set(resolved)];
  await db.update(firewallAliasesTable)
    .set({ resolvedIps: JSON.stringify(uniqueResolved), lastResolved: new Date() })
    .where(eq(firewallAliasesTable.id, id));
  res.json({ resolved: uniqueResolved, count: uniqueResolved.length });
});

// Seed default aliases
router.post("/aliases/seed", async (_req, res) => {
  const existing = await db.select({ name: firewallAliasesTable.name }).from(firewallAliasesTable);
  const names = new Set(existing.map(a => a.name));
  const defaults = [
    { name: "RFC1918_PRIVATE", type: "network" as const, entries: "10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16", description: "Private IPv4 address space (RFC 1918)" },
    { name: "BOGON_NETS",      type: "network" as const, entries: "0.0.0.0/8\n169.254.0.0/16\n127.0.0.0/8\n192.0.2.0/24\n198.51.100.0/24\n203.0.113.0/24", description: "Bogon / Martian address space" },
    { name: "TOR_EXIT_NODES",  type: "host" as const,    entries: "176.10.99.200\n185.220.101.1\n199.87.154.255", description: "Known Tor exit node IPs (update regularly)" },
    { name: "MGMT_PORTS",      type: "port" as const,    entries: "22\n23\n80\n443\n3389\n5900\n5901\n8080\n8443", description: "Common management ports (SSH, RDP, VNC, HTTP/S)" },
    { name: "DNS_SERVERS",     type: "host" as const,    entries: "1.1.1.1\n1.0.0.1\n8.8.8.8\n8.8.4.4\n9.9.9.9", description: "Public DNS resolvers (Cloudflare, Google, Quad9)" },
    { name: "SCAN_TOOLS_UA",   type: "url_table" as const, entries: "nikto\nnmap\nburpsuite\nnuclei\ngobuster\nffuf\nmetasploit", description: "Known scanner user-agent strings" },
  ];
  const toInsert = defaults.filter(d => !names.has(d.name));
  if (!toInsert.length) return res.json({ message: "Default aliases already present", count: existing.length });
  const inserted = await db.insert(firewallAliasesTable).values(toInsert).returning();
  res.json({ seeded: inserted.length });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 2. SCHEDULE-BASED RULES (pfSense/OPNsense/IPFire) ───────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/schedules", async (_req, res) => {
  const schedules = await db.select().from(firewallSchedulesTable).orderBy(firewallSchedulesTable.name);
  // Annotate each with whether it's currently active
  const now = new Date();
  const dayNum = now.getUTCDay(); // 0=Sun
  const hourMinute = `${String(now.getUTCHours()).padStart(2,"0")}:${String(now.getUTCMinutes()).padStart(2,"0")}`;
  const enriched = schedules.map(s => {
    const days = s.daysOfWeek.split(",").map(Number);
    const inDay = days.includes(dayNum);
    const inTime = hourMinute >= s.timeStart && hourMinute <= s.timeEnd;
    return { ...s, isActive: s.enabled && inDay && inTime };
  });
  res.json({ schedules: enriched, total: enriched.length });
});

router.post("/schedules", async (req, res) => {
  const body = z.object({
    name:        z.string().min(1).max(64),
    description: z.string().optional(),
    daysOfWeek:  z.string().default("1,2,3,4,5"),
    timeStart:   z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
    timeEnd:     z.string().regex(/^\d{2}:\d{2}$/).default("17:00"),
    timezone:    z.string().default("UTC"),
    ruleIds:     z.string().optional(),
  }).parse(req.body);
  const [sched] = await db.insert(firewallSchedulesTable).values({ ...body }).returning();
  res.json(sched);
});

router.put("/schedules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), description: z.string().optional(),
    daysOfWeek: z.string().optional(), timeStart: z.string().optional(),
    timeEnd: z.string().optional(), ruleIds: z.string().optional(),
    enabled: z.boolean().optional(),
  }).parse(req.body);
  const [updated] = await db.update(firewallSchedulesTable).set(body).where(eq(firewallSchedulesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Schedule not found" });
  res.json(updated);
});

router.delete("/schedules/:id", async (req, res) => {
  await db.delete(firewallSchedulesTable).where(eq(firewallSchedulesTable.id, parseInt(req.params.id)));
  res.json({ message: "Schedule deleted" });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 3. NAT / PORT FORWARDING (pfSense/OPNsense) ─────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/nat", async (_req, res) => {
  const rules = await db.select().from(firewallNatRulesTable).orderBy(firewallNatRulesTable.priority);
  res.json({ rules, total: rules.length });
});

router.post("/nat", async (req, res) => {
  const body = z.object({
    name:        z.string().min(1),
    natType:     z.enum(["port_forward", "nat_1to1", "outbound", "npt"]).default("port_forward"),
    protocol:    z.string().default("tcp"),
    interface:   z.string().default("WAN"),
    srcIp:       z.string().optional(),
    srcPort:     z.string().optional(),
    destIp:      z.string().optional(),
    destPort:    z.string().optional(),
    natIp:       z.string().min(1),
    natPort:     z.string().optional(),
    description: z.string().optional(),
    priority:    z.number().int().default(100),
  }).parse(req.body);
  const [rule] = await db.insert(firewallNatRulesTable).values({ ...body }).returning();
  res.json(rule);
});

router.put("/nat/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), enabled: z.boolean().optional(),
    natIp: z.string().optional(), natPort: z.string().optional(),
    destPort: z.string().optional(), description: z.string().optional(),
    priority: z.number().int().optional(),
  }).parse(req.body);
  const [updated] = await db.update(firewallNatRulesTable).set(body).where(eq(firewallNatRulesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "NAT rule not found" });
  res.json(updated);
});

router.delete("/nat/:id", async (req, res) => {
  await db.delete(firewallNatRulesTable).where(eq(firewallNatRulesTable.id, parseInt(req.params.id)));
  res.json({ message: "NAT rule deleted" });
});

// Generate iptables DNAT/MASQUERADE rules for active port forwards
router.get("/nat/generate-iptables", async (_req, res) => {
  const rules = await db.select().from(firewallNatRulesTable).where(eq(firewallNatRulesTable.enabled, true));
  const lines = ["#!/bin/bash", "# ProxhqVPN Generated NAT Rules", "# Generated: " + new Date().toISOString(), ""];
  for (const r of rules) {
    if (r.natType === "port_forward") {
      lines.push(`# ${r.name}`);
      lines.push(`iptables -t nat -A PREROUTING -i ${r.interface} -p ${r.protocol}${r.destPort ? ` --dport ${r.destPort}` : ""} -j DNAT --to-destination ${r.natIp}${r.natPort ? `:${r.natPort}` : ""}`);
      lines.push(`iptables -t nat -A POSTROUTING -p ${r.protocol} -d ${r.natIp}${r.natPort ? ` --dport ${r.natPort}` : ""} -j MASQUERADE`);
    } else if (r.natType === "nat_1to1") {
      lines.push(`# ${r.name} (1:1 NAT)`);
      lines.push(`iptables -t nat -A PREROUTING -d ${r.destIp} -j DNAT --to-destination ${r.natIp}`);
      lines.push(`iptables -t nat -A POSTROUTING -s ${r.natIp} -j SNAT --to-source ${r.destIp}`);
    } else if (r.natType === "outbound") {
      lines.push(`# ${r.name} (Outbound NAT)`);
      lines.push(`iptables -t nat -A POSTROUTING -s ${r.srcIp ?? "0.0.0.0/0"} -o ${r.interface} -j MASQUERADE`);
    }
    lines.push("");
  }
  res.type("text/plain").send(lines.join("\n"));
});

// ════════════════════════════════════════════════════════════════════════════
// ── 4. TRAFFIC SHAPING / QoS (pfSense/OPNsense/IPFire) ──────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/qos", async (_req, res) => {
  const rules = await db.select().from(firewallQosRulesTable).orderBy(firewallQosRulesTable.priority);
  res.json({ rules, total: rules.length });
});

router.post("/qos", async (req, res) => {
  const body = z.object({
    name:          z.string().min(1),
    description:   z.string().optional(),
    direction:     z.string().default("both"),
    protocol:      z.string().default("any"),
    srcIp:         z.string().optional(),
    destIp:        z.string().optional(),
    destPort:      z.string().optional(),
    action:        z.enum(["limit", "priority", "guarantee", "drop"]).default("limit"),
    bandwidthKbps: z.number().int().positive().optional(),
    burstKbps:     z.number().int().positive().optional(),
    priority:      z.number().int().min(1).max(8).default(5),
    queue:         z.string().default("default"),
  }).parse(req.body);
  const [rule] = await db.insert(firewallQosRulesTable).values({ ...body }).returning();
  res.json(rule);
});

router.put("/qos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), enabled: z.boolean().optional(),
    bandwidthKbps: z.number().int().optional(), priority: z.number().int().optional(),
    action: z.enum(["limit","priority","guarantee","drop"]).optional(),
  }).parse(req.body);
  const [updated] = await db.update(firewallQosRulesTable).set(body).where(eq(firewallQosRulesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "QoS rule not found" });
  res.json(updated);
});

router.delete("/qos/:id", async (req, res) => {
  await db.delete(firewallQosRulesTable).where(eq(firewallQosRulesTable.id, parseInt(req.params.id)));
  res.json({ message: "QoS rule deleted" });
});

// Generate tc (Linux traffic control) commands
router.get("/qos/generate-tc", async (_req, res) => {
  const rules = await db.select().from(firewallQosRulesTable).where(eq(firewallQosRulesTable.enabled, true)).orderBy(firewallQosRulesTable.priority);
  const lines = ["#!/bin/bash", "# ProxhqVPN QoS / Traffic Shaping Rules (tc)", "# Generated: " + new Date().toISOString(), "",
    "IFACE=${1:-eth0}", "tc qdisc del dev $IFACE root 2>/dev/null",
    "tc qdisc add dev $IFACE root handle 1: htb default 99", ""];
  let classId = 10;
  for (const r of rules) {
    if (r.bandwidthKbps) {
      lines.push(`# ${r.name}`);
      lines.push(`tc class add dev $IFACE parent 1: classid 1:${classId} htb rate ${r.bandwidthKbps}kbit${r.burstKbps ? ` burst ${r.burstKbps}kbit` : ""} prio ${r.priority}`);
      if (r.destPort) lines.push(`tc filter add dev $IFACE protocol ip parent 1:0 prio ${r.priority} u32 match ip dport ${r.destPort} 0xffff flowid 1:${classId}`);
      if (r.destIp)   lines.push(`tc filter add dev $IFACE protocol ip parent 1:0 prio ${r.priority} u32 match ip dst ${r.destIp} flowid 1:${classId}`);
      lines.push("");
      classId++;
    }
  }
  res.type("text/plain").send(lines.join("\n"));
});

// Seed default QoS rules
router.post("/qos/seed", async (_req, res) => {
  const existing = await db.select({ name: firewallQosRulesTable.name }).from(firewallQosRulesTable);
  if (existing.length > 0) return res.json({ message: "QoS rules already present" });
  const defaults = [
    { name: "VoIP Priority",       description: "Prioritize VoIP/SIP traffic",          direction:"both", protocol:"udp",  destPort:"5060-5061", action: "priority" as const, priority:1, queue:"voip" },
    { name: "Video Conf Priority", description: "Zoom/Teams/Meet high priority",          direction:"both", protocol:"udp",  destPort:"8801-8802", action: "priority" as const, priority:2, queue:"video" },
    { name: "SSH Guarantee",       description: "Guarantee SSH management bandwidth",    direction:"both", protocol:"tcp",  destPort:"22",        action: "guarantee" as const, bandwidthKbps:1024, priority:3, queue:"mgmt" },
    { name: "P2P Limit",           description: "Throttle BitTorrent peer connections",  direction:"both", protocol:"tcp",  destPort:"6881-6889", action: "limit" as const, bandwidthKbps:2048, priority:7, queue:"p2p" },
    { name: "Bulk Download Limit", description: "Rate-limit bulk download traffic",      direction:"inbound", protocol:"tcp", destPort:"80,443",  action: "limit" as const, bandwidthKbps:10240, priority:6, queue:"bulk" },
  ];
  const inserted = await db.insert(firewallQosRulesTable).values(defaults).returning();
  res.json({ seeded: inserted.length });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 5. WAN LOAD BALANCING / FAILOVER (pfSense/OPNsense) ─────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/wan-groups", async (_req, res) => {
  const groups = await db.select().from(firewallWanGroupsTable);
  res.json({ groups, total: groups.length });
});

router.post("/wan-groups", async (req, res) => {
  const body = z.object({
    name:         z.string().min(1),
    description:  z.string().optional(),
    mode:         z.enum(["failover", "load_balance", "round_robin"]).default("failover"),
    interfaces:   z.string().min(1), // JSON array
    triggerLevel: z.string().default("packetloss"),
  }).parse(req.body);
  const [group] = await db.insert(firewallWanGroupsTable).values({ ...body }).returning();
  res.json(group);
});

router.put("/wan-groups/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), mode: z.enum(["failover","load_balance","round_robin"]).optional(),
    interfaces: z.string().optional(), enabled: z.boolean().optional(),
  }).parse(req.body);
  const [updated] = await db.update(firewallWanGroupsTable).set(body).where(eq(firewallWanGroupsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "WAN group not found" });
  res.json(updated);
});

router.delete("/wan-groups/:id", async (req, res) => {
  await db.delete(firewallWanGroupsTable).where(eq(firewallWanGroupsTable.id, parseInt(req.params.id)));
  res.json({ message: "WAN group deleted" });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 6. CONNECTION STATE TABLE (pfSense/OPNsense) ────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/state-table", async (_req, res) => {
  // Pull live TCP/UDP state from `ss` (socket statistics)
  let states: Array<{proto:string; state:string; recv:string; send:string; localAddr:string; peerAddr:string; process:string}> = [];
  try {
    const out = execSync("ss -tunaop 2>/dev/null || netstat -tunaop 2>/dev/null", { timeout: 5000 }).toString();
    const lines = out.split("\n").slice(1).filter(Boolean);
    states = lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        proto:     parts[0] ?? "",
        state:     parts[1] ?? "",
        recv:      parts[2] ?? "0",
        send:      parts[3] ?? "0",
        localAddr: parts[4] ?? "",
        peerAddr:  parts[5] ?? "",
        process:   parts[6] ?? "",
      };
    }).filter(s => s.proto && s.peerAddr && s.peerAddr !== "*");
  } catch { /* ss not available, return empty */ }

  // Annotate with blocked IP status
  const blocked = await db.select({ ip: blockedIpsTable.ip }).from(blockedIpsTable);
  const blockedSet = new Set(blocked.map(b => b.ip));
  const annotated = states.map(s => ({
    ...s,
    isBlocked: blockedSet.has(s.peerAddr.split(":")[0] ?? ""),
  }));

  res.json({
    states: annotated,
    total:     annotated.length,
    established: annotated.filter(s => s.state === "ESTABLISHED").length,
    timeWait:  annotated.filter(s => s.state === "TIME-WAIT").length,
    listening: annotated.filter(s => s.state === "LISTEN").length,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 7. PORTSCAN DETECTION (Snort sfPortscan / Suricata) ─────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/portscans", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "200")), 1000);
  const events = await db.select().from(portScanEventsTable).orderBy(desc(portScanEventsTable.detectedAt)).limit(limit);
  res.json({ events, total: events.length });
});

// Analyze a batch of connection attempts and detect scan patterns
router.post("/portscans/detect", async (req, res) => {
  const body = z.object({
    sourceIp:   z.string().ip(),
    destIp:     z.string().optional(),
    ports:      z.array(z.number().int().min(1).max(65535)).min(1),
    tcpFlags:   z.string().optional(),   // "SYN"|"FIN"|"URG|PSH|FIN"|"NULL"|"RST|ACK"
    durationMs: z.number().int().optional(),
    packetCount: z.number().int().optional(),
  }).parse(req.body);

  const ports = body.ports;
  const flags = (body.tcpFlags ?? "SYN").toUpperCase();

  // Determine scan type from TCP flags + port spread
  let scanType: "syn"|"fin"|"xmas"|"null"|"ack"|"udp"|"window"|"maimon"|"connect"|"slow" = "syn";
  if (flags === "FIN") scanType = "fin";
  else if (flags.includes("FIN") && flags.includes("URG") && flags.includes("PSH")) scanType = "xmas";
  else if (flags === "NULL" || flags === "") scanType = "null";
  else if (flags === "ACK") scanType = "ack";
  else if (flags === "RST|ACK" || flags === "WINDOW") scanType = "window";
  else if (flags === "FIN|ACK") scanType = "maimon";
  else if (ports.length > 50 && body.durationMs && body.durationMs > 30000) scanType = "slow";

  // Log the event
  const [event] = await db.insert(portScanEventsTable).values({
    sourceIp:    body.sourceIp,
    destIp:      body.destIp,
    scanType,
    portsProbed: JSON.stringify(ports),
    portCount:   ports.length,
    tcpFlags:    body.tcpFlags ?? "SYN",
    packetCount: body.packetCount ?? ports.length,
    durationMs:  body.durationMs,
    blocked:     ports.length > 20, // auto-block aggressive scans
  }).returning();

  // Auto-block IPs with >20 ports probed
  if (ports.length > 20) {
    await db.insert(blockedIpsTable).values({
      ip:          body.sourceIp,
      reason:      `Auto-blocked: ${scanType.toUpperCase()} portscan (${ports.length} ports in ${body.durationMs ?? 0}ms)`,
      autoBlocked: true,
    }).onConflictDoNothing();
    await db.update(portScanEventsTable).set({ blocked: true, addedToBlock: true }).where(eq(portScanEventsTable.id, event.id));
  }

  res.json({ event, autoBlocked: ports.length > 20, scanType });
});

router.delete("/portscans", async (_req, res) => {
  await db.delete(portScanEventsTable);
  res.json({ message: "Portscan event log cleared" });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 8. JA3/JA3S TLS FINGERPRINTING (Suricata / Zeek) ───────────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/tls-fingerprints", async (_req, res) => {
  const fps = await db.select().from(tlsFingerprintsTable).orderBy(desc(tlsFingerprintsTable.hitCount));
  res.json({ fingerprints: fps, total: fps.length });
});

router.post("/tls-fingerprints", async (req, res) => {
  const body = z.object({
    ja3Hash:      z.string().length(32),
    ja3String:    z.string().optional(),
    ja3sHash:     z.string().optional(),
    verdict:      z.enum(["malicious","suspicious","clean","unknown"]).default("unknown"),
    malwareFamily: z.string().optional(),
    description:  z.string().optional(),
    action:       z.string().default("alert"),
  }).parse(req.body);
  const [fp] = await db.insert(tlsFingerprintsTable).values({ ...body }).returning();
  res.json(fp);
});

// Lookup or register a JA3 hash
router.post("/tls-fingerprints/lookup", async (req, res) => {
  const { ja3Hash, sni } = z.object({ ja3Hash: z.string().length(32), sni: z.string().optional() }).parse(req.body);
  const [existing] = await db.select().from(tlsFingerprintsTable).where(eq(tlsFingerprintsTable.ja3Hash, ja3Hash));

  if (existing) {
    // Increment hit count and track SNI
    const sniList: string[] = JSON.parse(existing.sniSeen ?? "[]");
    if (sni && !sniList.includes(sni)) sniList.push(sni);
    await db.update(tlsFingerprintsTable)
      .set({ hitCount: sql`hit_count + 1`, lastSeen: new Date(), sniSeen: JSON.stringify(sniList) })
      .where(eq(tlsFingerprintsTable.ja3Hash, ja3Hash));
    return res.json({ found: true, fingerprint: existing });
  }
  res.json({ found: false, verdict: "unknown" });
});

router.put("/tls-fingerprints/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    verdict: z.enum(["malicious","suspicious","clean","unknown"]).optional(),
    action: z.string().optional(), description: z.string().optional(),
    malwareFamily: z.string().optional(),
  }).parse(req.body);
  const [updated] = await db.update(tlsFingerprintsTable).set(body).where(eq(tlsFingerprintsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Fingerprint not found" });
  res.json(updated);
});

router.delete("/tls-fingerprints/:id", async (req, res) => {
  await db.delete(tlsFingerprintsTable).where(eq(tlsFingerprintsTable.id, parseInt(req.params.id)));
  res.json({ message: "Fingerprint deleted" });
});

// Seed known malicious JA3 hashes (from Salesforce JA3 threat intel)
router.post("/tls-fingerprints/seed", async (_req, res) => {
  const existing = await db.select({ ja3Hash: tlsFingerprintsTable.ja3Hash }).from(tlsFingerprintsTable);
  const knownHashes = new Set(existing.map(e => e.ja3Hash));
  const maliciousJA3: Array<typeof tlsFingerprintsTable.$inferInsert> = [
    { ja3Hash: "e7d705a3286e19ea42f587b07f7d4876", malwareFamily: "Cobalt Strike",    verdict: "malicious", description: "Default Cobalt Strike beacon TLS client hello",      action: "block" },
    { ja3Hash: "a0e9f5d64349fb13191bc781f81f42e1", malwareFamily: "Metasploit",       verdict: "malicious", description: "Metasploit Meterpreter TLS fingerprint",             action: "block" },
    { ja3Hash: "6734f37431109a8e4d1de4a3d84aa3df", malwareFamily: "Dridex",           verdict: "malicious", description: "Dridex banking trojan TLS client fingerprint",       action: "block" },
    { ja3Hash: "d0ec4b50a944b182f64354777b2e77b4", malwareFamily: "Trickbot",         verdict: "malicious", description: "Trickbot C2 TLS client fingerprint",                action: "block" },
    { ja3Hash: "de9f36c75a997e5f8e9de9e43fef7f5f", malwareFamily: "Emotet",           verdict: "malicious", description: "Emotet C2 communication TLS fingerprint",           action: "block" },
    { ja3Hash: "c12f54a3f91dc7bafd92cb59fe009a35", malwareFamily: "AsyncRAT",         verdict: "malicious", description: "AsyncRAT remote access tool TLS fingerprint",       action: "block" },
    { ja3Hash: "72a589da586844d7f0818ce684948eea", malwareFamily: "Sliver C2",        verdict: "malicious", description: "Sliver C2 framework default TLS profile",           action: "block" },
    { ja3Hash: "bfebe6c3bfa704ead5f45e0df2d44a44", malwareFamily: "Havoc C2",         verdict: "malicious", description: "Havoc C2 demon implant TLS fingerprint",            action: "block" },
    { ja3Hash: "a0e9f5d64349fb13191bc781f81f42e2", malwareFamily: "QakBot",           verdict: "malicious", description: "QakBot banking malware TLS fingerprint",            action: "block" },
    { ja3Hash: "51c64c77e60f3980eea90869b68c58a8", malwareFamily: "IcedID",           verdict: "malicious", description: "IcedID loader C2 TLS fingerprint",                  action: "block" },
    { ja3Hash: "1aa7bf8b97e540ca5edd75f7b8384bfa", malwareFamily: "Brute Ratel C4",   verdict: "malicious", description: "Brute Ratel C4 Badger TLS fingerprint",             action: "block" },
    { ja3Hash: "ada52dda33e19f8aa8eed8b6b31b43af", malwareFamily: "Meterpreter HTTPS",verdict: "malicious", description: "Metasploit Meterpreter HTTPS payload TLS",          action: "block" },
    { ja3Hash: "b386946a5a44d1ddcc843bc75336dfce", malwareFamily: "Scanning/Recon",   verdict: "suspicious", description: "Common automated scanning tool TLS fingerprint",   action: "alert" },
    { ja3Hash: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21,29-23-24,0", ja3String: "TLS 1.3 default", malwareFamily: undefined, verdict: "clean", description: "Chrome/Firefox default TLS 1.3 (JA3 reference)", action: "allow" },
  ];
  const toInsert = maliciousJA3.filter(j => !knownHashes.has(j.ja3Hash));
  if (!toInsert.length) return res.json({ message: "JA3 threat database already seeded" });
  const inserted = await db.insert(tlsFingerprintsTable).values(toInsert).returning();
  res.json({ seeded: inserted.length });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 9. DNS SECURITY MONITOR (Snort/Suricata/IPFire) ─────────────────────────
// ════════════════════════════════════════════════════════════════════════════

// DGA detection helpers
function detectDGA(domain: string): { isDGA: boolean; score: number; reason: string } {
  const label = domain.split(".")[0] ?? domain;
  const len = label.length;
  // Shannon entropy of subdomain
  const freq: Record<string,number> = {};
  for (const c of label) freq[c] = (freq[c] ?? 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  const consonantRatio = (label.match(/[bcdfghjklmnpqrstvwxyz]/gi) ?? []).length / len;
  const digitRatio     = (label.match(/\d/g) ?? []).length / len;
  const randomness     = entropy / Math.log2(Math.min(len, 26));
  let score = 0;
  const reasons: string[] = [];
  if (entropy > 3.8)        { score += 30; reasons.push(`high entropy (${entropy.toFixed(2)})`); }
  if (len > 20)             { score += 15; reasons.push(`long label (${len} chars)`); }
  if (consonantRatio > 0.8) { score += 20; reasons.push(`consonant heavy (${(consonantRatio*100).toFixed(0)}%)`); }
  if (digitRatio > 0.4)     { score += 20; reasons.push(`digit heavy (${(digitRatio*100).toFixed(0)}%)`); }
  if (/[0-9]{4,}/.test(label)) { score += 15; reasons.push("4+ consecutive digits"); }
  if (/[a-z]{15,}/i.test(label)) { score += 10; reasons.push("very long alpha run"); }
  return { isDGA: score >= 40, score, reason: reasons.join(", ") || "none" };
}

function detectDNSTunneling(query: string, queryType: string): { isTunneling: boolean; score: number } {
  const len = query.length;
  let score = 0;
  // Very long queries are suspicious
  if (len > 100) score += 35;
  else if (len > 60) score += 20;
  // TXT/NULL/CNAME queries for long labels = tunneling
  if (["TXT","NULL","CNAME"].includes(queryType) && len > 40) score += 30;
  // Base64-like patterns in subdomain
  if (/[A-Za-z0-9+/=]{20,}\./.test(query)) score += 25;
  // Deeply nested (many labels)
  const labelCount = query.split(".").length;
  if (labelCount > 6) score += 20;
  if (labelCount > 9) score += 15;
  return { isTunneling: score >= 40, score };
}

router.post("/dns-security/analyze", async (req, res) => {
  const body = z.object({
    queryName:    z.string().min(1),
    queryType:    z.string().default("A"),
    sourceIp:     z.string().optional(),
    responseCode: z.string().default("NOERROR"),
    resolvedIp:   z.string().optional(),
  }).parse(req.body);

  const dga      = detectDGA(body.queryName);
  const tunneling = detectDNSTunneling(body.queryName, body.queryType);
  const labels   = body.queryName.split(".");
  const queryLen = body.queryName.length;

  // Compute Shannon entropy for storage (×100 to store as int)
  const freq: Record<string,number> = {};
  for (const c of body.queryName) freq[c] = (freq[c] ?? 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) { const p = count / queryLen; entropy -= p * Math.log2(p); }
  const entropyX100 = Math.round(entropy * 100);

  let verdict: "clean"|"dga"|"tunneling"|"malware"|"phishing"|"suspicious" = "clean";
  if (dga.isDGA && tunneling.isTunneling) verdict = "malware";
  else if (dga.isDGA)      verdict = "dga";
  else if (tunneling.isTunneling) verdict = "tunneling";
  else if (dga.score > 20 || tunneling.score > 20) verdict = "suspicious";

  const blocked = verdict === "dga" || verdict === "malware" || verdict === "tunneling";

  const [event] = await db.insert(dnsSecurityEventsTable).values({
    queryName:      body.queryName,
    queryType:      body.queryType,
    sourceIp:       body.sourceIp,
    responseCode:   body.responseCode,
    resolvedIp:     body.resolvedIp,
    verdict,
    dgaScore:       dga.score,
    tunnelingScore: tunneling.score,
    entropy:        entropyX100,
    labelCount:     labels.length,
    queryLength:    queryLen,
    blocked,
  }).returning();

  res.json({
    event,
    verdict,
    blocked,
    dga:       { ...dga },
    tunneling: { ...tunneling },
    details: { labels: labels.length, queryLen, entropyX100 },
  });
});

router.get("/dns-security/events", async (req, res) => {
  const limit  = Math.min(parseInt(String(req.query.limit ?? "200")), 1000);
  const verdict = req.query.verdict as string | undefined;
  const base   = db.select().from(dnsSecurityEventsTable);
  const events = verdict
    ? await base.where(eq(dnsSecurityEventsTable.verdict, verdict as typeof dnsSecurityEventsTable.$inferSelect["verdict"])).orderBy(desc(dnsSecurityEventsTable.detectedAt)).limit(limit)
    : await base.orderBy(desc(dnsSecurityEventsTable.detectedAt)).limit(limit);
  const stats = await db.select({
    total:     sql<number>`count(*)`,
    dga:       sql<number>`count(*) filter (where verdict = 'dga')`,
    tunneling: sql<number>`count(*) filter (where verdict = 'tunneling')`,
    blocked:   sql<number>`count(*) filter (where blocked = true)`,
  }).from(dnsSecurityEventsTable);
  res.json({ events, stats: stats[0], total: events.length });
});

router.delete("/dns-security/events", async (_req, res) => {
  await db.delete(dnsSecurityEventsTable);
  res.json({ message: "DNS security event log cleared" });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 10. ALERT SUPPRESSION / THRESHOLD RULES (Snort/Suricata) ────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/suppressions", async (_req, res) => {
  const rules = await db.select().from(wafSuppressionRulesTable).orderBy(wafSuppressionRulesTable.createdAt);
  res.json({ rules, total: rules.length });
});

router.post("/suppressions", async (req, res) => {
  const body = z.object({
    name:        z.string().min(1),
    type:        z.enum(["suppress","threshold","rate_filter"]).default("suppress"),
    track:       z.enum(["by_src","by_dst","by_rule","global"]).default("by_src"),
    trackValue:  z.string().optional(),
    wafRuleId:   z.number().int().optional(),
    ruleName:    z.string().optional(),
    attackType:  z.string().optional(),
    count:       z.number().int().default(5),
    seconds:     z.number().int().default(60),
    description: z.string().optional(),
    suppressUntil: z.string().datetime().optional(),
  }).parse(req.body);
  const [rule] = await db.insert(wafSuppressionRulesTable).values({
    ...body,
    suppressUntil: body.suppressUntil ? new Date(body.suppressUntil) : undefined,
  }).returning();
  res.json(rule);
});

router.put("/suppressions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    enabled: z.boolean().optional(), count: z.number().int().optional(),
    seconds: z.number().int().optional(), trackValue: z.string().optional(),
    suppressUntil: z.string().datetime().optional(),
  }).parse(req.body);
  const [updated] = await db.update(wafSuppressionRulesTable).set({
    ...body,
    suppressUntil: body.suppressUntil ? new Date(body.suppressUntil) : undefined,
  }).where(eq(wafSuppressionRulesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Suppression rule not found" });
  res.json(updated);
});

router.delete("/suppressions/:id", async (req, res) => {
  await db.delete(wafSuppressionRulesTable).where(eq(wafSuppressionRulesTable.id, parseInt(req.params.id)));
  res.json({ message: "Suppression rule deleted" });
});

// Check if a given WAF event should be suppressed
router.post("/suppressions/check", async (req, res) => {
  const { ruleId, ruleName, attackType, sourceIp } = z.object({
    ruleId: z.number().int().optional(), ruleName: z.string().optional(),
    attackType: z.string().optional(), sourceIp: z.string().optional(),
  }).parse(req.body);

  const active = await db.select().from(wafSuppressionRulesTable).where(eq(wafSuppressionRulesTable.enabled, true));
  const now = new Date();

  for (const rule of active) {
    // Check expiry for time-limited suppression
    if (rule.suppressUntil && rule.suppressUntil < now) continue;
    // Match by rule ID, name, or attack type
    const matchesRule = (rule.wafRuleId && rule.wafRuleId === ruleId)
      || (rule.ruleName && ruleName?.includes(rule.ruleName))
      || (rule.attackType && rule.attackType === attackType);
    if (!matchesRule) continue;
    // Check track scope
    if (rule.track === "by_src" && rule.trackValue && rule.trackValue !== sourceIp) continue;

    if (rule.type === "suppress") return res.json({ suppressed: true, rule: rule.name, reason: "Suppress rule matched" });

    // Threshold: count recent WAF events matching this rule
    const windowStart = new Date(now.getTime() - (rule.seconds * 1000));
    const [countRow] = await db.select({ c: sql<number>`count(*)` })
      .from(wafEventsTable)
      .where(and(gte(wafEventsTable.detectedAt, windowStart)));
    if (Number(countRow?.c ?? 0) < rule.count) {
      return res.json({ suppressed: true, rule: rule.name, reason: `Below threshold (${countRow?.c}/${rule.count} in ${rule.seconds}s)` });
    }
  }
  res.json({ suppressed: false });
});

// ════════════════════════════════════════════════════════════════════════════
// ── 11. EVE JSON EXPORT (Suricata-style structured event stream) ─────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/eve-export", async (req, res) => {
  const limit   = Math.min(parseInt(String(req.query.limit ?? "500")), 5000);
  const sinceMs = req.query.since ? parseInt(String(req.query.since)) : undefined;
  const since   = sinceMs ? new Date(sinceMs) : undefined;

  // Gather events from WAF, DNS security, portscan, and TLS fingerprints
  const wafEvents  = since
    ? await db.select().from(wafEventsTable).where(gte(wafEventsTable.detectedAt, since)).orderBy(desc(wafEventsTable.detectedAt)).limit(limit)
    : await db.select().from(wafEventsTable).orderBy(desc(wafEventsTable.detectedAt)).limit(limit);

  const dnsEvents  = since
    ? await db.select().from(dnsSecurityEventsTable).where(gte(dnsSecurityEventsTable.detectedAt, since)).orderBy(desc(dnsSecurityEventsTable.detectedAt)).limit(limit)
    : await db.select().from(dnsSecurityEventsTable).orderBy(desc(dnsSecurityEventsTable.detectedAt)).limit(limit);

  const scanEvents = since
    ? await db.select().from(portScanEventsTable).where(gte(portScanEventsTable.detectedAt, since)).orderBy(desc(portScanEventsTable.detectedAt)).limit(limit)
    : await db.select().from(portScanEventsTable).orderBy(desc(portScanEventsTable.detectedAt)).limit(limit);

  // Format in Suricata EVE JSON style
  const eveLines: object[] = [];

  for (const e of wafEvents) {
    eveLines.push({
      timestamp: e.detectedAt.toISOString(),
      event_type: "alert",
      src_ip: e.sourceIp,
      proto: "TCP",
      http: { url: e.path, http_method: e.method },
      alert: {
        action:    e.blocked ? "blocked" : "alerted",
        category:  e.attackType,
        signature: e.ruleName,
        severity:  { critical:1, high:2, medium:3, low:4, info:5 }[e.severity ?? ""] ?? 3,
        metadata:  { anomaly_score: e.anomalyScore, matched_on: e.matchedOn, payload: e.payload?.substring(0, 200) },
      },
      proxhq_source: "waf",
    });
  }

  for (const e of dnsEvents) {
    eveLines.push({
      timestamp: e.detectedAt.toISOString(),
      event_type: "dns",
      src_ip: e.sourceIp ?? "unknown",
      dns: {
        type: "query", rrname: e.queryName, rrtype: e.queryType,
        rcode: e.responseCode, answers: e.resolvedIp ? [{ rrname: e.queryName, rdata: e.resolvedIp }] : [],
      },
      alert: e.verdict !== "clean" ? {
        action:    e.blocked ? "blocked" : "alerted",
        category:  e.verdict,
        signature: `DNS ${e.verdict.toUpperCase()} detection`,
        severity:  e.verdict === "malware" ? 1 : e.verdict === "dga" ? 2 : 3,
        metadata:  { dga_score: e.dgaScore, tunneling_score: e.tunnelingScore },
      } : undefined,
      proxhq_source: "dns_monitor",
    });
  }

  for (const e of scanEvents) {
    eveLines.push({
      timestamp: e.detectedAt.toISOString(),
      event_type: "portscan",
      src_ip: e.sourceIp,
      dest_ip: e.destIp,
      alert: {
        action:   e.blocked ? "blocked" : "alerted",
        category: "portscan",
        signature: `${e.scanType.toUpperCase()} port scan (${e.portCount} ports)`,
        severity: e.portCount > 100 ? 1 : e.portCount > 20 ? 2 : 3,
        metadata: { scan_type: e.scanType, port_count: e.portCount, tcp_flags: e.tcpFlags },
      },
      proxhq_source: "portscan_detector",
    });
  }

  // Sort by timestamp descending
  eveLines.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));

  res.json({ events: eveLines, total: eveLines.length, generated: new Date().toISOString() });
});

// Download as NDJSON (one JSON object per line — Suricata's native format)
router.get("/eve-export/ndjson", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "1000")), 10000);
  const [wafEvents, dnsEvents, scanEvents] = await Promise.all([
    db.select().from(wafEventsTable).orderBy(desc(wafEventsTable.detectedAt)).limit(limit),
    db.select().from(dnsSecurityEventsTable).orderBy(desc(dnsSecurityEventsTable.detectedAt)).limit(limit),
    db.select().from(portScanEventsTable).orderBy(desc(portScanEventsTable.detectedAt)).limit(limit),
  ]);
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Content-Disposition", `attachment; filename="proxhq-eve-${Date.now()}.json"`);
  for (const e of wafEvents)  res.write(JSON.stringify({ event_type:"alert",  timestamp: e.detectedAt, src_ip: e.sourceIp, alert: { signature: e.ruleName, category: e.attackType, anomaly_score: e.anomalyScore }}) + "\n");
  for (const e of dnsEvents)  res.write(JSON.stringify({ event_type:"dns",    timestamp: e.detectedAt, src_ip: e.sourceIp, dns: { rrname: e.queryName, rrtype: e.queryType, verdict: e.verdict }}) + "\n");
  for (const e of scanEvents) res.write(JSON.stringify({ event_type:"portscan",timestamp: e.detectedAt, src_ip: e.sourceIp, scan: { type: e.scanType, ports: e.portCount }}) + "\n");
  res.end();
});

// ════════════════════════════════════════════════════════════════════════════
// ── 12. WEB PROXY / CONTENT FILTER RULES (IPFire/OPNsense) ──────────────────
// ════════════════════════════════════════════════════════════════════════════

router.get("/proxy-rules", async (_req, res) => {
  const rules = await db.select().from(firewallProxyRulesTable).orderBy(firewallProxyRulesTable.priority);
  res.json({ rules, total: rules.length });
});

router.post("/proxy-rules", async (req, res) => {
  const body = z.object({
    name:        z.string().min(1),
    description: z.string().optional(),
    matchType:   z.string().default("domain"),
    matchValue:  z.string().min(1),
    action:      z.enum(["allow","block","redirect","strip_ssl"]).default("block"),
    redirectUrl: z.string().optional(),
    categories:  z.string().optional(),
    applyToIps:  z.string().optional(),
    priority:    z.number().int().default(100),
  }).parse(req.body);
  const [rule] = await db.insert(firewallProxyRulesTable).values({ ...body }).returning();
  res.json(rule);
});

router.put("/proxy-rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    enabled: z.boolean().optional(), action: z.enum(["allow","block","redirect","strip_ssl"]).optional(),
    matchValue: z.string().optional(), priority: z.number().int().optional(),
  }).parse(req.body);
  const [updated] = await db.update(firewallProxyRulesTable).set(body).where(eq(firewallProxyRulesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Proxy rule not found" });
  res.json(updated);
});

router.delete("/proxy-rules/:id", async (req, res) => {
  await db.delete(firewallProxyRulesTable).where(eq(firewallProxyRulesTable.id, parseInt(req.params.id)));
  res.json({ message: "Proxy rule deleted" });
});

// Check a domain/URL against active proxy rules
router.post("/proxy-rules/check", async (req, res) => {
  const { url, sourceIp } = z.object({ url: z.string().min(1), sourceIp: z.string().optional() }).parse(req.body);
  const rules = await db.select().from(firewallProxyRulesTable).where(eq(firewallProxyRulesTable.enabled, true)).orderBy(firewallProxyRulesTable.priority);
  for (const rule of rules) {
    let matched = false;
    try {
      if (rule.matchType === "regex") matched = new RegExp(rule.matchValue, "i").test(url);
      else if (rule.matchType === "domain") matched = url.includes(rule.matchValue);
      else if (rule.matchType === "url") matched = url.startsWith(rule.matchValue);
      else matched = url.includes(rule.matchValue);
    } catch { /* invalid regex */ }
    if (matched) {
      await db.update(firewallProxyRulesTable).set({ hitCount: sql`hit_count + 1` }).where(eq(firewallProxyRulesTable.id, rule.id));
      return res.json({ matched: true, action: rule.action, rule: rule.name, redirectUrl: rule.redirectUrl });
    }
  }
  res.json({ matched: false, action: "allow" });
});

// Seed default content filter rules
router.post("/proxy-rules/seed", async (_req, res) => {
  const existing = await db.select({ name: firewallProxyRulesTable.name }).from(firewallProxyRulesTable);
  if (existing.length > 0) return res.json({ message: "Proxy rules already present" });
  const defaults = [
    { name: "Block Malware Domains",   matchType:"domain", matchValue:"malware-c2.example.com", action: "block" as const,    description:"Block known malware C2 domains", priority:10, categories: '["malware"]' },
    { name: "Block Phishing",          matchType:"regex",  matchValue:"(?i)(phish|account.verify|suspended.notice)\\.\\w+", action: "block" as const, description:"Block phishing-like domain patterns", priority:20 },
    { name: "Block Adult Content",     matchType:"category", matchValue:"adult", action: "block" as const,                    description:"Block adult content categories", priority:50, categories: '["adult"]' },
    { name: "Block Social Media Work", matchType:"domain", matchValue:"facebook.com", action: "block" as const,               description:"Block social media during work hours (use with schedule)", priority:100 },
    { name: "Allow Google",            matchType:"domain", matchValue:"google.com",   action: "allow" as const,               description:"Explicit allow for Google services", priority:1 },
    { name: "Strip SSL Ads",           matchType:"domain", matchValue:"doubleclick.net", action: "strip_ssl" as const,         description:"Strip SSL from ad networks for inspection", priority:80 },
  ];
  const inserted = await db.insert(firewallProxyRulesTable).values(defaults).returning();
  res.json({ seeded: inserted.length });
});

export default router;
