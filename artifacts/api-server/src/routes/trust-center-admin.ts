// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Admin-only Trust Center publishing routes.
// Requires requireAdmin + "admin.write" capability.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { appendAuditEvent } from "../lib/audit-chain";

const router = Router();

const PublishDocSchema = z.object({
  title:             z.string().min(3).max(200),
  type:              z.enum(["security_overview", "pentest_summary", "compliance_summary", "privacy", "subprocessors", "other"]),
  summary:           z.string().min(10).max(2000),
  publicDownloadUrl: z.string().url().nullable().optional(),
});

// POST /api/admin/trust-center/documents — publish a trust document
router.post("/documents", async (req: Request, res: Response) => {
  const parsed = PublishDocSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document payload", details: parsed.error.issues });
    return;
  }

  const { title, type, summary, publicDownloadUrl } = parsed.data;

  // Ensure table exists before inserting
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trust_center_documents (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title              TEXT NOT NULL,
      type               TEXT NOT NULL,
      summary            TEXT NOT NULL,
      published          BOOLEAN NOT NULL DEFAULT true,
      public_download_url TEXT,
      published_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by         TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const result = await db.execute(sql`
    INSERT INTO trust_center_documents (title, type, summary, published, public_download_url, created_by)
    VALUES (
      ${title},
      ${type},
      ${summary},
      true,
      ${publicDownloadUrl ?? null},
      ${"admin"}
    )
    RETURNING id, title, type, summary, published_at
  `);

  const doc = result.rows[0] ?? {};

  appendAuditEvent({
    actor:    "admin",
    action:   "trust_document.publish",
    resource: String(doc.id ?? ""),
    result:   "allow",
    metadata: { title, type },
  });

  res.status(201).json({ document: doc });
});

export default router;
