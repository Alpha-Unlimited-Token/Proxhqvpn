// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// AI Threat Analysis — explains Ghost Trap detections in plain English.
// Uses Claude API (ANTHROPIC_API_KEY). Turns raw security events into
// understandable intelligence summaries for customers.

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { trappedAttackersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();
const uid = (req: Request) => getAuth(req).userId ?? "unknown";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

const SYSTEM = `You are a cybersecurity analyst assistant for ProxhqVPN, a security-focused
self-hosted VPN platform. Your job is to explain security detections to customers in plain English.

When given a threat detection record, explain:
1. What happened (what type of probe or attack was detected)
2. Who/what likely did it (automated scanner, botnet, targeted attacker, etc.)
3. How serious it is (routine internet background noise vs targeted attack)
4. What was done about it (auto-blocked at firewall)
5. Whether any action is required from the customer (almost always: no action needed)

Be honest, clear, and reassuring where appropriate. Do not use jargon without explaining it.
Keep your response under 200 words. Format as plain paragraphs — no bullet points or headers.
Never suggest the customer retaliate or take offensive action.`;

// POST /api/ai-threat/explain — explain a specific detection
router.post("/explain", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "AI analysis not configured (ANTHROPIC_API_KEY missing)" });
  }

  const body = z.object({
    detectionId: z.number().int().optional(),
    rawData: z.object({
      ip:               z.string().optional(),
      probeType:        z.string().optional(),
      threatScore:      z.number().optional(),
      threatCategory:   z.string().optional(),
      threatTags:       z.array(z.string()).optional(),
      country:          z.string().optional(),
      asnOrg:           z.string().optional(),
      isTor:            z.boolean().optional(),
      isKnownMalicious: z.boolean().optional(),
      abuseScore:       z.number().optional(),
      greynoiseName:    z.string().optional(),
      abuseCategories:  z.array(z.string()).optional(),
    }).optional(),
  }).parse(req.body);

  let detectionData = body.rawData;

  if (body.detectionId && !detectionData) {
    const [row] = await db.select().from(trappedAttackersTable)
      .where(eq(trappedAttackersTable.id, body.detectionId)).limit(1);
    if (!row) return res.status(404).json({ error: "Detection not found" });
    const r = row as Record<string, unknown>;
    detectionData = {
      ip:               row.ip ?? undefined,
      probeType:        r.probeType as string ?? undefined,
      threatScore:      r.threatScore as number ?? undefined,
      threatCategory:   r.threatCategory as string ?? undefined,
      threatTags:       r.threatTags as string[] ?? undefined,
      country:          r.country as string ?? undefined,
      asnOrg:           r.asnOrg as string ?? undefined,
      isTor:            r.isTor as boolean ?? undefined,
      isKnownMalicious: r.isKnownMalicious as boolean ?? undefined,
    };
  }

  const client = getClient();
  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system:     SYSTEM,
    messages:   [{
      role:    "user",
      content: `Please explain this security detection to my customer:\n\nDetection data:\n${JSON.stringify(detectionData, null, 2)}\n\nExplain what happened, whether it is serious, and whether the customer needs to do anything.`,
    }],
  });

  const explanation = message.content
    .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : ""))
    .filter(Boolean)
    .join("\n");

  res.json({ explanation, detectionData });
});

// POST /api/ai-threat/summarize-week — weekly threat summary
router.post("/summarize-week", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "AI analysis not configured" });
  }

  const body = z.object({
    stats: z.object({
      totalProbes:     z.number(),
      uniqueIps:       z.number(),
      torProbes:       z.number(),
      knownMalicious:  z.number(),
      criticalThreats: z.number(),
      topCountries:    z.array(z.object({
        country_code: z.string(), probe_count: z.number(),
      })).optional(),
    }),
  }).parse(req.body);

  const client = getClient();
  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system:     SYSTEM,
    messages: [{
      role:    "user",
      content: `Summarize this week's threat detection data for my VPN customer in 2-3 sentences. Be reassuring if appropriate. Data: ${JSON.stringify(body.stats)}`,
    }],
  });

  res.json({
    summary: message.content.map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join(""),
  });
});

export default router;
