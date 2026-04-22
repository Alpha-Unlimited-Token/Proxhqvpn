import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { canaryTokensTable, canaryTriggersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import crypto from "crypto";

const router = Router();

function makeTokenId() {
  return crypto.randomBytes(12).toString("hex");
}

function buildTokenPayload(tokenId: string, type: string, domain: string) {
  const base = domain || "proxhqvpn.com";
  switch (type) {
    case "url":
      return { url: `https://${base}/t/${tokenId}` };
    case "dns":
      return { hostname: `${tokenId}.t.${base}`, instructions: `Set up DNS logging for *.t.${base} to detect resolution` };
    case "email":
      return { emailAddress: `canary-${tokenId}@${base}`, instructions: "Embed in email signature or document" };
    case "file_path":
      return {
        windowsPath: `\\\\${base}\\share\\${tokenId}\\sensitive.docx`,
        linuxPath: `/mnt/shares/${tokenId}/sensitive.docx`,
        instructions: "Place this path in a document. Access attempt will trigger alert.",
      };
    case "web_bug":
      return {
        imgTag: `<img src="https://${base}/t/${tokenId}/pixel.gif" width="1" height="1" style="display:none" />`,
        instructions: "Embed in HTML email, web page, or document.",
      };
    case "custom":
    default:
      return { url: `https://${base}/t/${tokenId}` };
  }
}

function getRealIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
}

router.get("/tokens", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokens = await db.select().from(canaryTokensTable)
    .where(eq(canaryTokensTable.createdBy, userId))
    .orderBy(desc(canaryTokensTable.createdAt))
    .limit(50);
  res.json(tokens);
});

router.post("/tokens", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { tokenType, label, memo, alertEmail } = req.body as {
    tokenType: string;
    label: string;
    memo?: string;
    alertEmail?: string;
  };

  if (!tokenType || !label) return res.status(400).json({ error: "tokenType and label required" });

  const validTypes = ["url", "dns", "email", "file_path", "web_bug", "custom"];
  if (!validTypes.includes(tokenType)) return res.status(400).json({ error: "Invalid token type" });

  const tokenId = makeTokenId();
  const domain = process.env.REPLIT_DEV_DOMAIN || "proxhqvpn.com";
  const payload = buildTokenPayload(tokenId, tokenType, domain);

  const [token] = await db.insert(canaryTokensTable).values({
    tokenId,
    tokenType,
    label,
    memo: memo || null,
    alertEmail: alertEmail || null,
    createdBy: userId,
    metadataJson: JSON.stringify(payload),
  }).returning();

  res.json({ ...token, payload });
});

router.delete("/tokens/:id", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [token] = await db.select().from(canaryTokensTable).where(eq(canaryTokensTable.id, id)).limit(1);
  if (!token) return res.status(404).json({ error: "Not found" });
  if (token.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });

  await db.delete(canaryTriggersTable).where(eq(canaryTriggersTable.tokenId, token.tokenId));
  await db.delete(canaryTokensTable).where(eq(canaryTokensTable.id, id));
  res.json({ ok: true });
});

router.get("/tokens/:id/triggers", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [token] = await db.select().from(canaryTokensTable).where(eq(canaryTokensTable.id, id)).limit(1);
  if (!token || token.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });

  const triggers = await db.select().from(canaryTriggersTable)
    .where(eq(canaryTriggersTable.tokenId, token.tokenId))
    .orderBy(desc(canaryTriggersTable.triggeredAt))
    .limit(100);
  res.json(triggers);
});

router.get("/trigger/:tokenId", async (req: Request, res: Response) => {
  const { tokenId } = req.params;
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  try {
    const [token] = await db.select().from(canaryTokensTable)
      .where(eq(canaryTokensTable.tokenId, tokenId)).limit(1);

    if (token && token.active) {
      await db.insert(canaryTriggersTable).values({
        tokenId,
        sourceIp: ip,
        userAgent: ua,
        referer: ref,
        headers: JSON.stringify({ "user-agent": ua, "referer": ref, "x-forwarded-for": req.headers["x-forwarded-for"] }),
      });

      await db.update(canaryTokensTable).set({
        triggerCount: token.triggerCount + 1,
        lastTriggeredAt: new Date(),
        lastTriggeredIp: ip,
        lastTriggeredUserAgent: ua,
      }).where(eq(canaryTokensTable.tokenId, tokenId));
    }
  } catch {}

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
});

router.get("/trigger/:tokenId/pixel.gif", async (req: Request, res: Response) => {
  const { tokenId } = req.params;
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  try {
    const [token] = await db.select().from(canaryTokensTable)
      .where(eq(canaryTokensTable.tokenId, tokenId)).limit(1);
    if (token && token.active) {
      await db.insert(canaryTriggersTable).values({ tokenId, sourceIp: ip, userAgent: ua, referer: ref });
      await db.update(canaryTokensTable).set({
        triggerCount: token.triggerCount + 1,
        lastTriggeredAt: new Date(),
        lastTriggeredIp: ip,
      }).where(eq(canaryTokensTable.tokenId, tokenId));
    }
  } catch {}
  res.setHeader("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
});

export default router;
