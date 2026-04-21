import { Router } from "express";
import https from "https";
import http from "http";
import { db } from "@workspace/db";
import { firewallStatusTable } from "@workspace/db";

const router = Router();

// ── Public blocklists (no API key required) ───────────────────────────────
const BLOCKLISTS = {
  malware: {
    label: "Malware & Ransomware",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/data/add.Risk/hosts",
    description: "Known malware distribution, ransomware C&C servers",
  },
  ads: {
    label: "Ads & Trackers",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/data/add.2o7Net/hosts",
    description: "Advertising networks and behavioral trackers",
  },
  phishing: {
    label: "Phishing & Fraud",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/data/add.Spam/hosts",
    description: "Phishing pages, scam sites, spam infrastructure",
  },
  combined: {
    label: "Combined (Recommended)",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    description: "All categories combined — malware, ads, phishing, tracking",
  },
};

// In-memory state
interface BlocklistCache {
  domains: Set<string>;
  count: number;
  fetchedAt: Date;
  source: string;
  label: string;
}

const caches: Partial<Record<keyof typeof BLOCKLISTS, BlocklistCache>> = {};
let threatEnabled = true;
let enabledCategories: Set<string> = new Set(["combined"]);
let blockedRequestCount = 0;
const recentBlocks: Array<{ domain: string; category: string; ts: string }> = [];

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchText(loc).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c: Buffer) => (data += c.toString()));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function parseHostsFile(raw: string): Set<string> {
  const domains = new Set<string>();
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const parts = l.split(/\s+/);
    if (parts.length >= 2 && (parts[0] === "0.0.0.0" || parts[0] === "127.0.0.1")) {
      const domain = parts[1].toLowerCase();
      if (domain && domain !== "localhost" && domain !== "local" && !domain.startsWith("#")) {
        domains.add(domain);
      }
    }
  }
  return domains;
}

async function fetchBlocklist(category: keyof typeof BLOCKLISTS): Promise<BlocklistCache> {
  const meta = BLOCKLISTS[category];
  const raw = await fetchText(meta.url);
  const domains = parseHostsFile(raw);
  const entry: BlocklistCache = {
    domains,
    count: domains.size,
    fetchedAt: new Date(),
    source: meta.url,
    label: meta.label,
  };
  caches[category] = entry;
  return entry;
}

// Load combined blocklist on startup (non-blocking)
fetchBlocklist("combined").catch(() => {});

// Refresh all enabled categories every 6 hours
setInterval(async () => {
  for (const cat of enabledCategories) {
    try { await fetchBlocklist(cat as keyof typeof BLOCKLISTS); } catch {}
  }
}, 6 * 60 * 60 * 1000);

// ── API routes ────────────────────────────────────────────────────────────

router.get("/status", (_req, res) => {
  const categoryStats = Object.entries(BLOCKLISTS).map(([key, meta]) => {
    const cache = caches[key as keyof typeof BLOCKLISTS];
    return {
      id: key,
      label: meta.label,
      description: meta.description,
      enabled: enabledCategories.has(key),
      domainCount: cache?.count ?? 0,
      lastUpdated: cache?.fetchedAt?.toISOString() ?? null,
      loaded: !!cache,
    };
  });

  const totalDomains = [...enabledCategories].reduce((acc, cat) => {
    return acc + (caches[cat as keyof typeof BLOCKLISTS]?.count ?? 0);
  }, 0);

  res.json({
    enabled: threatEnabled,
    totalBlockedDomains: totalDomains,
    blockedRequestsToday: blockedRequestCount,
    categories: categoryStats,
    recentBlocks: recentBlocks.slice(0, 50),
    lastRefresh: Object.values(caches)[0]?.fetchedAt?.toISOString() ?? null,
  });
});

router.post("/toggle", (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be boolean" });
  threatEnabled = enabled;
  res.json({ enabled: threatEnabled, message: `Threat Protection ${enabled ? "ENABLED" : "DISABLED"}` });
});

router.post("/categories/:id/toggle", async (req, res) => {
  const { id } = req.params;
  if (!BLOCKLISTS[id as keyof typeof BLOCKLISTS]) return res.status(404).json({ error: "Unknown category" });

  if (enabledCategories.has(id)) {
    enabledCategories.delete(id);
  } else {
    enabledCategories.add(id);
    if (!caches[id as keyof typeof BLOCKLISTS]) {
      fetchBlocklist(id as keyof typeof BLOCKLISTS).catch(() => {});
    }
  }
  res.json({ id, enabled: enabledCategories.has(id) });
});

router.post("/refresh", async (req, res) => {
  const { category } = req.body as { category?: string };
  const toRefresh = category
    ? [category as keyof typeof BLOCKLISTS]
    : (Object.keys(BLOCKLISTS) as Array<keyof typeof BLOCKLISTS>);

  const results: Record<string, { success: boolean; count?: number; error?: string }> = {};

  for (const cat of toRefresh) {
    if (!BLOCKLISTS[cat]) { results[cat] = { success: false, error: "Unknown category" }; continue; }
    try {
      const entry = await fetchBlocklist(cat);
      results[cat] = { success: true, count: entry.count };
    } catch (e: any) {
      results[cat] = { success: false, error: e.message };
    }
  }

  res.json({ results });
});

router.post("/check-domain", (req, res) => {
  const { domain } = req.body as { domain: string };
  if (!domain || typeof domain !== "string") return res.status(400).json({ error: "domain required" });

  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const threats: Array<{ category: string; label: string }> = [];

  for (const [cat, cache] of Object.entries(caches)) {
    if (cache && (cache as BlocklistCache).domains.has(normalized)) {
      threats.push({ category: cat, label: BLOCKLISTS[cat as keyof typeof BLOCKLISTS].label });
    }
  }

  if (threats.length > 0 && threatEnabled) {
    blockedRequestCount++;
    recentBlocks.unshift({ domain: normalized, category: threats[0].label, ts: new Date().toISOString() });
    if (recentBlocks.length > 200) recentBlocks.pop();
  }

  res.json({
    domain: normalized,
    blocked: threats.length > 0 && threatEnabled,
    threats,
    enabled: threatEnabled,
  });
});

router.get("/lists/:id/sample", (req, res) => {
  const { id } = req.params;
  const cache = caches[id as keyof typeof BLOCKLISTS];
  if (!cache) return res.status(404).json({ error: "Not loaded yet" });
  const sample = [...cache.domains].slice(0, 100);
  res.json({ category: id, sample, total: cache.count });
});

export default router;
