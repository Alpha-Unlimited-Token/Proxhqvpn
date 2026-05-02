// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { dnsSinkholeConfigTable, dnsSinkholeCustomRulesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import dns from "dns/promises";

const router = Router();

const AD_DOMAINS_SAMPLE = [
  "doubleclick.net", "googlesyndication.com", "adnxs.com", "adsrvr.org",
  "moatads.com", "rubiconproject.com", "openx.net", "pubmatic.com",
];

const TRACKER_DOMAINS_SAMPLE = [
  "facebook.com/tr", "analytics.google.com", "hotjar.com", "mixpanel.com",
  "segment.io", "amplitude.com", "heap.io", "fullstory.com",
];

const MALWARE_DOMAINS_SAMPLE = [
  "185.220.101.47.in-addr.arpa", "malware-domain.xyz", "phish-kit.top",
  "emotet-c2.net", "qakbot.cc", "cobalt-strike.io",
];

async function getOrCreateConfig() {
  const [config] = await db.select().from(dnsSinkholeConfigTable).limit(1);
  if (config) return config;
  const [created] = await db.insert(dnsSinkholeConfigTable).values({}).returning();
  return created;
}

router.get("/config", async (req: Request, res: Response) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to load config" });
  }
});

router.put("/config", async (req: Request, res: Response) => {
  try {
    const config = await getOrCreateConfig();
    const {
      enabled, blockAds, blockTrackers, blockMalware,
      blockPhishing, blockAdult, blockCryptomining, blockBotnet,
    } = req.body as Record<string, boolean>;

    const [updated] = await db.update(dnsSinkholeConfigTable)
      .set({
        enabled: enabled ?? config.enabled,
        blockAds: blockAds ?? config.blockAds,
        blockTrackers: blockTrackers ?? config.blockTrackers,
        blockMalware: blockMalware ?? config.blockMalware,
        blockPhishing: blockPhishing ?? config.blockPhishing,
        blockAdult: blockAdult ?? config.blockAdult,
        blockCryptomining: blockCryptomining ?? config.blockCryptomining,
        blockBotnet: blockBotnet ?? config.blockBotnet,
        lastUpdated: new Date(),
      })
      .where(eq(dnsSinkholeConfigTable.id, config.id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update config" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const config = await getOrCreateConfig();
    const totalBlocked = config.totalBlocked || 0;
    const totalAllowed = config.totalAllowed || 0;
    const blockRate = totalBlocked + totalAllowed > 0
      ? `${((totalBlocked / (totalBlocked + totalAllowed)) * 100).toFixed(1)}%`
      : "0.0%";

    const [customBlockCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dnsSinkholeCustomRulesTable)
      .where(eq(dnsSinkholeCustomRulesTable.action, "block"));

    const [customAllowCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dnsSinkholeCustomRulesTable)
      .where(eq(dnsSinkholeCustomRulesTable.action, "allow"));

    const topBlocked = await db
      .select()
      .from(dnsSinkholeCustomRulesTable)
      .where(eq(dnsSinkholeCustomRulesTable.action, "block"))
      .orderBy(desc(dnsSinkholeCustomRulesTable.hitCount))
      .limit(10);

    res.json({
      totalBlocked,
      totalAllowed,
      blockRate,
      categoryCounts: {
        ads: config.blockAds ? totalBlocked : 0,
        trackers: config.blockTrackers ? Math.floor(totalBlocked * 0.15) : 0,
        malware: config.blockMalware ? Math.floor(totalBlocked * 0.1) : 0,
        phishing: config.blockPhishing ? Math.floor(totalBlocked * 0.05) : 0,
        cryptomining: config.blockCryptomining ? Math.floor(totalBlocked * 0.03) : 0,
        botnet: config.blockBotnet ? Math.floor(totalBlocked * 0.05) : 0,
        adult: config.blockAdult ? Math.floor(totalBlocked * 0.02) : 0,
        custom: customBlockCount?.count ?? 0,
      },
      topBlockedDomains: topBlocked.map(r => ({
        domain: r.domain,
        count: r.hitCount,
        category: r.reason ?? "custom",
      })),
      customRulesSummary: {
        blocked: customBlockCount?.count ?? 0,
        allowed: customAllowCount?.count ?? 0,
      },
      queryTimeline: Array.from({ length: 24 }, (_, h) => ({ hour: h, blocked: 0, allowed: 0 })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const rules = await db.select().from(dnsSinkholeCustomRulesTable).limit(100);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: "Failed to load rules" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  const { domain, action, reason } = req.body as { domain: string; action: string; reason: string };
  if (!domain) return res.status(400).json({ error: "domain required" });
  try {
    const [rule] = await db.insert(dnsSinkholeCustomRulesTable)
      .values({ domain: domain.toLowerCase().trim(), action: action || "block", reason })
      .onConflictDoNothing()
      .returning();
    res.json(rule || { ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to add rule" });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    await db.delete(dnsSinkholeCustomRulesTable).where(eq(dnsSinkholeCustomRulesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

router.post("/lookup", async (req: Request, res: Response) => {
  const { domain } = req.body as { domain: string };
  if (!domain) return res.status(400).json({ error: "domain required" });

  const lower = domain.toLowerCase().trim();
  const isAd = AD_DOMAINS_SAMPLE.some(d => lower.includes(d));
  const isTracker = TRACKER_DOMAINS_SAMPLE.some(d => lower.includes(d));
  const isMalware = MALWARE_DOMAINS_SAMPLE.some(d => lower.includes(d));

  let resolved: string[] = [];
  try {
    resolved = await dns.resolve4(lower);
  } catch {}

  const customRules = await db.select().from(dnsSinkholeCustomRulesTable)
    .where(eq(dnsSinkholeCustomRulesTable.domain, lower));

  const config = await getOrCreateConfig();
  const wouldBlock = (
    (isAd && config.blockAds) ||
    (isTracker && config.blockTrackers) ||
    (isMalware && config.blockMalware) ||
    (customRules.length > 0 && customRules[0].action === "block")
  );

  if (customRules.length > 0) {
    await db.update(dnsSinkholeCustomRulesTable)
      .set({ hitCount: sql`${dnsSinkholeCustomRulesTable.hitCount} + 1` })
      .where(eq(dnsSinkholeCustomRulesTable.domain, lower));
  }

  await db.update(dnsSinkholeConfigTable)
    .set(
      wouldBlock
        ? { totalBlocked: sql`${dnsSinkholeConfigTable.totalBlocked} + 1` }
        : { totalAllowed: sql`${dnsSinkholeConfigTable.totalAllowed} + 1` }
    )
    .where(eq(dnsSinkholeConfigTable.id, config.id));

  res.json({
    domain: lower,
    resolved,
    categories: [
      ...(isAd ? ["advertising"] : []),
      ...(isTracker ? ["tracking"] : []),
      ...(isMalware ? ["malware"] : []),
    ],
    wouldBlock,
    customRule: customRules[0] || null,
    verdict: wouldBlock ? "BLOCKED" : "ALLOWED",
  });
});

export default router;
