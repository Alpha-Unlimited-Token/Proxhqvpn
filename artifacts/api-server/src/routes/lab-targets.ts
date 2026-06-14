// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Lab Targets CRUD — authorized IPs/hostnames for security tool use (sqlmap, nmap, os-cmd).
// All write routes require "lab_targets" RBAC action (owner + security_admin only).
import { Router } from "express";
import { db } from "@workspace/db";
import { labTargetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { requireRbac } from "../middlewares/requireRbac";

const router = Router();

// GET /api/lab-targets — list all authorized lab targets
router.get("/", requireRbac("lab_targets"), async (_req, res) => {
  const targets = await db.select().from(labTargetsTable)
    .orderBy(labTargetsTable.createdAt);
  return res.json({ targets });
});

// POST /api/lab-targets — authorize a new scan target
router.post("/", requireRbac("lab_targets"), async (req, res) => {
  const { userId } = getAuth(req);
  const schema = z.object({
    ip:          z.string().ip(),
    hostname:    z.string().max(253).optional(),
    description: z.string().min(1).max(500),
    expiresAt:   z.string().datetime().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });

  const [target] = await db.insert(labTargetsTable).values({
    ip:           p.data.ip,
    hostname:     p.data.hostname ?? null,
    description:  p.data.description,
    authorizedBy: userId!,
    expiresAt:    p.data.expiresAt ? new Date(p.data.expiresAt) : null,
    active:       true,
  }).returning();

  appendAuditEvent({
    actor:    userId ?? "system",
    action:   "lab_target.create",
    resource: `lab_target:${target.id}`,
    metadata: { ip: p.data.ip, description: p.data.description },
  });
  void shipSecurityEvent({
    actor:    userId ?? "system",
    action:   "lab_target.create",
    resource: `lab_target:${target.id}`,
    result:   "allow",
    severity: "medium",
    metadata: { ip: p.data.ip },
  });

  return res.status(201).json({ ok: true, target });
});

// PATCH /api/lab-targets/:id — update or deactivate a target
router.patch("/:id", requireRbac("lab_targets"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const schema = z.object({
    active:      z.boolean().optional(),
    description: z.string().min(1).max(500).optional(),
    expiresAt:   z.string().datetime().nullable().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });

  const updates: Record<string, unknown> = { ...p.data };
  if (p.data.expiresAt !== undefined) {
    updates.expiresAt = p.data.expiresAt ? new Date(p.data.expiresAt) : null;
  }

  const [target] = await db.update(labTargetsTable)
    .set(updates)
    .where(eq(labTargetsTable.id, id))
    .returning();
  if (!target) return res.status(404).json({ error: "Lab target not found" });

  appendAuditEvent({ actor: userId ?? "system", action: "lab_target.update", resource: `lab_target:${id}`, metadata: p.data });
  return res.json({ ok: true, target });
});

// DELETE /api/lab-targets/:id — permanently remove an authorized target
router.delete("/:id", requireRbac("lab_targets"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  await db.delete(labTargetsTable).where(eq(labTargetsTable.id, id));

  appendAuditEvent({ actor: userId ?? "system", action: "lab_target.delete", resource: `lab_target:${id}`, metadata: {} });
  void shipSecurityEvent({ actor: userId ?? "system", action: "lab_target.delete", resource: `lab_target:${id}`, result: "allow", severity: "medium", metadata: {} });

  return res.json({ ok: true });
});

export default router;
