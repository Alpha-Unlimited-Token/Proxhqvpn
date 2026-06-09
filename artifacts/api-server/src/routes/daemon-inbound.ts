// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { createHash } from "crypto";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  nodesTable, beaconAlertsTable, wgPeerCommandsTable, vpngateNodeSessionsTable,
  trappedAttackersTable, silkWebTable,
  firewallRulesTable, blockedIpsTable, firewallGhostOsRulesTable, firewallGeoBlocksTable,
  firewallIpsSignaturesTable, ebpfRulesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { sendMail, adminEmails } from "../lib/mailer";
import { logger } from "../lib/logger";

// Rate-limit attack emails: at most one email per unique attacker IP per hour
const _alertedIps = new Map<string, number>();
function shouldSendAlert(ip: string): boolean {
  const now = Date.now();
  const last = _alertedIps.get(ip) ?? 0;
  if (now - last < 60 * 60 * 1000) return false;
  _alertedIps.set(ip, now);
  return true;
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#ff0000",
    high: "#ff6600",
    medium: "#ffaa00",
    low: "#00aaff",
  };
  const c = colors[severity] ?? "#888";
  return `<span style="background:${c};color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;text-transform:uppercase">${severity}</span>`;
}

const router = Router();

const DAEMON_PSK = process.env.DAEMON_PSK ?? "";

function requirePsk(req: any, res: any, next: any) {
  const psk = req.headers["x-daemon-psk"];
  if (!DAEMON_PSK) {
    return res.status(503).json({ error: "DAEMON_PSK not configured. Set the DAEMON_PSK environment variable." });
  }
  if (!psk || psk !== DAEMON_PSK) {
    return res.status(401).json({ error: "Invalid daemon PSK" });
  }
  next();
}

router.use(requirePsk);

