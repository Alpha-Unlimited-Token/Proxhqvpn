// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Verified Assets — user-facing CRUD + DNS/HTTP ownership verification.
// Mounted at: /api/verified-assets
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { verifiedAssetsTable } from "@workspace/db/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  generateVerificationToken,
  verifyViaDnsTxt,
  verifyViaHttpFile,
} from "../lib/verified-assets";

const router = Router();

const CreateSchema = z.object({
  assetType:          z.enum(["domain", "ip", "cidr"]),
  value:              z.string().min(1).max(253),
  verificationMethod: z.enum(["dns_txt", "http_file", "manual_admin"]),
  notes:              z.string().max(500).optional(),
});

// ── GET /api/verified-assets ─────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const userId = (req as any).auth.userId as string;
  const assets = await db
    .select()
    .from(verifiedAssetsTable)
    .where(eq(verifiedAssetsTable.userId, userId))
    .orderBy(desc(verifiedAssetsTable.createdAt));
  res.json({ assets });
});

// ── POST /api/verified-assets ────────────────────────────────────────────────
// Create a new pending asset — returns the verification token and instructions.
router.post("/", async (req, res) => {
  const userId = (req as any).auth.userId as string;
  const body = CreateSchema.parse(req.body);

  const token = generateVerificationToken();
  const value = body.value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

  const [asset] = await db
    .insert(verifiedAssetsTable)
    .values({
      userId,
      assetType:          body.assetType,
      value,
      verificationMethod: body.verificationMethod,
      verificationToken:  token,
      verificationStatus: "pending",
      notes:              body.notes,
    })
    .returning();

  const instructions = buildInstructions(body.verificationMethod, value, token);
  res.status(201).json({ asset, instructions });
});

// ── POST /api/verified-assets/:id/verify ────────────────────────────────────
// Trigger an ownership check now.
router.post("/:id/verify", async (req, res) => {
  const userId = (req as any).auth.userId as string;
  const id     = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [asset] = await db
    .select()
    .from(verifiedAssetsTable)
    .where(and(eq(verifiedAssetsTable.id, id), eq(verifiedAssetsTable.userId, userId)))
    .limit(1);

  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (asset.verificationStatus === "revoked") {
    return res.status(400).json({ error: "This asset has been revoked. Create a new one." });
  }

  let result: { verified: boolean; evidence: object };

  if (asset.verificationMethod === "dns_txt") {
    result = await verifyViaDnsTxt(asset.value, asset.verificationToken);
  } else if (asset.verificationMethod === "http_file") {
    result = await verifyViaHttpFile(asset.value, asset.verificationToken);
  } else {
    return res.status(400).json({
      error: "manual_admin assets must be verified by an admin. Contact support.",
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const [updated] = await db
    .update(verifiedAssetsTable)
    .set({
      verificationStatus: result.verified ? "verified" : "failed",
      verifiedAt:         result.verified ? now : undefined,
      lastCheckedAt:      now,
      expiresAt:          result.verified ? expiresAt : undefined,
      evidence:           result.evidence,
      updatedAt:          now,
    })
    .where(eq(verifiedAssetsTable.id, id))
    .returning();

  res.json({
    asset: updated,
    verified: result.verified,
    evidence: result.evidence,
    message: result.verified
      ? `✓ Ownership confirmed. Asset verified for 90 days (until ${expiresAt.toDateString()}).`
      : "✗ Verification failed. Ensure the token is placed correctly and try again.",
  });
});

// ── DELETE /api/verified-assets/:id ─────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const userId = (req as any).auth.userId as string;
  const id     = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [revoked] = await db
    .update(verifiedAssetsTable)
    .set({ verificationStatus: "revoked", updatedAt: new Date() })
    .where(and(eq(verifiedAssetsTable.id, id), eq(verifiedAssetsTable.userId, userId)))
    .returning();

  if (!revoked) return res.status(404).json({ error: "Not found" });
  res.json({ revoked: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildInstructions(
  method: string,
  value: string,
  token: string,
): { title: string; steps: string[] } {
  if (method === "dns_txt") {
    return {
      title: "DNS TXT Record Verification",
      steps: [
        `Log in to your DNS provider (Cloudflare, Route 53, GoDaddy, etc.)`,
        `Add a TXT record to the root of ${value}`,
        `Name/Host: @ (or leave blank for root)`,
        `Value:  proxhqvpn-verify=${token}`,
        `TTL: 300 (5 minutes)`,
        `Wait 1–5 minutes for DNS to propagate, then click "Verify Now"`,
      ],
    };
  }
  if (method === "http_file") {
    return {
      title: "HTTP File Verification",
      steps: [
        `Create a file at: https://${value}/.well-known/proxhqvpn-verify.txt`,
        `File contents must be exactly (no extra spaces or newlines):`,
        token,
        `Once the file is live, click "Verify Now"`,
      ],
    };
  }
  return {
    title: "Manual Admin Verification",
    steps: [
      `Submit a support ticket with proof of ownership (domain registrar screenshot, cloud console, etc.)`,
      `An admin will approve the asset within 1 business day`,
    ],
  };
}

export default router;
