import { Router } from "express";
import https from "https";
import http from "http";

const router = Router();

const VPNGATE_API = "https://www.vpngate.net/api/iphone/";
const CACHE_TTL = 5 * 60 * 1000;

export interface VpnGateServer {
  hostname: string;
  ip: string;
  score: number;
  ping: number;
  speedBps: number;
  speedMbps: number;
  country: string;
  countryCode: string;
  sessions: number;
  uptimeMs: number;
  totalUsers: number;
  totalTrafficGb: number;
  logType: string;
  operator: string;
  message: string;
  hasOvpn: boolean;
  ovpnConfigB64: string;
}

let cache: { data: VpnGateServer[]; ts: number } | null = null;

function fetchRaw(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchRaw(loc).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
  });
}

function parseCSV(raw: string): VpnGateServer[] {
  const lines = raw.split("\n");
  const dataLines = lines.filter((l) => l.trim() && !l.startsWith("*"));
  if (dataLines.length < 2) return [];

  const headerLine = dataLines[0].replace(/^#/, "").trim();
  const headers = headerLine.split(",");

  const idxOf = (name: string) => headers.indexOf(name);

  const servers: VpnGateServer[] = [];

  for (let i = 1; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < headers.length - 1) continue;

    const get = (name: string) => {
      const idx = idxOf(name);
      return idx >= 0 && idx < parts.length ? parts[idx] : "";
    };

    const speedBps = parseInt(get("Speed")) || 0;
    const totalTrafficBytes = parseInt(get("TotalTraffic")) || 0;
    const ovpnB64 = parts[parts.length - 1]?.trim() || "";

    servers.push({
      hostname: get("HostName"),
      ip: get("IP"),
      score: parseInt(get("Score")) || 0,
      ping: parseInt(get("Ping")) || 0,
      speedBps,
      speedMbps: Math.round((speedBps / 1_000_000) * 10) / 10,
      country: get("CountryLong"),
      countryCode: get("CountryShort").toUpperCase(),
      sessions: parseInt(get("NumVpnSessions")) || 0,
      uptimeMs: parseInt(get("Uptime")) || 0,
      totalUsers: parseInt(get("TotalUsers")) || 0,
      totalTrafficGb: Math.round((totalTrafficBytes / 1_000_000_000) * 10) / 10,
      logType: get("LogType"),
      operator: get("Operator"),
      message: get("Message"),
      hasOvpn: ovpnB64.length > 10,
      ovpnConfigB64: ovpnB64,
    });
  }

  return servers.sort((a, b) => b.score - a.score);
}

async function getServers(): Promise<VpnGateServer[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) return cache.data;

  try {
    const raw = await fetchRaw(VPNGATE_API);
    const data = parseCSV(raw);
    if (data.length > 0) cache = { data, ts: now };
    return data;
  } catch {
    if (cache) return cache.data;
    throw new Error("VPN Gate API unreachable and no cached data available");
  }
}

router.get("/servers", async (req, res) => {
  try {
    let servers = await getServers();

    const { country, maxPing, minSpeed, limit } = req.query as Record<string, string>;

    if (country) {
      const q = country.toLowerCase();
      servers = servers.filter(
        (s) => s.countryCode.toLowerCase() === q || s.country.toLowerCase().includes(q),
      );
    }
    if (maxPing) servers = servers.filter((s) => s.ping <= parseInt(maxPing));
    if (minSpeed) servers = servers.filter((s) => s.speedMbps >= parseFloat(minSpeed));

    const limitN = Math.min(parseInt(limit) || 500, 2000);
    const paginated = servers.slice(0, limitN);

    res.json({
      servers: paginated,
      total: servers.length,
      shown: paginated.length,
      cacheAgeSeconds: cache ? Math.round((Date.now() - cache.ts) / 1000) : 0,
    });
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch VPN Gate servers", detail: e.message });
  }
});

router.get("/servers/best", async (req, res) => {
  try {
    const servers = await getServers();
    const { country, maxPing } = req.query as Record<string, string>;
    let pool = servers;
    if (country) {
      const q = country.toLowerCase();
      pool = pool.filter((s) => s.countryCode.toLowerCase() === q || s.country.toLowerCase().includes(q));
    }
    if (maxPing) pool = pool.filter((s) => s.ping <= parseInt(maxPing));
    const best = pool[0];
    if (!best) return res.status(404).json({ error: "No matching servers available" });
    res.json(best);
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch VPN Gate servers", detail: e.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const servers = await getServers();
    const countries = [...new Set(servers.map((s) => s.countryCode))].sort();
    const avgPing = servers.length
      ? Math.round(servers.reduce((s, n) => s + n.ping, 0) / servers.length)
      : 0;
    const avgSpeed =
      servers.length
        ? Math.round((servers.reduce((s, n) => s + n.speedMbps, 0) / servers.length) * 10) / 10
        : 0;
    const totalSessions = servers.reduce((s, n) => s + n.sessions, 0);

    const byCountry: Record<string, number> = {};
    for (const s of servers) byCountry[s.countryCode] = (byCountry[s.countryCode] || 0) + 1;
    const topCountries = Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([code, count]) => ({ code, count }));

    res.json({
      totalServers: servers.length,
      countries: countries.length,
      avgPingMs: avgPing,
      avgSpeedMbps: avgSpeed,
      totalSessions,
      topCountries,
      cacheAgeSeconds: cache ? Math.round((Date.now() - cache.ts) / 1000) : 0,
    });
  } catch (e: any) {
    res.status(502).json({ error: "Failed to fetch VPN Gate stats", detail: e.message });
  }
});

router.delete("/cache", (_req, res) => {
  cache = null;
  res.json({ message: "Cache cleared" });
});

router.get("/servers/:ip/config", async (req, res) => {
  try {
    const servers = await getServers();
    const server = servers.find((s) => s.ip === req.params.ip);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (!server.hasOvpn) return res.status(404).json({ error: "No OpenVPN config for this server" });

    let config: string;
    try {
      config = Buffer.from(server.ovpnConfigB64, "base64").toString("utf-8");
    } catch {
      return res.status(500).json({ error: "Failed to decode OpenVPN config" });
    }

    res.setHeader("Content-Type", "application/x-openvpn-profile");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vpngate-${server.countryCode}-${server.ip}.ovpn"`,
    );
    res.send(config);
  } catch (e: any) {
    res.status(502).json({ error: "Failed to get config", detail: e.message });
  }
});

export default router;
