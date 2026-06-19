// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import fetch from "node-fetch";

const router = Router();

interface BlocklistEntry {
  ip: string;
  source: string;
  category: string;
  addedAt: string;
  notes: string;
}

const localBlocklist: BlocklistEntry[] = [];

const KNOWN_BAD_IP_PATTERNS = [
  "185.220.",
  "198.98.",
  "5.188.",
  "91.108.",
  "194.165.",
  "179.43.",
  "45.142.",
];

const TOR_EXIT_SAMPLE = [
  "185.220.101.1", "185.220.101.2", "185.220.102.1",
  "185.220.103.1", "185.220.104.1", "194.165.16.1",
  "199.249.230.1", "192.42.116.1",  "51.158.111.1",
  "104.244.73.1",  "45.151.167.1",  "23.129.64.1",
];

const VPN_RANGES = [
  { cidr: "103.21.244.0/22",  provider: "Cloudflare", type: "cdn" },
  { cidr: "185.130.44.0/22",  provider: "Mullvad",    type: "vpn" },
  { cidr: "193.32.160.0/24",  provider: "ProtonVPN",  type: "vpn" },
  { cidr: "198.54.128.0/18",  provider: "NordVPN",    type: "vpn" },
];

const THREAT_FEEDS = [
  { name: "Emerging Threats - Compromised IPs",   url: "https://rules.emergingthreats.net/blockrules/compromised-ips.txt",  category: "malware",    free: true  },
  { name: "Spamhaus DROP",                         url: "https://www.spamhaus.org/drop/drop.txt",                            category: "spam/botnet", free: true },
  { name: "Spamhaus EDROP",                        url: "https://www.spamhaus.org/drop/edrop.txt",                           category: "spam/botnet", free: true },
  { name: "FireHOL Level 1",                       url: "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset", category: "firehol", free: true },
  { name: "Tor Exit Nodes (torproject.org)",       url: "https://check.torproject.org/exit-addresses",                       category: "tor",        free: true },
  { name: "AbuseIPDB (API key required)",          url: "https://api.abuseipdb.com/api/v2/blacklist",                        category: "abuse",      free: false },
];

function scoreIp(ip: string): {
  score: number;
  risk: "low" | "medium" | "high" | "critical";
  flags: string[];
} {
  const flags: string[] = [];
  let score = 0;

  if (TOR_EXIT_SAMPLE.some(t => t === ip)) {
    flags.push("tor_exit_node");
    score += 40;
  }
  if (KNOWN_BAD_IP_PATTERNS.some(p => ip.startsWith(p))) {
    flags.push("known_malicious_range");
    score += 50;
  }
  if (localBlocklist.some(b => b.ip === ip)) {
    flags.push("local_blocklist");
    score += 60;
  }
  if (ip.startsWith("185.220.")) {
    flags.push("tor_relay_infrastructure");
    score += 30;
  }
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip)) {
    flags.push("private_range");
    score = 0;
  }

  const risk: "low" | "medium" | "high" | "critical" =
    score >= 80 ? "critical" :
    score >= 50 ? "high" :
    score >= 20 ? "medium" : "low";

  return { score, risk, flags };
}

router.get("/feeds", (_req, res) => {
  res.json({
    feeds: THREAT_FEEDS,
    torExitSample: TOR_EXIT_SAMPLE,
    vpnRanges: VPN_RANGES,
    localBlocklistSize: localBlocklist.length,
    updatedAt: new Date().toISOString(),
  });
});

router.post("/check-ip", asyncHandler(async (req, res) => {
  const { ip } = z.object({ ip: z.string().min(1).max(45) }).parse(req.body);
  if (!/^[\d.:a-f]+$/i.test(ip)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  const { score, risk, flags } = scoreIp(ip);

  let abuseData: any = null;
  try {
    const resp = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal: AbortSignal.timeout(5000),
    });
    abuseData = await resp.json() as any;
  } catch { }

  res.json({
    ip,
    score,
    risk,
    flags,
    isTorExit: flags.includes("tor_exit_node"),
    isKnownMalicious: flags.includes("known_malicious_range"),
    inLocalBlocklist: flags.includes("local_blocklist"),
    geo: abuseData
      ? {
          country:      abuseData.country ?? "??",
          city:         abuseData.city ?? "unknown",
          org:          abuseData.org ?? "unknown",
          hostname:     abuseData.hostname ?? null,
          timezone:     abuseData.timezone ?? null,
        }
      : null,
    recommendation:
      risk === "critical" ? "Block immediately — high-confidence malicious actor."
      : risk === "high"   ? "Block recommended — known bad range or Tor exit."
      : risk === "medium" ? "Monitor — suspicious patterns detected."
      : "No known threats detected.",
    checkedAt: new Date().toISOString(),
  });
}));

router.get("/blocklist", (_req, res) => {
  res.json({
    entries: localBlocklist,
    total: localBlocklist.length,
    torExitNodes: TOR_EXIT_SAMPLE.length,
    knownBadRanges: KNOWN_BAD_IP_PATTERNS,
  });
});

