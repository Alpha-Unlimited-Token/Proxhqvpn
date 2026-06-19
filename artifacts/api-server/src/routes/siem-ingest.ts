// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public webhook — receives log events forwarded from Vultr node hardening scripts.
// No Clerk auth required; rate-limited at the app level.
import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { securityEventsTable } from "@workspace/db";

const router = Router();

// POST /api/siem/ingest
// Payload (from combat-attacker-architecture.sh rsyslog forwarder):
//   { event: string, host: string, timestamp: string, source: string }
router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      event?: unknown;
      host?: unknown;
      timestamp?: unknown;
      source?: unknown;
    };

    const event = typeof body.event === "string" ? body.event : "";
    const host  = typeof body.host  === "string" ? body.host  : "unknown-node";
    const src   = typeof body.source === "string" ? body.source : "vultr-node";

    if (!event) {
      res.status(400).json({ error: "event field required" });
      return;
    }

    const lower = event.toLowerCase();

    // ── Severity classification ──────────────────────────────────────────────
    let severity: "critical" | "high" | "medium" | "low" | "info" = "info";
    if (lower.includes("crit") || lower.includes("emerg") || lower.includes("alert") || lower.includes("rootkit")) {
      severity = "critical";
    } else if (lower.includes("error") || lower.includes("fail") || lower.includes("denied") || lower.includes("blocked") || lower.includes("banned")) {
      severity = "high";
    } else if (lower.includes("warn") || lower.includes("invalid") || lower.includes("refused") || lower.includes("drop")) {
      severity = "medium";
    } else if (lower.includes("notice") || lower.includes("accept")) {
      severity = "low";
    }

    // ── Event type detection ─────────────────────────────────────────────────
    let eventType = "node.log";
    if (lower.includes("iptables") || lower.includes("nftables") || lower.includes("fw:") || lower.includes("firewall")) {
      eventType = "firewall.drop";
    } else if (lower.includes("sshd") || lower.includes("ssh")) {
      eventType = "ssh.event";
    } else if (lower.includes("fail2ban")) {
      eventType = "fail2ban.action";
    } else if (lower.includes("psad") || lower.includes("port scan") || lower.includes("portscan")) {
      eventType = "portscan.detection";
    } else if (lower.includes("rkhunter") || lower.includes("rootkit") || lower.includes("chkrootkit")) {
      eventType = "rootkit.detection";
    } else if (lower.includes("beacon") || lower.includes(" c2 ") || lower.includes("c&c")) {
      eventType = "beacon.detection";
    } else if (lower.includes("auditd") || lower.includes("audit:")) {
      eventType = "audit.event";
    } else if (lower.includes("unbound") || lower.includes("dns")) {
      eventType = "dns.event";
    }

    await db.insert(securityEventsTable).values({
      id:         randomUUID(),
      source:     src,
      eventType,
      severity,
      actor:      host,
      subject:    host,
      normalized: { eventType, host, severity, source: src },
      raw:        { event, host, timestamp: body.timestamp, source: src },
    });

    res.json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "[siem/ingest] error");
    res.status(500).json({ error: "ingest failed" });
  }
});

export default router;
