// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { exec } from "child_process";
import { Router } from "express";
import { db } from "@workspace/db";
import { verifyDaemonHmac } from "../lib/daemon-auth";
import {
  nodesTable, beaconAlertsTable, wgPeerCommandsTable, vpngateNodeSessionsTable,
  trappedAttackersTable, silkWebTable,
  firewallRulesTable, blockedIpsTable, firewallGhostOsRulesTable, firewallGeoBlocksTable,
  firewallIpsSignaturesTable, ebpfRulesTable,
  firewallAtrPoliciesTable, firewallAtrEventsTable,
  firewallDdosConfigTable, firewallDdosEventsTable,
  firewallTrafficDecisionsTable, firewallPeerRulesTable,
  ghostNodesTable, ghostNodeRoutesTable, ghostTrapRulesTable,
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

// ── P4-D: Minimum agent version enforcement ───────────────────────────────────
// Set MIN_AGENT_VERSION env var to the minimum acceptable daemon semver string.
// Daemons send X-Agent-Version header; if below minimum, responses include
// updateRequired:true so the daemon can self-update gracefully. Non-blocking.
const MIN_AGENT_VERSION = process.env.MIN_AGENT_VERSION ?? "1.0.0";

function semverCompare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function checkAgentVersion(req: any): { updateRequired: boolean; agentVersion: string; minVersion: string } {
  const agentVersion = String(req.headers["x-agent-version"] ?? "0.0.0");
  const updateRequired = semverCompare(agentVersion, MIN_AGENT_VERSION) < 0;
  return { updateRequired, agentVersion, minVersion: MIN_AGENT_VERSION };
}

// ── Per-node HMAC auth (preferred) — requires X-Node-ID + X-Daemon-Sig + X-Daemon-TS + X-Daemon-Nonce ──
// Falls back to DAEMON_PSK if X-Node-ID header is absent (legacy nodes not yet enrolled).
const perNodeHmacMiddleware = verifyDaemonHmac(async (nodeId: string) => {
  // Look up the per-node daemon secret from the database
  const { nodesTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [node] = await db.select({ daemonSecret: nodesTable.daemonSecret })
    .from(nodesTable)
    .where(eq(nodesTable.name, nodeId))
    .limit(1);
  return node?.daemonSecret ?? null;
});

function requirePsk(req: any, res: any, next: any) {
  // If X-Node-ID header is present, use the stronger per-node HMAC auth
  if (req.headers["x-node-id"]) {
    return perNodeHmacMiddleware(req, res, next);
  }

  // Legacy: fall back to shared DAEMON_PSK
  const psk = req.headers["x-daemon-psk"];
  if (!DAEMON_PSK) {
    return res.status(503).json({ error: "DAEMON_PSK not configured. Set the DAEMON_PSK environment variable." });
  }
  if (!psk) return res.status(401).json({ error: "Invalid daemon PSK" });
  const provided = Buffer.alloc(256);
  const expected = Buffer.alloc(256);
  Buffer.from(String(psk),    "utf8").copy(provided);
  Buffer.from(DAEMON_PSK,     "utf8").copy(expected);
  const lenMatch = Buffer.alloc(4);
  const lenExpected = Buffer.alloc(4);
  lenMatch.writeUInt32BE(String(psk).length, 0);
  lenExpected.writeUInt32BE(DAEMON_PSK.length, 0);
  if (!timingSafeEqual(provided, expected) || !timingSafeEqual(lenMatch, lenExpected)) {
    return res.status(401).json({ error: "Invalid daemon PSK" });
  }
  next();
}

// ── Public worm callhome — no PSK (called from attacker's browser/scanner) ──────
router.post("/worm-callhome", async (req, res) => {
  const body = z.object({
    attackerIp: z.string().optional(),
    wormId:     z.string().optional(),
    ua:         z.string().optional(),
    ref:        z.string().optional(),
    ts:         z.number().optional(),
    extra:      z.record(z.string()).optional(),
  }).safeParse(req.body);

  // Real browser IP from the callback — this is the attacker's ACTUAL IP,
  // not the scanning IP they used to probe the honeypot (which may be a proxy/VPN)
  const callbackIp = (body.success ? body.data.attackerIp : null)
    ?? req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  // Look up trapped attacker record — match by original probe IP or by callbackIp
  const [existing] = await db.select().from(trappedAttackersTable)
    .where(sql`ip = ${callbackIp}`).limit(1).catch(() => []);

  if (existing) {
    let collected: Record<string, unknown> = {};
    try { collected = JSON.parse(existing.dataCollected ?? "{}"); } catch { /* */ }

    const callbacks: unknown[] = (collected.wormCallbacks as unknown[] | undefined) ?? [];
    callbacks.push({
      ts: new Date().toISOString(),
      ua: body.success ? body.data.ua : null,
      ref: body.success ? body.data.ref : null,
      wormId: body.success ? body.data.wormId : null,
      extra: body.success ? body.data.extra : null,
      callbackIp,
    });
    collected.wormCallbacks = callbacks;

    // ── PASSIVE EVIDENCE COLLECTION ONLY ─────────────────────────────────────
    // Audit finding: auto-exploit against callback IPs is a Critical legal risk.
    // Active scanning/exploitation against any IP without verified written ownership
    // authorization violates the US CFAA, UK Computer Misuse Act, EU Directive 2013/40/EU,
    // and most other jurisdictions. Removed unconditionally.
    // Evidence is recorded passively; manual scoped testing requires explicit admin action.
    collected.autoExploitStatus = "passive_only";
    collected.autoExploitReason = "Active scanning requires verified target ownership and explicit written authorization per platform policy.";
    collected.callbackReceivedAt = new Date().toISOString();

    logger.info({ callbackIp, trappedId: existing.id },
      "Worm callhome received — passive evidence recorded (active scanning disabled)");

    await db.update(trappedAttackersTable)
      .set({ dataCollected: JSON.stringify(collected), loopCount: sql`loop_count + 1` })
      .where(eq(trappedAttackersTable.id, existing.id))
      .catch(() => { /* ignore */ });
  }

  // Transparent 1×1 GIF response so img-tag trackers render
  const gif1x1 = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  res.writeHead(200, { "Content-Type": "image/gif", "Content-Length": gif1x1.length });
  res.end(gif1x1);
});

router.use(requirePsk);

// ── Worm-payload — node fetches this before sending banner to attacker ───────
router.get("/worm-payload", (req, res) => {
  const type = (req.query.type as string | undefined)?.toLowerCase() ?? "http";
  const port = parseInt(req.query.port as string) || 80;
  const nodeId = req.query.nodeId ?? "?";

  // Unique worm ID per request so we can correlate callbacks
  const wormId = randomUUID().substring(0, 12);

  // Base URL for callbacks — prefer REPLIT_DOMAINS, fall back to request host
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").filter(Boolean);
  const baseUrl = domains.length > 0
    ? `https://${domains[0]}`
    : `http://${req.headers.host ?? "localhost"}`;

  const callbackUrl = `${baseUrl}/api/daemon-inbound/worm-callhome`;
  const pixelUrl    = `${baseUrl}/api/daemon-inbound/worm-callhome`;

  if (type === "ftp") {
    const banner = [
      `220-ProFTPD 1.3.5 Server (Debian) [${req.socket.remoteAddress ?? "unknown"}]`,
      `220-Welcome to FTP service`,
      `220-[ref:${wormId}] See ftp://help.${domains[0] ?? "proxhqvpn.com"}/setup for client configuration`,
      `220 Server ready.`,
    ].join("\r\n");
    return res.json({ type: "ftp", wormId, banner });
  }

  if (type === "ssh") {
    const banner = `SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n` +
      `# [svc:${wormId}] System management: ${baseUrl}/status\r\n`;
    return res.json({ type: "ssh", wormId, banner });
  }

  // Default: HTTP — full response with hidden worm trackers
  const wormScript = `
<script>
(function(){
  var w={id:"${wormId}",ua:navigator.userAgent,ref:document.referrer,ts:Date.now()};
  fetch("${callbackUrl}",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(w),mode:"no-cors"}).catch(function(){});
})();
</script>`.trim();

  const body = `<html>
<head><title>Apache2 Default Page</title></head>
<body>
<h1>It works!</h1>
<p>This is the default web page for this server.</p>
<p>The web server software is running but no content has been added, yet.</p>
<img src="${pixelUrl}?wid=${wormId}&np=${port}&ni=${nodeId}" width="1" height="1" style="display:none" alt="">
${wormScript}
</body>
</html>`;

  const httpResponse = [
    `HTTP/1.1 200 OK`,
    `Server: Apache/2.4.51 (Ubuntu)`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Length: ${Buffer.byteLength(body)}`,
    `Connection: close`,
    ``,
    body,
  ].join("\r\n");

  return res.json({ type: "http", wormId, banner: httpResponse, body });
});

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

  // ── Honeypot auto-trigger ──────────────────────────────────────────────────
  // When the targeted node has hasBeacon=true AND the probe is high/critical severity,
  // automatically fire the full honeypot trap sequence — same treatment as a direct
  // honeypot-hit, so the attacker gets the email alert + trapped in the silkweb.
  if (node.hasBeacon && (severity === "high" || severity === "critical")) {
    const honeypotFp = `HONEYPOT:beacon-probe|NODE:${node.name}|IP:${body.attackerIp}|PROBE:${body.probeType}|TS:${Date.now()}`;
    const alreadyTrapped = await db
      .select({ id: trappedAttackersTable.id })
      .from(trappedAttackersTable)
      .where(sql`ip = ${body.attackerIp}`)
      .limit(1);

    if (alreadyTrapped.length === 0) {
      await db.insert(trappedAttackersTable).values({
        ip:           body.attackerIp,
        fingerprint:  honeypotFp,
        entryNodeId:  body.nodeId,
        loopCount:    0,
        dataCollected: JSON.stringify({
          honeypotTrigger:  "beacon_probe",
          probeType:        body.probeType,
          severity,
          nodeRegion:       node.region,
          raw:              body.raw?.substring(0, 500),
        }),
        honeypotPort:   node.listenPort,
        probeType:      "honeypot_connect",
        sqlmapStatus:   "idle",
      }).catch(() => {});
      logger.info({ ip: body.attackerIp, node: node.name, probe: body.probeType }, "[Honeypot] Auto-trapped via beacon probe on hasBeacon node");
    }
  }

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

    // HTTP banner recorded as intelligence only — auto-SQLmap removed (P1-A safety fix).
    // Running sqlmap against an unknown external IP is unauthorized computer access
    // under CFAA / Computer Misuse Act / EU Directive 2013/40/EU.
    // To scan a target, add it to lab_targets first and use the SilkWeb console.
    if (body.banner && body.banner.includes("HTTP")) {
      logger.info(
        { ip: body.attackerIp, port: body.port, banner: body.banner.substring(0, 120) },
        "HTTP banner captured on honeypot port — stored as intelligence (no auto-scan)",
      );
    }
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
  appendAuditEvent({
    actor: `daemon:node${body.nodeId}`,
    action: "daemon.wg_key_served",
    resource: `node:${body.nodeId}`,
    result: "allow",
    ip: req.socket?.remoteAddress ?? "unknown",
    metadata: { nodeId: body.nodeId },
  });
  void shipSecurityEvent({
    actor: `daemon:node${body.nodeId}`,
    action: "daemon.wg_key_served",
    resource: `node:${body.nodeId}`,
    result: "allow",
    severity: "medium",
    metadata: { nodeId: body.nodeId },
  });
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
    // Update IPS hit count
    const [sig] = await db.update(firewallIpsSignaturesTable)
      .set({ hitCount: sql`${firewallIpsSignaturesTable.hitCount} + ${body.count}` })
      .where(eq(firewallIpsSignaturesTable.sid, body.sid)).returning();
    logger.warn({ nodeId: body.nodeId, sid: body.sid, srcIp: body.srcIp, event: body.event }, "IPS alert from node");

    // ── Automatic Threat Response ──────────────────────────────────────────
    if (body.srcIp) {
      const srcIp = body.srcIp;
      const category = sig?.category ?? "";

      // Find matching ATR policies (most-specific first: sid > category > global)
      const policies = await db.select().from(firewallAtrPoliciesTable).where(eq(firewallAtrPoliciesTable.enabled, true));
      const matchedPolicy = policies.find(p => p.sid === body.sid && p.scope === "signature")
        ?? policies.find(p => p.scope === "category" && category && p.category === category)
        ?? policies.find(p => p.scope === "global");

      if (matchedPolicy) {
        // Check if already blocked
        const [alreadyBlocked] = await db.select({ id: blockedIpsTable.id }).from(blockedIpsTable)
          .where(eq(blockedIpsTable.ip, srcIp)).limit(1);
        if (!alreadyBlocked) {
          // Check cooldown — skip if ATR event for this IP+policy fired recently
          const cooldownMs = matchedPolicy.cooldownMins * 60 * 1000;
          const cooldownCutoff = new Date(Date.now() - cooldownMs);
          const [recentEvent] = await db.select({ id: firewallAtrEventsTable.id })
            .from(firewallAtrEventsTable)
            .where(and(
              eq(firewallAtrEventsTable.sourceIp, srcIp),
              eq(firewallAtrEventsTable.policyId, matchedPolicy.id),
            )).limit(1);

          const isStale = !recentEvent || (await db.select({ triggeredAt: firewallAtrEventsTable.triggeredAt })
            .from(firewallAtrEventsTable).where(eq(firewallAtrEventsTable.id, recentEvent.id)).limit(1)
            .then(r => r[0]?.triggeredAt && r[0].triggeredAt < cooldownCutoff));

          if (!recentEvent || isStale) {
            let blockedIpId: number | undefined;
            let trappedAttackerId: number | undefined;

            // Block: add to blocked_ips
            if (matchedPolicy.action === "block" || matchedPolicy.action === "block_and_trap") {
              const [blocked] = await db.insert(blockedIpsTable).values({
                ip: srcIp, reason: `ATR: ${matchedPolicy.name} (SID ${body.sid ?? ""})`,
                autoBlocked: true,
              }).onConflictDoNothing().returning();
              blockedIpId = blocked?.id;
              logger.warn({ srcIp, policy: matchedPolicy.name, action: matchedPolicy.action }, "ATR: auto-blocked IP");
            }

            // Trap: add to trapped_attackers (SilkWeb)
            if (matchedPolicy.action === "trap" || matchedPolicy.action === "block_and_trap") {
              const [trapped] = await db.insert(trappedAttackersTable).values({
                ip: srcIp,
                fingerprint: `atr:${body.sid ?? "unknown"}:${Date.now()}`,
                entryNodeId: body.nodeId,
                loopCount: 0,
                dataCollected: `ATR auto-trap from IPS event — SID ${body.sid ?? ""}`,
                probeType: "ips_alert",
                trappedAt: new Date(),
              }).onConflictDoNothing().returning();
              trappedAttackerId = trapped?.id;
              logger.warn({ srcIp, policy: matchedPolicy.name }, "ATR: auto-trapped IP in SilkWeb");
            }

            // Log ATR event
            await db.insert(firewallAtrEventsTable).values({
              policyId: matchedPolicy.id,
              policyName: matchedPolicy.name,
              sourceIp: srcIp,
              nodeId: body.nodeId,
              sid: body.sid,
              triggerHits: body.count,
              action: matchedPolicy.action,
              trappedAttackerId: trappedAttackerId ?? null,
              blockedIpId: blockedIpId ?? null,
              triggeredAt: new Date(),
            });

            // Increment policy trigger count
            await db.update(firewallAtrPoliciesTable)
              .set({ triggeredCount: sql`${firewallAtrPoliciesTable.triggeredCount} + 1` })
              .where(eq(firewallAtrPoliciesTable.id, matchedPolicy.id));

            // Send alert email for notify action
            if (matchedPolicy.action === "notify") {
              const emails = adminEmails();
              for (const email of emails) {
                await sendMail({
                  to: email,
                  subject: `[ProxhqVPN ATR] Alert: ${matchedPolicy.name} — ${srcIp}`,
                  html: `<p><strong>ATR policy "${matchedPolicy.name}"</strong> fired on node ${body.nodeId}.</p><ul><li>Source IP: ${srcIp}</li><li>SID: ${body.sid}</li><li>Action: notify-only</li><li>Time: ${new Date().toISOString()}</li></ul>`,
                  text: `ATR policy "${matchedPolicy.name}" fired on node ${body.nodeId}.\nSource IP: ${srcIp}\nSID: ${body.sid}\nAction: notify-only\nTime: ${new Date().toISOString()}`,
                });
              }
            }
          }
        }
      }
    }
  } else if (body.event === "rules_synced") {
    logger.info({ nodeId: body.nodeId, rulesHash: body.rulesHash }, "suricata rules sync confirmed by node");
  }
  return res.json({ ok: true });
});

// ── Adaptive DDoS Report ───────────────────────────────────────────────────
// Nodes report high-pps sources detected via eBPF/kernel metrics
router.post("/ddos-report", async (req, res) => {
  const body = z.object({
    nodeId: z.number().int().positive(),
    sourceIp: z.string(),
    peakPps: z.number().int().positive(),
    durationSecs: z.number().int().positive().optional(),
  }).parse(req.body);

  // Get DDoS config (or defaults)
  let [config] = await db.select().from(firewallDdosConfigTable).limit(1);
  if (!config) {
    [config] = await db.insert(firewallDdosConfigTable).values({ enabled: true, thresholdPps: 5000, windowSecs: 10, action: "rate_limit", rateLimitPps: 100, autoUnblockMins: 30, updatedAt: new Date() }).returning();
  }

  if (!config.enabled) return res.json({ ok: true, skipped: "DDoS protection disabled" });
  if (body.peakPps < config.thresholdPps) return res.json({ ok: true, skipped: "Below threshold" });

  // Check if already blocked
  const [alreadyBlocked] = await db.select({ id: blockedIpsTable.id }).from(blockedIpsTable)
    .where(eq(blockedIpsTable.ip, body.sourceIp)).limit(1);

  const actionTaken = alreadyBlocked ? "already_blocked" : config.action;
  const unblockAt = new Date(Date.now() + config.autoUnblockMins * 60 * 1000);

  if (!alreadyBlocked && (config.action === "block" || config.action === "rate_limit")) {
    await db.insert(blockedIpsTable).values({
      ip: body.sourceIp, reason: `DDoS auto-block: ${body.peakPps} pps on node ${body.nodeId}`,
      autoBlocked: true,
    }).onConflictDoNothing();
    logger.warn({ sourceIp: body.sourceIp, peakPps: body.peakPps, nodeId: body.nodeId }, "DDoS: auto-blocked high-pps source");
  }

  await db.insert(firewallDdosEventsTable).values({
    sourceIp: body.sourceIp,
    nodeId: body.nodeId,
    peakPps: body.peakPps,
    durationSecs: body.durationSecs ?? null,
    actionTaken,
    blockedAt: new Date(),
    unblockAt,
  });

  return res.json({ ok: true, action: actionTaken, unblockAt: unblockAt.toISOString() });
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

// ── Security Event Log — node reports flagged traffic for visibility only ───
// No approval gate. Traffic always flows freely for VPN users.
// This endpoint just records events as a security audit log.
router.post("/traffic-flag", async (req, res) => {
  const body = z.object({
    nodeId:       z.number().int().positive(),
    peerPublicKey:z.string().optional(),
    peerDeviceName:z.string().optional(),
    peerIp:       z.string(),
    destIp:       z.string(),
    destPort:     z.number().int().optional(),
    destDomain:   z.string().optional(),
    protocol:     z.string().optional(),
    flagReason:   z.string(),
    flagSid:      z.string().optional(),
  }).parse(req.body);

  // Deduplicate: skip if same peerIp+destIp already logged in last hour
  const existing = await db.select({ id: firewallTrafficDecisionsTable.id })
    .from(firewallTrafficDecisionsTable)
    .where(
      and(
        eq(firewallTrafficDecisionsTable.peerIp, body.peerIp),
        eq(firewallTrafficDecisionsTable.destIp, body.destIp),
      )
    ).limit(1);
  if (existing.length) {
    return res.json({ ok: true, deduplicated: true });
  }

  const rows = await db.insert(firewallTrafficDecisionsTable).values({
    peerPublicKey:  body.peerPublicKey,
    peerDeviceName: body.peerDeviceName,
    peerIp:         body.peerIp,
    destIp:         body.destIp,
    destPort:       body.destPort,
    destDomain:     body.destDomain,
    protocol:       body.protocol ?? "tcp",
    nodeId:         body.nodeId,
    flagReason:     body.flagReason,
    flagSid:        body.flagSid,
    status:         "approved",    // auto-approved — traffic flows, just logged
    appliedToNode:  true,
    decidedAt:      new Date(),
  }).returning({ id: firewallTrafficDecisionsTable.id });

  logger.info({ nodeId: body.nodeId, peerIp: body.peerIp, destIp: body.destIp, reason: body.flagReason }, "security event logged (traffic flows freely)");
  return res.json({ ok: true, id: rows[0]!.id });
});

// ── Ghost Node policy delivery ───────────────────────────────────────────────
// Called by node daemons to retrieve the current ghost-node decoy policy.
// Returns active ghost nodes so the daemon can bring up wg-ghost0 interfaces.
// Auth: same PSK pattern as all daemon-inbound routes (verifyDaemonHmac).
router.get("/ghost-node-policy", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (isNaN(nodeId)) return res.status(400).json({ error: "nodeId required" });

  const versionInfo = checkAgentVersion(req);

  const activeGhostNodes = await db.select().from(ghostNodesTable)
    .where(eq(ghostNodesTable.status, "active"))
    .limit(20);

  const routes = await db.select().from(ghostNodeRoutesTable)
    .where(and(
      eq(ghostNodeRoutesTable.realNodeId, nodeId),
      eq(ghostNodeRoutesTable.active, true),
    ));

  return res.json({
    ok:         true,
    policyTs:   new Date().toISOString(),
    ...versionInfo,
    ghostNodes: activeGhostNodes.map((n) => ({
      id:             n.id,
      name:           n.name,
      publicIp:       n.publicIp,
      decoyIp:        n.decoyIp,
      listenPort:     n.listenPort,
      decoyPublicKey: n.decoyPublicKey,
      isolationLevel: n.isolationLevel,
    })),
    routes: routes.map(r => ({
      decoyInterface: r.decoyInterface,
      allowedIpRange: r.allowedIpRange,
      iptablesMarkId: r.iptablesMarkId,
      routingTable:   r.routingTable,
      policyHash:     r.policyHash,
    })),
  });
});

// ── Ghost Trap policy delivery — per-user rule push ───────────────────────────
// Called by node daemons to pull the latest Ghost Trap detection rules.
// The daemon uses these to match probes before they reach the main platform.
router.get("/ghost-trap-policy", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (isNaN(nodeId)) return res.status(400).json({ error: "nodeId required" });

  const versionInfo = checkAgentVersion(req);

  const allRules = await db.select({
    id:       ghostTrapRulesTable.id,
    ruleType: ghostTrapRulesTable.ruleType,
    pattern:  ghostTrapRulesTable.pattern,
    action:   ghostTrapRulesTable.action,
    priority: ghostTrapRulesTable.priority,
  }).from(ghostTrapRulesTable)
    .where(eq(ghostTrapRulesTable.enabled, true))
    .limit(200);

  return res.json({
    ok:      true,
    policyTs: new Date().toISOString(),
    ...versionInfo,
    rules:   allRules,
  });
});

// ── Peer rules export for node daemon ───────────────────────────────────────
router.get("/peer-rules-export", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (isNaN(nodeId)) return res.status(400).json({ error: "nodeId required" });

  const rules = await db.select().from(firewallPeerRulesTable)
    .where(and(
      eq(firewallPeerRulesTable.nodeId, nodeId),
      eq(firewallPeerRulesTable.enabled, true),
    ));

  // Attempt to resolve peer public key → current WireGuard IP via wg show
  // (runtime resolution — we store the public key, the node resolves to IP at apply time)
  const enriched = rules.map(r => ({
    ...r,
    resolvedIp: "",  // node resolves peerPublicKey → IP via `wg show wg0 allowed-ips` at apply time
  }));

  return res.json({ rules: enriched });
});

export default router;