router.post("/blocklist", (req, res) => {
  const { ip, category, notes } = req.body as { ip?: string; category?: string; notes?: string };
  if (!ip) return res.status(400).json({ error: "ip required" });
  if (localBlocklist.some(b => b.ip === ip)) {
    return res.status(409).json({ error: "IP already in blocklist" });
  }
  const entry: BlocklistEntry = {
    ip,
    source: "manual",
    category: category ?? "manual",
    addedAt: new Date().toISOString(),
    notes: notes ?? "",
  };
  localBlocklist.push(entry);
  res.status(201).json(entry);
});

router.delete("/blocklist/:ip", (req, res) => {
  const idx = localBlocklist.findIndex(b => b.ip === req.params.ip);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  localBlocklist.splice(idx, 1);
  res.json({ removed: req.params.ip });
});

router.get("/tor-exits", asyncHandler(async (_req, res) => {
  try {
    const resp = await fetch("https://check.torproject.org/exit-addresses", {
      signal: AbortSignal.timeout(8000),
    });
    const text = await resp.text();
    const ips = [...text.matchAll(/ExitAddress\s+([\d.]+)/g)].map(m => m[1]);
    res.json({ count: ips.length, exits: ips.slice(0, 200), source: "torproject.org", fetchedAt: new Date().toISOString() });
  } catch (e: any) {
    res.json({ count: TOR_EXIT_SAMPLE.length, exits: TOR_EXIT_SAMPLE, source: "local-cache", error: e.message });
  }
}));

router.get("/summary", (_req, res) => {
  res.json({
    feeds: THREAT_FEEDS.length,
    activeFeedsWithFreeAccess: THREAT_FEEDS.filter(f => f.free).length,
    torExitNodesTracked: TOR_EXIT_SAMPLE.length,
    localBlocklistEntries: localBlocklist.length,
    vpnRangesTracked: VPN_RANGES.length,
    knownBadRanges: KNOWN_BAD_IP_PATTERNS.length,
    lastRefreshed: new Date().toISOString(),
  });
});

// POST /api/threatintel/nrd-check
// Newly Registered Domain detection via RDAP — flags domains < 30 days old
// as C2 infrastructure / phishing domains (high attacker-infra indicator)
router.post("/nrd-check", asyncHandler(async (req, res) => {
  const { domain } = z.object({ domain: z.string().min(1).max(253) }).parse(req.body);

  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return res.status(400).json({ error: "Invalid domain format" });
  }

  const parts = domain.replace(/\.$/, "").split(".");
  const rootDomain = parts.length >= 2 ? parts.slice(-2).join(".") : domain;

  let registrationDate: Date | null = null;
  let lastUpdated: Date | null = null;
  let registrar: string | null = null;
  let rdapSource = "";

  try {
    const rdapResp = await fetch(`https://rdap.org/domain/${rootDomain}`, {
      signal: AbortSignal.timeout(7000),
      headers: { Accept: "application/json" },
    });
    if (rdapResp.ok) {
      const rdapData = await rdapResp.json() as any;
      const events: Array<{ eventAction: string; eventDate: string }> =
        rdapData.events ?? [];
      const regEvent = events.find(e => e.eventAction === "registration");
      const updEvent = events.find(e => e.eventAction === "last changed");
      if (regEvent?.eventDate) {
        registrationDate = new Date(regEvent.eventDate);
        rdapSource = "rdap.org";
      }
      if (updEvent?.eventDate) lastUpdated = new Date(updEvent.eventDate);
      const entities: any[] = rdapData.entities ?? [];
      const regEntity = entities.find((e: any) => e.roles?.includes("registrar"));
      const vcardArr: any[][] = regEntity?.vcardArray?.[1] ?? [];
      const fnEntry = vcardArr.find((v: any[]) => v[0] === "fn");
      registrar = fnEntry?.[3] ?? null;
    }
  } catch { }

  const ageMs = registrationDate ? Date.now() - registrationDate.getTime() : null;
  const ageDays = ageMs !== null ? Math.floor(ageMs / 86_400_000) : null;

  const isNrd     = ageDays !== null && ageDays < 30;
  const isRecent  = ageDays !== null && ageDays < 90;

  const risk: "critical" | "high" | "medium" | "low" =
    ageDays === null ? "medium" :
    ageDays < 7     ? "critical" :
    ageDays < 30    ? "high" :
    ageDays < 90    ? "medium" : "low";

  const flags: string[] = [
    ...(ageDays !== null && ageDays < 7 ? ["suspicious_freshness"] : []),
    ...(isNrd     ? ["newly_registered_domain"] : []),
    ...(isRecent  ? ["recently_registered"]     : []),
  ];

  res.json({
    domain,
    rootDomain,
    registrationDate: registrationDate?.toISOString() ?? null,
    lastUpdated:      lastUpdated?.toISOString() ?? null,
    ageDays,
    registrar,
    isNrd,
    isRecent,
    risk,
    rdapSource: rdapSource || null,
    flags,
    recommendation:
      risk === "critical"
        ? "BLOCK — domain registered < 7 days ago. Extremely high C2/phishing risk."
        : risk === "high"
        ? "BLOCK — NRD < 30 days old. High probability attacker infrastructure."
        : risk === "medium"
        ? "MONITOR — recently registered or registration date unavailable."
        : "Clean — domain age predates typical attacker infrastructure windows.",
    checkedAt: new Date().toISOString(),
  });
}));

export default router;

