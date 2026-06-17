// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Detection Signatures — CRUD for user-defined Ghost Trap detection rules.

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { detectionSignaturesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { SYSTEM_SIGNATURES } from "../lib/detection-signatures";
import { appendAuditEvent } from "../lib/audit-chain";

const router = Router();
const uid = (req: Request) => getAuth(req).userId ?? "unknown";

const ConditionSchema = z.object({
  field:    z.enum(["country_code","asn","asn_org","threat_score","abuse_score",
                    "is_tor","is_vpn","is_known_malicious","threat_tag","probe_type","port"]),
  operator: z.enum(["eq","ne","gt","lt","gte","lte","contains","in"]),
  value:    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

const SignatureSchema = z.object({
  name:          z.string().min(1).max(100),
  description:   z.string().max(300).default(""),
  conditions:    z.array(ConditionSchema).max(10),
  anyConditions: z.array(ConditionSchema).max(10).default([]),
  severity:      z.enum(["low","medium","high","critical"]).default("medium"),
  action:        z.enum(["alert","alert_and_block","block_only"]).default("alert"),
  enabled:       z.boolean().default(true),
});

// GET /api/detection-signatures — list signatures
router.get("/", async (req, res) => {
  const custom = await db.select().from(detectionSignaturesTable)
    .where(eq(detectionSignaturesTable.userId, uid(req)))
    .orderBy(desc(detectionSignaturesTable.createdAt));
  res.json({ system: SYSTEM_SIGNATURES, custom, total: custom.length });
});

// POST /api/detection-signatures — create
router.post("/", async (req, res) => {
  const body = SignatureSchema.parse(req.body);
  const [sig] = await db.insert(detectionSignaturesTable)
    .values({ ...body, userId: uid(req) })
    .returning();
  appendAuditEvent({
    actor: uid(req), action: "detection_signature.created",
    resource: `signature:${sig.id}`, result: "allow",
  });
  res.status(201).json(sig);
});

// PATCH /api/detection-signatures/:id — update
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = SignatureSchema.partial().parse(req.body);
  const [sig] = await db.select().from(detectionSignaturesTable)
    .where(eq(detectionSignaturesTable.id, id)).limit(1);
  if (!sig) return res.status(404).json({ error: "Not found" });
  if (sig.userId !== uid(req)) return res.status(403).json({ error: "Forbidden" });
  const [updated] = await db.update(detectionSignaturesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(detectionSignaturesTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/detection-signatures/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [sig] = await db.select().from(detectionSignaturesTable)
    .where(eq(detectionSignaturesTable.id, id)).limit(1);
  if (!sig) return res.status(404).json({ error: "Not found" });
  if (sig.userId !== uid(req)) return res.status(403).json({ error: "Forbidden" });
  await db.delete(detectionSignaturesTable).where(eq(detectionSignaturesTable.id, id));
  res.json({ message: "Deleted" });
});

// POST /api/detection-signatures/test — test a signature against an IP
router.post("/test", async (req, res) => {
  const { ip, signatureId } = z.object({
    ip:          z.string().ip(),
    signatureId: z.number().int().optional(),
  }).parse(req.body);

  const { enrichIp } = await import("../lib/ip-enrichment");
  const enrichment = await enrichIp(ip);

  if (signatureId) {
    const [sig] = await db.select().from(detectionSignaturesTable)
      .where(and(
        eq(detectionSignaturesTable.id, signatureId),
        eq(detectionSignaturesTable.userId, uid(req)),
      )).limit(1);
    if (!sig) return res.status(404).json({ error: "Signature not found" });
    const { matchesSignature } = await import("../lib/detection-signatures");
    const matched = matchesSignature({
      ...sig,
      severity:      sig.severity as "low" | "medium" | "high" | "critical",
      action:        sig.action   as "alert" | "alert_and_block" | "block_only",
      conditions:    sig.conditions    as Parameters<typeof matchesSignature>[0]["conditions"],
      anyConditions: sig.anyConditions as Parameters<typeof matchesSignature>[0]["anyConditions"],
    }, enrichment);
    return res.json({ matched, enrichment });
  }

  const { evaluateSignatures } = await import("../lib/detection-signatures");
  const matches = await evaluateSignatures(uid(req), enrichment);
  res.json({ matchCount: matches.length, matches, enrichment });
});

export default router;
