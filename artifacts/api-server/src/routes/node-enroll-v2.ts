import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createOneTimeEnrollmentToken, createPerNodeSecret, hashEnrollmentToken } from "../lib/node-enrollment-v2";
import { encryptSecret } from "../lib/encrypted-secret-store";
import { appendAuditEvent } from "../lib/audit-chain";

const router = Router();

// POST /api/node-enrollment/tokens  (admin-only — wired with requireAdmin in routes/index.ts)
router.post("/tokens", async (req: Request, res: Response) => {
  const actorId = (req as any).auth?.userId ?? "admin";
  const body = z.object({ region: z.string().max(80).optional() }).parse(req.body ?? {});
  const { token, record } = createOneTimeEnrollmentToken(actorId, body.region ?? null);

  await db.execute(sql`
    INSERT INTO node_enrollment_tokens (token_hash, created_by, region, expires_at)
    VALUES (${record.tokenHash}, ${record.createdBy}, ${record.region}, ${record.expiresAt.toISOString()})
  `);
  appendAuditEvent({ actor: actorId, action: "node_enrollment_token_created", resource: "node_enrollment_tokens", metadata: { region: body.region, expiresAt: record.expiresAt } });

  res.json({ token, expiresAt: record.expiresAt, region: body.region ?? null });
});

// GET /api/node-enrollment/tokens  (admin-only — list issued tokens without secret)
router.get("/tokens", async (_req: Request, res: Response) => {
  const rows = await db.execute(sql`
    SELECT id, created_by, region, expires_at, used_at, claimed_node_id, created_at
    FROM node_enrollment_tokens
    ORDER BY created_at DESC LIMIT 100
  `);
  res.json({ tokens: rows?.rows ?? [] });
});

// POST /api/node-enrollment/claim  (daemon-callable — PSK not required; token is the credential)
router.post("/claim", async (req: Request, res: Response) => {
  const body = z.object({
    token:     z.string().min(10),
    nodeId:    z.string().min(3).max(80),
    publicKey: z.string().min(44).max(120),
    region:    z.string().max(80).optional(),
    publicIp:  z.string().max(45).optional(),
  }).parse(req.body ?? {});

  const tokenHash = hashEnrollmentToken(body.token);
  const found = await db.execute(sql`
    SELECT id, expires_at, used_at FROM node_enrollment_tokens
    WHERE token_hash = ${tokenHash} LIMIT 1
  `);
  const row = found?.rows?.[0] as any;
  if (!row)                                         return res.status(401).json({ error: "Invalid enrollment token" });
  if (row.used_at)                                  return res.status(409).json({ error: "Enrollment token already consumed" });
  if (new Date(row.expires_at).getTime() < Date.now()) return res.status(410).json({ error: "Enrollment token expired" });

  const nodeSecret    = createPerNodeSecret();
  const nodeSecretEnc = encryptSecret(nodeSecret, `node:${body.nodeId}:daemon-secret`);

  await db.execute(sql`
    UPDATE node_enrollment_tokens SET used_at = NOW(), claimed_node_id = ${body.nodeId}
    WHERE token_hash = ${tokenHash}
  `);
  await db.execute(sql`
    INSERT INTO node_daemon_credentials (node_id, region, public_ip, public_key, daemon_secret_enc, enrolled_at)
    VALUES (${body.nodeId}, ${body.region ?? null}, ${body.publicIp ?? null}, ${body.publicKey}, ${nodeSecretEnc}, NOW())
    ON CONFLICT (node_id) DO UPDATE
      SET daemon_secret_enc = EXCLUDED.daemon_secret_enc,
          public_key        = EXCLUDED.public_key,
          enrolled_at       = NOW()
  `);
  appendAuditEvent({ actor: "daemon", action: "node_enrollment_claimed", resource: `node:${body.nodeId}`, metadata: { region: body.region, publicIp: body.publicIp } });

  res.json({ nodeId: body.nodeId, nodeSecret });
});

export default router;
