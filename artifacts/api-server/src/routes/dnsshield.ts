import { Router } from "express";
import { db } from "@workspace/db";
import { dnsShieldRulesTable, dnsShieldConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

async function getOrCreateConfig() {
  const rows = await db.select().from(dnsShieldConfigTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(dnsShieldConfigTable).values({}).returning();
  return created;
}

router.get("/config", async (_req, res) => {
  const config = await getOrCreateConfig();
  res.json(config);
});

router.put("/config", async (req, res) => {
  const body = z.object({
    enabled: z.boolean().optional(),
    blockAds: z.boolean().optional(),
    blockTrackers: z.boolean().optional(),
    blockMalware: z.boolean().optional(),
    blockAdult: z.boolean().optional(),
    dohEnabled: z.boolean().optional(),
    dohProvider: z.string().optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const config = await getOrCreateConfig();
  const [updated] = await db.update(dnsShieldConfigTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(dnsShieldConfigTable.id, config.id))
    .returning();

  res.json(updated);
});

router.get("/rules", async (_req, res) => {
  const rules = await db.select().from(dnsShieldRulesTable).orderBy(dnsShieldRulesTable.createdAt);
  res.json(rules);
});

router.post("/rules", async (req, res) => {
  const body = z.object({
    domain: z.string().min(1).max(253),
    ruleType: z.enum(["block","allow"]).default("block"),
    category: z.enum(["ads","trackers","malware","adult","custom"]).default("custom"),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const [rule] = await db.insert(dnsShieldRulesTable).values(body.data).returning();
  res.status(201).json(rule);
});

router.put("/rules/:id/toggle", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [rule] = await db.select().from(dnsShieldRulesTable).where(eq(dnsShieldRulesTable.id, id));
  if (!rule) return res.status(404).json({ error: "Rule not found" });

  const [updated] = await db.update(dnsShieldRulesTable)
    .set({ enabled: !rule.enabled })
    .where(eq(dnsShieldRulesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [deleted] = await db.delete(dnsShieldRulesTable).where(eq(dnsShieldRulesTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Rule not found" });
  res.json({ ok: true });
});

router.get("/stats", async (_req, res) => {
  const rules = await db.select().from(dnsShieldRulesTable);
  const config = await getOrCreateConfig();

  const totalRules = rules.length;
  const activeRules = rules.filter(r => r.enabled).length;
  const totalHits = rules.reduce((s, r) => s + r.hitCount, 0);
  const byCategory = {
    ads: rules.filter(r => r.category === "ads").length,
    trackers: rules.filter(r => r.category === "trackers").length,
    malware: rules.filter(r => r.category === "malware").length,
    adult: rules.filter(r => r.category === "adult").length,
    custom: rules.filter(r => r.category === "custom").length,
  };

  const dohServers: Record<string, string> = {
    cloudflare: "https://cloudflare-dns.com/dns-query",
    google: "https://dns.google/dns-query",
    quad9: "https://dns.quad9.net/dns-query",
    nextdns: "https://dns.nextdns.io",
  };

  res.json({
    config,
    totalRules,
    activeRules,
    totalHits,
    byCategory,
    dohUrl: dohServers[config.dohProvider] ?? dohServers.cloudflare,
  });
});

const BUILT_IN_LISTS: Record<string, string[]> = {
  ads: [
    "doubleclick.net","googlesyndication.com","adservice.google.com",
    "pagead2.googlesyndication.com","ads.facebook.com","an.facebook.com",
    "amazonadvertising.com","advertising.amazon.com","ib.adnxs.com",
    "static.ads-twitter.com","ads-twitter.com","adtechus.com",
    "outbrain.com","taboola.com","adsrvr.org","pubmatic.com","rubiconproject.com",
    "openx.net","criteo.com","criteo.net","media.net","yandex-adv.net",
  ],
  trackers: [
    "analytics.google.com","google-analytics.com","googletagmanager.com",
    "facebook.com/tr","connect.facebook.net","hotjar.com","mixpanel.com",
    "segment.io","amplitude.com","fullstory.com","heap.io","optimizely.com",
    "mouseflow.com","crazyegg.com","statcounter.com","scorecardresearch.com",
  ],
  malware: [
    "malware.testcategory.com","phishing.testcategory.com",
    "tracker.malicious.example","botnet-c2.example.com",
    "exploit.example.net","ransomware.download.example",
  ],
};

router.post("/load-defaults/:category", async (req, res) => {
  const cat = req.params.category as keyof typeof BUILT_IN_LISTS;
  const list = BUILT_IN_LISTS[cat];
  if (!list) return res.status(400).json({ error: "Unknown category" });

  const inserts = list.map(domain => ({
    domain,
    ruleType: "block" as const,
    category: cat as "ads" | "trackers" | "malware",
    enabled: true,
  }));

  await db.insert(dnsShieldRulesTable).values(inserts).onConflictDoNothing();
  res.json({ loaded: inserts.length });
});

export default router;
