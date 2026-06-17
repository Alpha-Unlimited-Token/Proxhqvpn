// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// IP Enrichment Engine — enriches detected threat IPs with external intelligence.
// Uses public APIs: AbuseIPDB, GreyNoise (community), ip-api.com (free geo).
// Called automatically by Ghost Trap when a new probe is detected.
// No proprietary data formats or algorithms. Standard security engineering.

import { logger } from "./logger";
import { db } from "@workspace/db";
import { ipEnrichmentCacheTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";

const ABUSEIPDB_KEY   = process.env.ABUSEIPDB_API_KEY ?? "";
const GREYNOISE_KEY   = process.env.GREYNOISE_API_KEY ?? "";
const CACHE_TTL_HOURS = 24;

export interface IpEnrichment {
  ip: string;
  abuseConfidenceScore: number;
  totalReports: number;
  lastReportedAt: string | null;
  abuseCategories: string[];
  greynoiseClassification: string;
  greynoiseIsBot: boolean;
  greynoiseIsTor: boolean;
  greynoiseIsVpn: boolean;
  greynoiseName: string | null;
  greynoiseLastSeen: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  asn: string | null;
  asnOrg: string | null;
  isp: string | null;
  threatScore: number;
  threatTags: string[];
  threatCategory: "critical" | "high" | "medium" | "low" | "benign";
  isKnownMalicious: boolean;
  isBulletproofHosting: boolean;
  enrichedAt: string;
}

// Known bulletproof / high-abuse ASNs (public knowledge, widely published)
const BULLETPROOF_ASNS = new Set([
  "AS9009", "AS60068", "AS35913", "AS206092", "AS174", "AS201814",
  "AS51167",
]);

function computeThreatScore(data: Partial<IpEnrichment>): number {
  let score = 0;
  if ((data.abuseConfidenceScore ?? 0) > 80) score += 40;
  else if ((data.abuseConfidenceScore ?? 0) > 50) score += 25;
  else if ((data.abuseConfidenceScore ?? 0) > 20) score += 10;
  if (data.greynoiseClassification === "malicious") score += 30;
  if (data.greynoiseIsTor) score += 15;
  if (data.greynoiseIsBot) score += 10;
  if (data.isBulletproofHosting) score += 15;
  if ((data.totalReports ?? 0) > 100) score += 10;
  return Math.min(100, score);
}

function computeThreatTags(data: Partial<IpEnrichment>): string[] {
  const tags: string[] = [];
  if (data.greynoiseIsTor) tags.push("tor-exit-node");
  if (data.greynoiseIsVpn) tags.push("vpn");
  if (data.greynoiseIsBot) tags.push("bot");
  if (data.isBulletproofHosting) tags.push("bulletproof-hosting");
  if (data.greynoiseClassification === "malicious") tags.push("known-malicious");
  if ((data.abuseConfidenceScore ?? 0) > 80) tags.push("high-abuse-score");
  if (data.abuseCategories?.includes("SSH Brute Force")) tags.push("ssh-brute-force");
  if (data.abuseCategories?.includes("Port Scan")) tags.push("port-scanner");
  if (data.abuseCategories?.includes("Web App Attack")) tags.push("web-attacker");
  if (data.abuseCategories?.includes("SQL Injection")) tags.push("sql-injection");
  return tags;
}

async function fetchAbuseIPDB(ip: string): Promise<Partial<IpEnrichment>> {
  if (!ABUSEIPDB_KEY) return {};
  try {
    const r = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
      {
        headers: { Key: ABUSEIPDB_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) return {};
    const raw = await r.json() as { data?: { abuseConfidenceScore?: number; totalReports?: number; lastReportedAt?: string | null; reports?: Array<{ categories?: number[] }> } };
    const data = raw.data ?? {};
    const CATEGORY_MAP: Record<number, string> = {
      3: "Fraud Orders", 4: "DDoS Attack", 5: "FTP Brute Force",
      6: "Ping of Death", 7: "Phishing", 8: "Fraud VoIP",
      9: "Open Proxy", 10: "Web Spam", 11: "Email Spam",
      14: "Port Scan", 15: "Hacking", 16: "SQL Injection",
      17: "Spoofing", 18: "Brute Force", 19: "Bad Web Bot",
      20: "Exploited Host", 21: "Web App Attack", 22: "SSH Brute Force",
      23: "IoT Targeted",
    };
    const categories = [...new Set(
      (data.reports ?? []).flatMap((rep: { categories?: number[] }) =>
        (rep.categories ?? []).map((c: number) => CATEGORY_MAP[c] ?? `Category ${c}`)
      ),
    )] as string[];
    return {
      abuseConfidenceScore: data.abuseConfidenceScore ?? 0,
      totalReports:         data.totalReports ?? 0,
      lastReportedAt:       data.lastReportedAt ?? null,
      abuseCategories:      categories,
    };
  } catch (err) {
    logger.warn({ err, ip }, "AbuseIPDB lookup failed");
    return {};
  }
}

async function fetchGreyNoise(ip: string): Promise<Partial<IpEnrichment>> {
  try {
    const r = await fetch(`https://api.greynoise.io/v3/community/${ip}`, {
      headers: {
        ...(GREYNOISE_KEY ? { key: GREYNOISE_KEY } : {}),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 404) {
      return {
        greynoiseClassification: "unknown",
        greynoiseIsBot: false, greynoiseIsTor: false,
        greynoiseIsVpn: false, greynoiseName: null, greynoiseLastSeen: null,
      };
    }
    if (!r.ok) return {};
    const d = await r.json() as { classification?: string; bot?: boolean; metadata?: { tor?: boolean }; vpn?: boolean; name?: string | null; last_seen?: string | null };
    return {
      greynoiseClassification: d.classification ?? "unknown",
      greynoiseIsBot:          d.bot ?? false,
      greynoiseIsTor:          d.metadata?.tor ?? false,
      greynoiseIsVpn:          d.vpn ?? false,
      greynoiseName:           d.name ?? null,
      greynoiseLastSeen:       d.last_seen ?? null,
    };
  } catch (err) {
    logger.warn({ err, ip }, "GreyNoise lookup failed");
    return {};
  }
}

async function fetchGeoData(ip: string): Promise<Partial<IpEnrichment>> {
  try {
    const r = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,isp,org,as`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) return {};
    const d = await r.json() as { status?: string; country?: string | null; countryCode?: string | null; city?: string | null; isp?: string | null; org?: string | null; as?: string | null };
    if (d.status !== "success") return {};
    const asnStr = d.as ?? "";
    const asnCode = asnStr.split(" ")[0] ?? "";
    return {
      country:              d.country ?? null,
      countryCode:          d.countryCode ?? null,
      city:                 d.city ?? null,
      asn:                  asnCode,
      asnOrg:               d.org ?? null,
      isp:                  d.isp ?? null,
      isBulletproofHosting: BULLETPROOF_ASNS.has(asnCode),
    };
  } catch (err) {
    logger.warn({ err, ip }, "Geo lookup failed");
    return {};
  }
}

async function getCachedEnrichment(ip: string): Promise<IpEnrichment | null> {
  try {
    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60_000);
    const [row] = await db.select()
      .from(ipEnrichmentCacheTable)
      .where(and(eq(ipEnrichmentCacheTable.ip, ip), gt(ipEnrichmentCacheTable.enrichedAt, cutoff)))
      .limit(1);
    return row ? (row.data as IpEnrichment) : null;
  } catch {
    return null;
  }
}

async function setCachedEnrichment(ip: string, data: IpEnrichment): Promise<void> {
  try {
    await db.insert(ipEnrichmentCacheTable)
      .values({ ip, data, enrichedAt: new Date() })
      .onConflictDoUpdate({
        target: ipEnrichmentCacheTable.ip,
        set: { data, enrichedAt: new Date() },
      });
  } catch {
    // Cache failure is non-fatal
  }
}

/**
 * Enrich an IP with all available threat intelligence.
 * Results are cached for 24 hours. All external calls run in parallel.
 * Total time: ~1-2s cold, ~1ms cached.
 */
export async function enrichIp(ip: string): Promise<IpEnrichment> {
  // Skip private/loopback IPs
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fd)/.test(ip)) {
    return {
      ip, abuseConfidenceScore: 0, totalReports: 0, lastReportedAt: null,
      abuseCategories: [], greynoiseClassification: "benign", greynoiseIsBot: false,
      greynoiseIsTor: false, greynoiseIsVpn: false, greynoiseName: "Private network",
      greynoiseLastSeen: null, country: null, countryCode: null, city: null,
      asn: null, asnOrg: "Private", isp: null, threatScore: 0, threatTags: [],
      threatCategory: "benign", isKnownMalicious: false, isBulletproofHosting: false,
      enrichedAt: new Date().toISOString(),
    };
  }

  const cached = await getCachedEnrichment(ip);
  if (cached) return cached;

  const [abuse, greynoise, geo] = await Promise.all([
    fetchAbuseIPDB(ip), fetchGreyNoise(ip), fetchGeoData(ip),
  ]);

  const partial: Partial<IpEnrichment> = { ip, ...abuse, ...greynoise, ...geo };
  const threatScore     = computeThreatScore(partial);
  const threatTags      = computeThreatTags(partial);
  const isKnownMalicious = (partial.abuseConfidenceScore ?? 0) > 80 ||
    partial.greynoiseClassification === "malicious";
  const threatCategory: IpEnrichment["threatCategory"] =
    threatScore >= 80 ? "critical" : threatScore >= 60 ? "high" :
    threatScore >= 40 ? "medium"  : threatScore >= 20 ? "low" : "benign";

  const enrichment: IpEnrichment = {
    ip,
    abuseConfidenceScore: partial.abuseConfidenceScore ?? 0,
    totalReports:         partial.totalReports ?? 0,
    lastReportedAt:       partial.lastReportedAt ?? null,
    abuseCategories:      partial.abuseCategories ?? [],
    greynoiseClassification: partial.greynoiseClassification ?? "unknown",
    greynoiseIsBot:       partial.greynoiseIsBot ?? false,
    greynoiseIsTor:       partial.greynoiseIsTor ?? false,
    greynoiseIsVpn:       partial.greynoiseIsVpn ?? false,
    greynoiseName:        partial.greynoiseName ?? null,
    greynoiseLastSeen:    partial.greynoiseLastSeen ?? null,
    country:              partial.country ?? null,
    countryCode:          partial.countryCode ?? null,
    city:                 partial.city ?? null,
    asn:                  partial.asn ?? null,
    asnOrg:               partial.asnOrg ?? null,
    isp:                  partial.isp ?? null,
    threatScore, threatTags, threatCategory, isKnownMalicious,
    isBulletproofHosting: partial.isBulletproofHosting ?? false,
    enrichedAt:           new Date().toISOString(),
  };

  await setCachedEnrichment(ip, enrichment);
  return enrichment;
}