router.post("/report", async (req, res) => {
  const body = z.object({
    nodeId: z.number(),
    system: z.object({
      cpuPercent: z.number(),
      memoryUsedMb: z.number(),
      memoryTotalMb: z.number(),
      memoryPercent: z.number(),
      uptimeSeconds: z.number(),
      networkInMb: z.number().optional(),
      networkOutMb: z.number().optional(),
      timestamp: z.string(),
    }),
    wireguard: z.object({
      publicKey: z.string().optional(),
      listenPort: z.string().optional(),
      activePeers: z.number(),
    }),
    ramKeyLoaded: z.boolean().optional(),
    wgBaseConfClean: z.boolean().optional(),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const updateFields: Record<string, unknown> = {
    status: "active",
    lastSeen: new Date(),
  };
  if (body.ramKeyLoaded !== undefined) {
    updateFields.ramKeyLoaded = body.ramKeyLoaded;
    updateFields.ramKeyCheckedAt = new Date();
  }
  if (body.wgBaseConfClean !== undefined) {
    updateFields.wgBaseConfClean = body.wgBaseConfClean;
  }
  await db.update(nodesTable).set(updateFields as any).where(eq(nodesTable.id, body.nodeId));

  return res.json({ ok: true, nodeId: body.nodeId, receivedAt: new Date().toISOString() });
});

router.post("/beacon", async (req, res) => {
  const body = z.object({
    nodeId: z.number(),
    attackerIp: z.string(),
    probeType: z.enum(["ping", "port_scan", "traceroute", "packet_sniff", "tunnel_probe"]),
    fingerprint: z.string().optional(),
    raw: z.string().optional(),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const severityMap: Record<string, "low" | "medium" | "high" | "critical"> = {
    ping: "low",
    traceroute: "medium",
    port_scan: "high",
    packet_sniff: "critical",
    tunnel_probe: "critical",
  };

  const severity = severityMap[body.probeType];
  const fp = body.fingerprint ?? `IP:${body.attackerIp}|Source:proxhqd`;

  // Auto-trap high/critical probes into the silkweb
  let silkWebTrapped = false;
  if (severity === "high" || severity === "critical") {
    const existing = await db.select().from(trappedAttackersTable).where(sql`ip = ${body.attackerIp}`).limit(1);
    if (existing.length === 0) {
      await db.insert(trappedAttackersTable).values({
        ip: body.attackerIp,
        fingerprint: fp,
        entryNodeId: body.nodeId,
        loopCount: 0,
        dataCollected: JSON.stringify({ probeType: body.probeType, severity, raw: body.raw }),
        probeType: body.probeType,
        sqlmapStatus: "idle",
      });
      silkWebTrapped = true;
    }
  }

  const [alert] = await db.insert(beaconAlertsTable).values({
    nodeId: body.nodeId,
    nodeName: node.name,
    nodeLayer: node.layer,
    attackerIp: body.attackerIp,
    attackerFingerprint: fp,
    probeType: body.probeType,
    severity,
    status: "active",
    silkWebTrapped,
    rawData: body.raw ?? null,
    detectedAt: new Date(),
  }).returning();

  // Email alert for high/critical probes (rate-limited to 1 per IP per hour)
  if ((severity === "high" || severity === "critical") && shouldSendAlert(body.attackerIp)) {
    const to = adminEmails();
    if (to.length > 0) {
      void sendMail({
        to,
        subject: `🚨 ProxhqVPN Alert: ${severity.toUpperCase()} probe on ${node.name} from ${body.attackerIp}`,
        html: `
          <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;border-radius:8px;max-width:600px">
            <div style="color:#00ff88;font-size:20px;font-weight:bold;margin-bottom:16px">⚡ ProxhqVPN Ghost Trap Alert</div>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px;color:#888">Severity</td><td style="padding:6px">${severityBadge(severity)}</td></tr>
              <tr><td style="padding:6px;color:#888">Attacker IP</td><td style="padding:6px;color:#ff4444;font-weight:bold">${body.attackerIp}</td></tr>
              <tr><td style="padding:6px;color:#888">Probe Type</td><td style="padding:6px">${body.probeType}</td></tr>
              <tr><td style="padding:6px;color:#888">Node</td><td style="padding:6px">${node.name} (${node.region ?? "unknown region"})</td></tr>
              <tr><td style="padding:6px;color:#888">SilkWeb Trapped</td><td style="padding:6px">${silkWebTrapped ? "✅ Yes" : "⚠️ Already trapped"}</td></tr>
              <tr><td style="padding:6px;color:#888">Fingerprint</td><td style="padding:6px;font-size:11px;color:#aaa">${fp}</td></tr>
              <tr><td style="padding:6px;color:#888">Detected At</td><td style="padding:6px">${new Date().toUTCString()}</td></tr>
              ${body.raw ? `<tr><td style="padding:6px;color:#888">Raw Data</td><td style="padding:6px;font-size:11px">${body.raw.substring(0, 300)}</td></tr>` : ""}
            </table>
            <div style="margin-top:16px;font-size:12px;color:#555">ProxhqVPN — Alpha Unlimited Technologies LLC</div>
          </div>`,
        text: `PROXHQVPN ALERT [${severity.toUpperCase()}]\nAttacker: ${body.attackerIp}\nProbe: ${body.probeType}\nNode: ${node.name}\nTrapped: ${silkWebTrapped}\nTime: ${new Date().toUTCString()}`,
      }).catch(err => logger.error({ err }, "Failed to send beacon alert email"));
    }
  }

  return res.status(201).json({ ok: true, alertId: alert.id, silkWebTrapped });
});

router.get("/pending-peers", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const pending = await db
    .select()
    .from(wgPeerCommandsTable)
    .where(and(eq(wgPeerCommandsTable.nodeId, nodeId), eq(wgPeerCommandsTable.status, "pending")));

  return res.json({ peers: pending });
});

router.post("/peer-ack", async (req, res) => {
  const body = z.object({
    commandId: z.number(),
    success: z.boolean(),
    errorMessage: z.string().optional(),
  }).parse(req.body);

  await db.update(wgPeerCommandsTable).set({
    status: body.success ? "applied" : "failed",
    appliedAt: body.success ? new Date() : null,
    errorMessage: body.errorMessage ?? null,
  }).where(eq(wgPeerCommandsTable.id, body.commandId));

  return res.json({ ok: true });
});

// Honeypot port connection hit — spider emulating open port trapped a visitor
router.post("/honeypot-hit", async (req, res) => {
  const body = z.object({
    nodeId: z.number(),
    attackerIp: z.string(),
    port: z.number(),
    banner: z.string().optional(),
    rawRequest: z.string().optional(),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const fp = `IP:${body.attackerIp}|PORT:${body.port}|NODE:${node.name}|TS:${Date.now()}`;

  // Always trap honeypot visitors into silkweb (they connected to fake open port)
  const existing = await db.select().from(trappedAttackersTable).where(sql`ip = ${body.attackerIp}`).limit(1);
  let trappedId: number | null = null;

  if (existing.length === 0) {
    const [trapped] = await db.insert(trappedAttackersTable).values({
      ip: body.attackerIp,
      fingerprint: fp,
      entryNodeId: body.nodeId,
      loopCount: 0,
      dataCollected: JSON.stringify({
        honeypotPort: body.port,
        banner: body.banner,
        rawRequest: body.rawRequest?.substring(0, 500),
        nodeRegion: node.region,
      }),
      honeypotPort: body.port,
      probeType: "honeypot_connect",
      sqlmapStatus: "idle",
    }).returning();
    trappedId = trapped.id;
  } else {
    trappedId = existing[0].id;
    await db.update(trappedAttackersTable).set({
      loopCount: sql`loop_count + 1`,
    }).where(eq(trappedAttackersTable.id, existing[0].id));
  }

  // Create a beacon alert for visibility in the Beacons panel
  await db.insert(beaconAlertsTable).values({
    nodeId: body.nodeId,
    nodeName: node.name,
    nodeLayer: node.layer,
    attackerIp: body.attackerIp,
    attackerFingerprint: fp,
    probeType: "port_scan",
    severity: "critical",
    status: "active",
    silkWebTrapped: true,
    rawData: body.rawRequest ?? `Honeypot port ${body.port} hit`,
    detectedAt: new Date(),
  });

  // Email alert on first honeypot contact from this IP (rate-limited 1/hr per IP)
  if (shouldSendAlert(body.attackerIp)) {
    const to = adminEmails();
    if (to.length > 0) {
      void sendMail({
        to,
        subject: `🕸️ ProxhqVPN: Attacker TRAPPED in Ghost Trap — ${body.attackerIp} on port ${body.port}`,
        html: `
          <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;border-radius:8px;max-width:600px">
            <div style="color:#00ff88;font-size:20px;font-weight:bold;margin-bottom:16px">🕸️ ProxhqVPN Ghost Trap — Attacker Caught</div>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px;color:#888">Severity</td><td style="padding:6px">${severityBadge("critical")}</td></tr>
              <tr><td style="padding:6px;color:#888">Attacker IP</td><td style="padding:6px;color:#ff4444;font-weight:bold">${body.attackerIp}</td></tr>
              <tr><td style="padding:6px;color:#888">Honeypot Port</td><td style="padding:6px">${body.port}</td></tr>
              <tr><td style="padding:6px;color:#888">Node</td><td style="padding:6px">${node.name} (${node.region ?? "unknown region"})</td></tr>
              <tr><td style="padding:6px;color:#888">SilkWeb Trapped</td><td style="padding:6px">${existing.length === 0 ? "✅ New trap entry created" : "⚠️ Already in SilkWeb (loop_count incremented)"}</td></tr>
              ${body.banner ? `<tr><td style="padding:6px;color:#888">Banner Sent</td><td style="padding:6px;font-size:11px">${body.banner.substring(0, 200)}</td></tr>` : ""}
              ${body.rawRequest ? `<tr><td style="padding:6px;color:#888">Raw Request</td><td style="padding:6px;font-size:11px">${body.rawRequest.substring(0, 300)}</td></tr>` : ""}
              <tr><td style="padding:6px;color:#888">Trapped At</td><td style="padding:6px">${new Date().toUTCString()}</td></tr>
            </table>
            <div style="margin-top:16px;font-size:12px;color:#555">ProxhqVPN — Alpha Unlimited Technologies LLC</div>
          </div>`,
        text: `PROXHQVPN GHOST TRAP [CRITICAL]\nAttacker: ${body.attackerIp}\nPort: ${body.port}\nNode: ${node.name}\nTime: ${new Date().toUTCString()}`,
      }).catch(err => logger.error({ err }, "Failed to send honeypot alert email"));
    }
  }

  return res.status(201).json({ ok: true, trappedId, message: `${body.attackerIp} trapped via honeypot port ${body.port}` });
});

// VPN Gate double-hop endpoints

// Daemon polls this to get the current VPN Gate config for its node
router.get("/vpngate-config", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const [session] = await db
    .select()
    .from(vpngateNodeSessionsTable)
    .where(and(
      eq(vpngateNodeSessionsTable.nodeId, nodeId),
    ))
    .orderBy(vpngateNodeSessionsTable.assignedAt)
    .limit(1);

  if (!session) return res.json({ action: "none" });

  if (session.status === "pending_connect") {
    return res.json({
      action: "connect",
      sessionId: session.id,
      serverIp: session.serverIp,
      serverCountry: session.serverCountry,
      serverCountryCode: session.serverCountryCode,
      ovpnConfigB64: session.ovpnConfigB64,
    });
  }

  if (session.status === "pending_disconnect") {
    return res.json({ action: "disconnect", sessionId: session.id });
  }

  return res.json({ action: "none", status: session.status });
});

// Daemon acks VPN Gate connection status
router.post("/vpngate-ack", async (req, res) => {
  const body = z.object({
    sessionId: z.number(),
    success: z.boolean(),
    status: z.enum(["connected", "disconnected", "error"]),
    exitIp: z.string().optional(),
    errorMessage: z.string().optional(),
  }).parse(req.body);

  const newStatus = body.success
    ? (body.status === "disconnected" ? "disconnected" : "connected")
    : "error";

  await db.update(vpngateNodeSessionsTable).set({
    status: newStatus,
    exitIp: body.exitIp ?? null,
    errorMessage: body.errorMessage ?? null,
    connectedAt: body.status === "connected" ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(eq(vpngateNodeSessionsTable.id, body.sessionId));

  // If disconnected, delete the session so the node stays clean
  if (newStatus === "disconnected") {
    await db.delete(vpngateNodeSessionsTable).where(eq(vpngateNodeSessionsTable.id, body.sessionId));
  }

  return res.json({ ok: true });
});

// RAM-only WireGuard: return private key for a node (loaded into /dev/shm at boot)
router.post("/wg-key", async (req, res) => {
  const body = z.object({ nodeId: z.number().int().positive() }).parse(req.body);
  const [node] = await db.select({ id: nodesTable.id, privateKey: nodesTable.privateKey })
    .from(nodesTable)
    .where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });
  if (!node.privateKey || node.privateKey === "SERVER_MANAGED") {
    return res.status(503).json({ error: "Private key not configured for this node" });
  }
  logger.info({ nodeId: body.nodeId }, "wg private key served to daemon");
  return res.json({ privateKey: node.privateKey });
});

// ── Firewall Rule Enforcement Plane ────────────────────────────────────────────
// Nodes poll this every 30s to get the current iptables-restore ruleset.
// Only applies changes when the hash changes (efficient — no-op on unchanged rules).
router.get("/firewall-rules", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const [node] = await db.select({ id: nodesTable.id, name: nodesTable.name, listenPort: nodesTable.listenPort })
    .from(nodesTable).where(eq(nodesTable.id, nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const [rules, blocked, ghostRules, geoBlocks] = await Promise.all([
    db.select().from(firewallRulesTable).where(eq(firewallRulesTable.enabled, true)),
    db.select().from(blockedIpsTable),
    db.select().from(firewallGhostOsRulesTable).where(eq(firewallGhostOsRulesTable.enabled, true)),
    db.select().from(firewallGeoBlocksTable).where(eq(firewallGeoBlocksTable.enabled, true)),
  ]);

  const filterLines: string[] = [
    "*filter",
    ":INPUT DROP [0:0]",
    ":FORWARD DROP [0:0]",
    ":OUTPUT ACCEPT [0:0]",
    // Safety anchors — always first, cannot be overridden by admin rules
    "-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "-A INPUT -i lo -j ACCEPT",
    `-A INPUT -p tcp --dport 22 -j ACCEPT`,
    `-A INPUT -p udp --dport ${node.listenPort} -j ACCEPT`,
    `-A INPUT -i wg0 -j ACCEPT`,
    `-A FORWARD -i wg0 -j ACCEPT`,
    `-A FORWARD -o wg0 -j ACCEPT`,
    // GhostOS compiled rules
    ...ghostRules.map(r => r.compiledIptables ?? `# ghostos: ${r.symbolicRule}`),
    // Blocked IPs
    ...blocked.filter(b => !b.ip.includes(":")).map(b => `-A INPUT -s ${b.ip} -j DROP`),
    // Standard rules
    ...rules.map(r => {
      const proto = r.protocol !== "any" ? `-p ${r.protocol}` : "";
      const src = r.sourceIp ? `-s ${r.sourceIp}` : "";
      const dst = r.destIp ? `-d ${r.destIp}` : "";
      const dport = r.destPort ? `--dport ${r.destPort}` : "";
      const chain = r.direction === "inbound" ? "INPUT" : r.direction === "outbound" ? "OUTPUT" : "FORWARD";
      const action = r.action === "allow" ? "ACCEPT" : r.action === "log" ? "LOG --log-prefix PROXHQ_" : "DROP";
      return `-A ${chain} ${[proto, src, dst, dport].filter(Boolean).join(" ")} -j ${action}`.replace(/\s+/g, " ").trim();
    }),
    "COMMIT",
    "*nat",
    ":PREROUTING ACCEPT [0:0]",
    ":OUTPUT ACCEPT [0:0]",
    ":POSTROUTING ACCEPT [0:0]",
    "-A POSTROUTING -o eth0 -j MASQUERADE",
    "COMMIT",
  ];

  // IPv6 mirror: blocked IPv6 IPs + safety anchors
  const ip6Lines: string[] = [
    "*filter",
    ":INPUT DROP [0:0]",
    ":FORWARD DROP [0:0]",
    ":OUTPUT ACCEPT [0:0]",
    "-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "-A INPUT -i lo -j ACCEPT",
    `-A INPUT -p tcp --dport 22 -j ACCEPT`,
    `-A INPUT -i wg0 -j ACCEPT`,
    `-A FORWARD -i wg0 -j ACCEPT`,
    `-A FORWARD -o wg0 -j ACCEPT`,
    ...blocked.filter(b => b.ip.includes(":")).map(b => `-A INPUT -s ${b.ip} -j DROP`),
    "COMMIT",
  ];

  const iptablesRestore = filterLines.join("\n");
  const ip6tablesRestore = ip6Lines.join("\n");
  const rulesHash = createHash("sha256").update(iptablesRestore).digest("hex").slice(0, 16);

  logger.info({ nodeId, hash: rulesHash, ruleCount: rules.length }, "firewall rules served to daemon");
  return res.json({
    rulesHash,
    iptablesRestore,
    ip6tablesRestore,
    ruleCount: rules.length,
    blockedIpCount: blocked.length,
    ghostOsRuleCount: ghostRules.length,
    generatedAt: new Date().toISOString(),
  });
});

// ── Suricata IPS Rules Export ──────────────────────────────────────────────
// Nodes call this to get current IPS signatures in Suricata 7.x .rules format
router.get("/suricata-rules", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const [node] = await db.select({ id: nodesTable.id, name: nodesTable.name })
    .from(nodesTable).where(eq(nodesTable.id, nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const sigs = await db.select().from(firewallIpsSignaturesTable)
    .where(eq(firewallIpsSignaturesTable.enabled, true));

  const rulesLines = sigs.map(sig => {
    const proto = sig.pattern.toLowerCase().startsWith("http") ? "http" : "tcp";
    const action = sig.action === "drop" ? "drop" : "alert";
    const content = sig.pattern.replace(/["'\\]/g, "").slice(0, 200);
    const cveRef = sig.cveId ? `reference:cve,${sig.cveId.replace("CVE-", "")};` : "";
    const sidNum = sig.sid.replace(/\D/g, "") || String(sig.id);
    const pri = sig.severity === "critical" ? 1 : sig.severity === "high" ? 2 : sig.severity === "medium" ? 3 : 4;
    return `${action} ${proto} any any -> any any (msg:"ProxhqVPN - ${sig.name}"; content:"${content}"; sid:${sidNum}; rev:1; classtype:${sig.category}; priority:${pri}; ${cveRef}metadata:proxhq-fw;)`;
  });

  const rulesFile = [
    "# ProxhqVPN GhostOS™ IPS Signatures — Suricata 7.x format",
    `# Generated: ${new Date().toISOString()} — Node: ${node.name} (ID ${nodeId})`,
    `# Total: ${sigs.length} signatures`,
    "# © 2026 Alpha Unlimited Technologies LLC",
    "",
    ...rulesLines,
  ].join("\n");

  const rulesHash = createHash("sha256").update(rulesFile).digest("hex").slice(0, 16);
  logger.info({ nodeId, sigCount: sigs.length, hash: rulesHash }, "suricata rules served to daemon");
  return res.json({ rulesHash, rulesFile, sigCount: sigs.length, generatedAt: new Date().toISOString() });
});

// Nodes report Suricata alert/drop events back
router.post("/ips-event", async (req, res) => {
  const body = z.object({
    nodeId: z.number().int().positive(),
    event: z.string(),           // "alert" | "drop" | "rules_synced"
    sid: z.string().optional(),
    sigName: z.string().optional(),
    srcIp: z.string().optional(),
    dstIp: z.string().optional(),
    dstPort: z.number().optional(),
    rulesHash: z.string().optional(),
    count: z.number().int().positive().default(1),
  }).parse(req.body);

  if ((body.event === "alert" || body.event === "drop") && body.sid) {
    await db.update(firewallIpsSignaturesTable)
      .set({ hitCount: sql`${firewallIpsSignaturesTable.hitCount} + ${body.count}` })
      .where(eq(firewallIpsSignaturesTable.sid, body.sid));
    logger.warn({ nodeId: body.nodeId, sid: body.sid, srcIp: body.srcIp, event: body.event }, "IPS alert from node");
  } else if (body.event === "rules_synced") {
    logger.info({ nodeId: body.nodeId, rulesHash: body.rulesHash }, "suricata rules sync confirmed by node");
  }
  return res.json({ ok: true });
});

// ── eBPF / XDP Rules Export ────────────────────────────────────────────────
// Nodes call this to get current eBPF rule specs
router.get("/ebpf-rules", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const [node] = await db.select({ id: nodesTable.id, name: nodesTable.name })
    .from(nodesTable).where(eq(nodesTable.id, nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const rules = await db.select().from(ebpfRulesTable)
    .where(eq(ebpfRulesTable.enabled, true));
  const rulesHash = createHash("sha256").update(JSON.stringify(rules.map(r => r.id))).digest("hex").slice(0, 16);

  logger.info({ nodeId, ruleCount: rules.length, hash: rulesHash }, "ebpf rules served to daemon");
  return res.json({ rulesHash, rules, ruleCount: rules.length, generatedAt: new Date().toISOString() });
});

// Nodes report eBPF packet match events back
router.post("/ebpf-event", async (req, res) => {
  const body = z.object({
    nodeId: z.number().int().positive(),
    ruleId: z.number().int().positive(),
    packets: z.number().int().nonnegative().default(1),
    bytes: z.number().int().nonnegative().default(0),
    srcIp: z.string().optional(),
    dstIp: z.string().optional(),
  }).parse(req.body);

  await db.update(ebpfRulesTable).set({
    statsPackets: sql`${ebpfRulesTable.statsPackets} + ${body.packets}`,
    statsBytes: sql`${ebpfRulesTable.statsBytes} + ${body.bytes}`,
    lastHit: new Date(),
  }).where(eq(ebpfRulesTable.id, body.ruleId));

  logger.info({ nodeId: body.nodeId, ruleId: body.ruleId, packets: body.packets }, "eBPF event from node");
  return res.json({ ok: true });
});

// Nodes call this after successfully applying a ruleset
router.post("/fw-sync-ack", async (req, res) => {
  const body = z.object({
    nodeId: z.number().int().positive(),
    rulesHash: z.string(),
    success: z.boolean(),
    errorMessage: z.string().optional(),
  }).parse(req.body);

  await db.update(nodesTable).set({
    fwSyncedAt: new Date(),
    fwSyncHash: body.rulesHash,
  }).where(eq(nodesTable.id, body.nodeId));

  if (!body.success) {
    logger.warn({ nodeId: body.nodeId, error: body.errorMessage }, "firewall sync failed on node");
  } else {
    logger.info({ nodeId: body.nodeId, hash: body.rulesHash }, "firewall sync ack");
  }
  return res.json({ ok: true });
});

export default router;
