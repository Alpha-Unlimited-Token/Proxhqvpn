// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Compliance Report Export — generates SOC2/HIPAA/PCI evidence packages.
// Exports data already captured in audit chain, SIEM, and RBAC system.

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { auditLogAppendOnlyTable } from "@workspace/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();
const uid = (req: Request) => getAuth(req).userId ?? "unknown";

const DateRangeSchema = z.object({
  from:   z.string().datetime(),
  to:     z.string().datetime(),
  format: z.enum(["json", "csv"]).default("json"),
});

// GET /api/compliance/access-log?from=&to=&format=
router.get("/access-log", async (req, res) => {
  const { from, to, format } = DateRangeSchema.parse(req.query);
  const userId = uid(req);

  const events = await db.select().from(auditLogAppendOnlyTable)
    .where(and(
      eq(auditLogAppendOnlyTable.actor, userId),
      gte(auditLogAppendOnlyTable.createdAt, new Date(from)),
      lte(auditLogAppendOnlyTable.createdAt, new Date(to)),
    )).limit(10000);

  if (format === "csv") {
    const csv = [
      "timestamp,actor,action,resource,result,ip",
      ...events.map(e =>
        `"${e.createdAt?.toISOString()}","${e.actor}","${e.action}","${e.resource}","${e.result}","${(e as Record<string, unknown>).ip ?? ""}"`
      ),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="proxhq-access-log-${Date.now()}.csv"`);
    return res.send(csv);
  }

  res.json({ report: "Access Log", period: { from, to }, events, count: events.length });
});

// GET /api/compliance/admin-actions?from=&to=&format=
router.get("/admin-actions", async (req, res) => {
  const { from, to, format } = DateRangeSchema.parse(req.query);

  const events = await db.select().from(auditLogAppendOnlyTable)
    .where(and(
      gte(auditLogAppendOnlyTable.createdAt, new Date(from)),
      lte(auditLogAppendOnlyTable.createdAt, new Date(to)),
    )).limit(10000);

  const adminActions = events.filter(e =>
    e.action.includes("admin") || e.action.includes("delete") ||
    e.action.includes("config") || e.action.includes("policy") ||
    e.action.includes("break_glass") || e.action.includes("key_download"),
  );

  if (format === "csv") {
    const csv = [
      "timestamp,actor,action,resource,result",
      ...adminActions.map(e =>
        `"${e.createdAt?.toISOString()}","${e.actor}","${e.action}","${e.resource}","${e.result}"`
      ),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="proxhq-admin-actions-${Date.now()}.csv"`);
    return res.send(csv);
  }

  res.json({ report: "Admin Actions", period: { from, to }, events: adminActions, count: adminActions.length });
});

// GET /api/compliance/incident-report?from=&to=
router.get("/incident-report", async (req, res) => {
  const { from, to } = DateRangeSchema.parse(req.query);

  const incidents = await db.select().from(auditLogAppendOnlyTable)
    .where(and(
      gte(auditLogAppendOnlyTable.createdAt, new Date(from)),
      lte(auditLogAppendOnlyTable.createdAt, new Date(to)),
    )).limit(10000);

  const securityEvents = incidents.filter(e =>
    e.result === "deny" || e.action.includes("ghost_trap") ||
    e.action.includes("canary") || e.action.includes("threat") ||
    e.action.includes("block") || e.action.includes("firewall"),
  );

  res.json({
    report:      "Security Incident Report",
    generatedAt: new Date().toISOString(),
    generatedBy: uid(req),
    period:      { from, to },
    summary: {
      totalSecurityEvents: securityEvents.length,
      deniedRequests:      securityEvents.filter(e => e.result === "deny").length,
      honeypotDetections:  securityEvents.filter(e => e.action.includes("ghost_trap")).length,
      canaryFirings:       securityEvents.filter(e => e.action.includes("canary")).length,
      firewallBlocks:      securityEvents.filter(e => e.action.includes("firewall")).length,
    },
    events: securityEvents,
    disclaimer:
      "This report was generated from ProxhqVPN's tamper-evident audit chain. " +
      "All events are SHA3-256 hash-chained and HMAC-SHA512 signed for integrity verification.",
  });
});

export default router;
