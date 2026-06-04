// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import dns from "dns/promises";
import https from "https";
import http from "http";
import tls from "tls";
import { URL } from "url";
import crypto from "crypto";
import { z } from "zod";

const router = Router();

function fetchHead(urlStr: string, timeoutMs = 6000): Promise<{ status: number; headers: Record<string, string> } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        {
          host: parsed.hostname,
          path: parsed.pathname || "/",
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          method: "HEAD",
          headers: { "User-Agent": "Mozilla/5.0 ProxhqVPN-OSINT/1.0" },
          timeout: timeoutMs,
          rejectUnauthorized: false,
        },
        res => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k.toLowerCase()] = v;
            else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0];
          }
          res.destroy();
          resolve({ status: res.statusCode || 0, headers });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function getTlsCert(hostname: string): Promise<{
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  protocol: string;
  sans: string[];
} | null> {
  return new Promise(resolve => {
    try {
      const sock = tls.connect({ host: hostname, port: 443, rejectUnauthorized: false, timeout: 6000 }, () => {
        const cert = sock.getPeerCertificate(true);
        const protocol = sock.getProtocol() || "unknown";
        if (!cert || !cert.subject) { sock.destroy(); return resolve(null); }
        const validTo = cert.valid_to ? new Date(cert.valid_to) : new Date(0);
        const daysLeft = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
        const sans: string[] = [];
        if (cert.subjectaltname) {
          cert.subjectaltname.split(",").forEach(s => {
            const m = s.trim().match(/DNS:(.+)/);
            if (m) sans.push(m[1]);
          });
        }
        sock.destroy();
        resolve({
          subject: (cert.subject?.CN as string | undefined) || hostname,
          issuer: ((cert.issuer?.O || cert.issuer?.CN) as string | undefined) || "unknown",
          validFrom: cert.valid_from || "",
          validTo: cert.valid_to || "",
          daysLeft,
          protocol,
          sans,
        });
      });
      sock.on("error", () => resolve(null));
      sock.on("timeout", () => { sock.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

router.post("/lookup", async (req: Request, res: Response) => {
  let { target } = req.body as { target: string };
  if (!target) return res.status(400).json({ error: "target required" });

  target = target.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "").toLowerCase();

  if (target === "localhost" || target.startsWith("127.") || target.startsWith("192.168.") || target.startsWith("10.")) {
    return res.status(400).json({ error: "Private/internal targets not allowed" });
  }

  const result: Record<string, unknown> = { target, timestamp: new Date().toISOString() };

  const tasks = await Promise.allSettled([
    dns.resolve4(target).catch(() => [] as string[]),
    dns.resolve6(target).catch(() => [] as string[]),
    dns.resolveMx(target).catch(() => []),
    dns.resolveTxt(target).catch(() => []),
    dns.resolveNs(target).catch(() => [] as string[]),
    dns.resolveCname(target).catch(() => [] as string[]),
    dns.reverse(target).catch(() => [] as string[]),
    fetchHead(`https://${target}`),
    getTlsCert(target),
  ]);

  const [ipv4, ipv6, mx, txt, ns, cname, reverse, httpHead, tlsCert] = tasks.map(r =>
    r.status === "fulfilled" ? r.value : null
  );

  result.dns = {
    a: ipv4 || [],
    aaaa: ipv6 || [],
    mx: Array.isArray(mx) ? mx.map((m: any) => ({ exchange: m.exchange, priority: m.priority })) : [],
    txt: Array.isArray(txt) ? txt.flat() : [],
    ns: ns || [],
    cname: cname || [],
    ptr: reverse || [],
  };

  if (httpHead) {
    result.http = {
      status: (httpHead as any).status,
      server: (httpHead as any).headers?.server || null,
      poweredBy: (httpHead as any).headers?.["x-powered-by"] || null,
      contentType: (httpHead as any).headers?.["content-type"] || null,
      via: (httpHead as any).headers?.["via"] || null,
      cdn: detectCdn((httpHead as any).headers || {}),
      hasHsts: !!(httpHead as any).headers?.["strict-transport-security"],
      hasCsp: !!(httpHead as any).headers?.["content-security-policy"],
      hasCors: !!(httpHead as any).headers?.["access-control-allow-origin"],
    };
  }

  if (tlsCert) {
    result.tls = tlsCert;
  }

  const ipList: string[] = Array.isArray(ipv4) && (ipv4 as unknown[]).length > 0 ? (ipv4 as string[]) : [];
  if (ipList.length > 0) {
    result.ip = {
      primary: ipList[0],
      all: ipList,
      asn: inferAsn(ipList[0]),
      isCloudflare: ipList.some(isCloudflareIp),
      isAws: ipList.some(ip => isAwsIp(ip)),
    };
  }

  const txtRecords = Array.isArray(txt) ? (txt as string[][]).flat() : [];
  result.email = {
    mxCount: Array.isArray(mx) ? mx.length : 0,
    hasDkim: txtRecords.some(t => t.includes("v=DKIM1")),
    hasDmarc: false,
    hasSpf: txtRecords.some(t => t.includes("v=spf1")),
  };

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${target}`).catch(() => []);
    result.email = { ...(result.email as Record<string, unknown>), hasDmarc: (dmarcRecords as string[][]).flat().some(t => t.includes("v=DMARC1")) };
  } catch {}

  result.exposure = {
    emailSecurity: buildEmailSecurity(result.email as Record<string, boolean>),
    tlsRisk: buildTlsRisk(tlsCert),
    headerRisk: buildHeaderRisk(httpHead ? (httpHead as any).headers : {}),
    subdomainsInCert: tlsCert && Array.isArray((tlsCert as any).sans) ? (tlsCert as any).sans : [],
  };

  res.json(result);
});

function detectCdn(headers: Record<string, string>): string | null {
  const cf = headers["cf-ray"] || headers["cf-cache-status"];
  if (cf) return "Cloudflare";
  const f = headers["x-served-by"] || headers["x-fastly-request-id"];
  if (f) return "Fastly";
  const ak = headers["x-akamai-transformed"] || headers["x-check-cacheable"];
  if (ak) return "Akamai";
  const via = headers["via"] || "";
  if (via.includes("CloudFront")) return "AWS CloudFront";
  if (via.includes("Varnish") || via.includes("nginx")) return via.includes("Varnish") ? "Varnish" : "nginx";
  return null;
}

function inferAsn(ip: string): string {
  if (!ip) return "Unknown";
  const oct = ip.split(".").map(Number);
  if (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) return "RFC1918 Private";
  if ((oct[0] === 104 && oct[1] >= 16 && oct[1] <= 31) || (oct[0] === 172 && oct[1] >= 64 && oct[1] <= 71)) return "AS13335 Cloudflare";
  if (oct[0] === 54 || oct[0] === 52 || (oct[0] === 3 && oct[1] < 128)) return "AS14618 Amazon AWS";
  if (oct[0] === 34 || oct[0] === 35) return "AS15169 Google Cloud";
  if (oct[0] === 40 || oct[0] === 13) return "AS8075 Microsoft Azure";
  return "Unknown ASN";
}

function isCloudflareIp(ip: string): boolean {
  const oct = ip.split(".").map(Number);
  return (oct[0] === 104 && oct[1] >= 16 && oct[1] <= 31) || (oct[0] === 172 && oct[1] >= 64 && oct[1] <= 71);
}

function isAwsIp(ip: string): boolean {
  const oct = ip.split(".").map(Number);
  return oct[0] === 54 || oct[0] === 52 || (oct[0] === 3 && oct[1] < 128);
}

function buildEmailSecurity(email: Record<string, boolean>) {
  const score = (email.hasDkim ? 33 : 0) + (email.hasDmarc ? 34 : 0) + (email.hasSpf ? 33 : 0);
  return { score, hasDkim: email.hasDkim, hasDmarc: email.hasDmarc, hasSpf: email.hasSpf };
}

function buildTlsRisk(cert: unknown) {
  if (!cert) return { risk: "high", reason: "TLS certificate not found or unreachable" };
  const c = cert as { daysLeft: number; protocol: string };
  if (c.daysLeft <= 0) return { risk: "critical", reason: "Certificate expired" };
  if (c.daysLeft <= 30) return { risk: "high", reason: `Certificate expires in ${c.daysLeft} days` };
  if (/TLSv1$|TLSv1\.0|TLSv1\.1|SSL/.test(c.protocol)) return { risk: "high", reason: `Outdated TLS: ${c.protocol}` };
  return { risk: "low", reason: `Valid certificate, ${c.daysLeft} days remaining, ${c.protocol}` };
}

function buildHeaderRisk(headers: Record<string, string>) {
  const missing = [];
  if (!headers["strict-transport-security"]) missing.push("HSTS");
  if (!headers["content-security-policy"]) missing.push("CSP");
  if (!headers["x-frame-options"]) missing.push("X-Frame-Options");
  if (!headers["x-content-type-options"]) missing.push("X-Content-Type-Options");
  const corsWild = headers["access-control-allow-origin"] === "*";
  return {
    risk: missing.length >= 3 ? "high" : missing.length >= 1 ? "medium" : "low",
    missingHeaders: missing,
    corsWildcard: corsWild,
  };
}

// ── Username enumeration ──────────────────────────────────────────────────────

interface Platform {
  name: string;
  category: string;
  /** URL used for the HTTP check — may be an API endpoint. Use {u} placeholder. */
  url: string;
  /** Human-readable profile URL to display/link. Defaults to `url`. Use {u} placeholder. */
  profileUrl?: string;
  /** If true, cannot be checked via passive HTTP — returned as status "manual". */
  manualCheck?: boolean;
  manualNote?: string;
  /**
   * For JSON API endpoints (GitHub, Reddit, HN): "json"
   * For normal HTML: undefined (HEAD check)
   */
  checkMode?: "json" | "hn_json" | "discord_auto" | "bigo_id";
}

const PLATFORMS: Platform[] = [
  // Social
  { name: "X (Twitter)",    category: "Social",    url: "https://x.com/{u}" },
  { name: "Instagram",      category: "Social",    url: "https://www.instagram.com/{u}/" },
  { name: "TikTok",         category: "Social",    url: "https://www.tiktok.com/@{u}" },
  { name: "Facebook",       category: "Social",    url: "https://www.facebook.com/{u}" },
  { name: "Snapchat",       category: "Social",    url: "https://www.snapchat.com/add/{u}" },
  { name: "Pinterest",      category: "Social",    url: "https://www.pinterest.com/{u}/" },
  { name: "Tumblr",         category: "Social",    url: "https://{u}.tumblr.com" },
  { name: "Bluesky",        category: "Social",    url: "https://bsky.app/profile/{u}.bsky.social" },
  { name: "Mastodon",       category: "Social",    url: "https://mastodon.social/@{u}" },
  { name: "Threads",        category: "Social",    url: "https://www.threads.net/@{u}" },
  // Discord: auto-resolved via lookup.guru, discord.id, and discordlookup.com
  {
    name: "Discord", category: "Social",
    url: "https://discord.com/users/{u}",
    checkMode: "discord_auto",
  },
  // Video / Streaming / Live
  { name: "YouTube",        category: "Video",     url: "https://www.youtube.com/@{u}" },
  { name: "Twitch",         category: "Video",     url: "https://www.twitch.tv/{u}" },
  { name: "Vimeo",          category: "Video",     url: "https://vimeo.com/{u}" },
  { name: "Dailymotion",    category: "Video",     url: "https://www.dailymotion.com/{u}" },
  // Bigo Live: profile URL accepts both username and numeric Bigo ID
  { name: "Bigo Live",      category: "Live",      url: "https://www.bigo.tv/{u}", profileUrl: "https://www.bigo.tv/{u}" },
  { name: "Likee",          category: "Live",      url: "https://likee.video/@{u}" },
  { name: "Kick",           category: "Live",      url: "https://kick.com/{u}" },
  { name: "Rumble",         category: "Live",      url: "https://rumble.com/user/{u}" },
  { name: "Trovo",          category: "Live",      url: "https://trovo.live/{u}" },
  // Dev / Tech — GitHub, Reddit & HN use their public JSON APIs for reliable checks
  {
    name: "GitHub",         category: "Dev",
    url: "https://api.github.com/users/{u}",
    profileUrl: "https://github.com/{u}",
    checkMode: "json",
  },
  { name: "GitLab",         category: "Dev",       url: "https://gitlab.com/{u}" },
  { name: "Replit",         category: "Dev",       url: "https://replit.com/@{u}" },
  { name: "Keybase",        category: "Dev",       url: "https://keybase.io/{u}" },
  {
    name: "HackerNews",     category: "Dev",
    url: "https://hacker-news.firebaseio.com/v0/user/{u}.json",
    profileUrl: "https://news.ycombinator.com/user?id={u}",
    checkMode: "hn_json",
  },
  { name: "Stack Overflow", category: "Dev",       url: "https://stackoverflow.com/users/{u}" },
  // Professional
  { name: "LinkedIn",       category: "Pro",       url: "https://www.linkedin.com/in/{u}/" },
  { name: "Medium",         category: "Pro",       url: "https://medium.com/@{u}" },
  { name: "Substack",       category: "Pro",       url: "https://{u}.substack.com" },
  { name: "Patreon",        category: "Pro",       url: "https://www.patreon.com/{u}" },
  { name: "Product Hunt",   category: "Pro",       url: "https://www.producthunt.com/@{u}" },
  // Creative
  { name: "Behance",        category: "Creative",  url: "https://www.behance.net/{u}" },
  { name: "Dribbble",       category: "Creative",  url: "https://dribbble.com/{u}" },
  { name: "DeviantArt",     category: "Creative",  url: "https://www.deviantart.com/{u}" },
  { name: "Flickr",         category: "Creative",  url: "https://www.flickr.com/people/{u}/" },
  { name: "SoundCloud",     category: "Creative",  url: "https://soundcloud.com/{u}" },
  { name: "Bandcamp",       category: "Creative",  url: "https://{u}.bandcamp.com" },
  // Gaming
  { name: "Steam",          category: "Gaming",    url: "https://steamcommunity.com/id/{u}" },
  { name: "Roblox",         category: "Gaming",    url: "https://www.roblox.com/user.aspx?username={u}" },
  // Messaging / Community
  { name: "Telegram",       category: "Messaging", url: "https://t.me/{u}" },
  {
    name: "Reddit",         category: "Community",
    url: "https://www.reddit.com/user/{u}/about.json",
    profileUrl: "https://www.reddit.com/user/{u}",
    checkMode: "json",
  },
  { name: "Quora",          category: "Community", url: "https://www.quora.com/profile/{u}" },
];

type PlatformStatus = "found" | "not_found" | "possible" | "timeout" | "error" | "manual";

interface PlatformCheckResult {
  name: string;
  category: string;
  /** Profile URL to display/link (human-readable, not the API URL) */
  url: string;
  status: PlatformStatus;
  statusCode: number | null;
  manualNote?: string;
}

/** Patterns in the redirect Location header that signal the account does NOT exist */
const LOGIN_REDIRECT_PATTERNS = [
  "login", "signin", "sign-in", "sign_in", "auth", "checkpoint",
  "accounts/login", "session/new",
];

function isLoginOrHomeRedirect(location: string, parsedOriginal: URL): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  // Redirects to root → home page
  if (loc === "/" || loc === parsedOriginal.origin + "/" || loc === parsedOriginal.origin) return true;
  // Redirects to a login/auth page
  if (LOGIN_REDIRECT_PATTERNS.some(p => loc.includes(p))) return true;
  return false;
}

function checkUsername(platform: Platform, username: string, timeoutMs = 8000): Promise<PlatformCheckResult> {
  // Manual-check platforms — legacy fallback
  if (platform.manualCheck) {
    return Promise.resolve({
      name: platform.name, category: platform.category, url: "",
      status: "manual", statusCode: null, manualNote: platform.manualNote,
    });
  }

  // Discord: auto-resolve username → User ID via 3 public lookup sources
  if (platform.checkMode === "discord_auto") {
    return (async () => {
      try {
        const [guru, did] = await Promise.all([
          discordLookupGuru(username).catch(() => ({} as { userId?: string; displayName?: string })),
          discordIdLookup(username).catch(() => ({} as { userId?: string; displayName?: string })),
        ]);
        const userId = (guru as any).userId ?? (did as any).userId;
        const displayName = (guru as any).displayName ?? (did as any).displayName;
        if (userId) {
          return {
            name: platform.name, category: platform.category,
            url: `https://discord.com/users/${userId}`,
            status: "found" as const, statusCode: null,
            manualNote: `User ID: ${userId}${displayName ? ` · ${displayName}` : ""}`,
          };
        }
        return { name: platform.name, category: platform.category, url: "", status: "not_found" as const, statusCode: null };
      } catch {
        return { name: platform.name, category: platform.category, url: "", status: "error" as const, statusCode: null };
      }
    })();
  }

  const checkUrl = platform.url.replace(/\{u\}/g, encodeURIComponent(username));
  const profileUrl = (platform.profileUrl ?? platform.url).replace(/\{u\}/g, encodeURIComponent(username));

  return new Promise(resolve => {
    const out = (status: PlatformStatus, code: number | null) =>
      resolve({ name: platform.name, category: platform.category, url: profileUrl, status, statusCode: code });

    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; out("timeout", null); } }, timeoutMs);

    // ── JSON API mode (GitHub, Reddit, HackerNews) ────────────────────────────
    if (platform.checkMode === "json" || platform.checkMode === "hn_json") {
      fetchBody(checkUrl, timeoutMs - 500).then(body => {
        clearTimeout(timer);
        if (!body) { out("error", null); return; }
        if (platform.checkMode === "hn_json") {
          // HN returns "null\n" for non-existent users
          const trimmed = body.trim();
          if (trimmed === "null" || trimmed === "") out("not_found", 200);
          else out("found", 200);
        } else {
          // GitHub returns {"message":"Not Found"} with 404; Reddit /about.json returns 404 for private/non-existent
          // If body parsed OK and has login/error fields → not found
          try {
            const parsed = JSON.parse(body) as Record<string, unknown>;
            if (parsed.message === "Not Found" || parsed.error === "Not Found" || parsed.reason === "banned") {
              out("not_found", 404);
            } else if (parsed.login || parsed.name || parsed.data) {
              out("found", 200);
            } else {
              out("possible", 200);
            }
          } catch { out("possible", 200); }
        }
      }).catch(() => { clearTimeout(timer); out("error", null); });
      return;
    }

    // ── Normal HEAD check ─────────────────────────────────────────────────────
    try {
      const parsed = new URL(checkUrl);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        {
          host: parsed.hostname,
          path: parsed.pathname + (parsed.search || ""),
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
            "Accept-Language": "en-US,en;q=0.9",
          },
          timeout: timeoutMs - 500,
          rejectUnauthorized: false,
        },
        res => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const code = res.statusCode ?? 0;
          const location = (res.headers.location as string | undefined) ?? "";
          res.resume();

          if (code === 200) {
            out("found", code);
          } else if (code === 404 || code === 410) {
            out("not_found", code);
          } else if (code === 301 || code === 302 || code === 303 || code === 307 || code === 308) {
            // Check if this redirect leads to a login/home page (= account doesn't exist publicly)
            if (isLoginOrHomeRedirect(location, parsed)) {
              out("not_found", code);
            } else if (location.toLowerCase().includes(username.toLowerCase())) {
              // Redirect still contains username → likely canonical redirect, profile exists
              out("found", code);
            } else {
              // Unknown redirect destination — can't confirm
              out("possible", code);
            }
          } else if (code === 403 || code === 429 || code === 401) {
            // Bot-blocked — can't confirm but URL pattern exists on the platform
            out("possible", code);
          } else {
            out("possible", code);
          }
        }
      );
      req.on("error", () => { if (!done) { done = true; clearTimeout(timer); out("error", null); } });
      req.on("timeout", () => { req.destroy(); if (!done) { done = true; clearTimeout(timer); out("timeout", null); } });
      req.end();
    } catch {
      if (!done) { done = true; clearTimeout(timer); out("error", null); }
    }
  });
}

// ── Helpers for exposure analysis ─────────────────────────────────────────────

/** Extract <title> and <meta name="description"> from a URL via GET (best-effort) */
function extractProfileSnippet(urlStr: string, timeoutMs = 6000): Promise<{ title?: string; description?: string }> {
  return new Promise(resolve => {
    let done = false;
    const finish = (v: { title?: string; description?: string }) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish({}), timeoutMs);
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        { host: parsed.hostname, path: parsed.pathname + (parsed.search || ""),
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          method: "GET", timeout: timeoutMs - 200, rejectUnauthorized: false,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ProxhqOSINT/1.0)", "Accept": "text/html" } },
        res => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", chunk => { body += chunk; if (body.length > 20000) { res.destroy(); } });
          res.on("end", () => {
            clearTimeout(timer);
            const titleMatch = body.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
            const descMatch  = body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i)
                            || body.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i);
            const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim();
            const description = descMatch?.[1]?.replace(/\s+/g, " ").trim();
            finish({ title, description });
          });
        }
      );
      req.on("error", () => { clearTimeout(timer); finish({}); });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); finish({}); });
      req.end();
    } catch { clearTimeout(timer); finish({}); }
  });
}

/** Check if a Gravatar exists for an email (returns true if 200) */
function checkGravatar(email: string): Promise<boolean> {
  const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  const url = `https://www.gravatar.com/avatar/${hash}?d=404&s=1`;
  return new Promise(resolve => {
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(false), 5000);
    try {
      const req = https.request(
        { host: "www.gravatar.com", path: `/avatar/${hash}?d=404&s=1`, method: "HEAD",
          timeout: 4800, rejectUnauthorized: false,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ProxhqOSINT/1.0)" } },
        res => { clearTimeout(timer); res.resume(); finish(res.statusCode === 200); }
      );
      req.on("error", () => { clearTimeout(timer); finish(false); });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); finish(false); });
      req.end();
    } catch { clearTimeout(timer); finish(false); }
  });
}

/** Generate Google-dork and OSINT search queries for a username */
function buildDorkQueries(username: string): string[] {
  const u = username;
  return [
    `"${u}" site:pastebin.com`,
    `"${u}" site:github.com`,
    `"${u}" "@gmail.com" OR "@yahoo.com" OR "@hotmail.com"`,
    `"${u}" "password" OR "leaked" OR "breach"`,
    `"${u}" filetype:sql OR filetype:csv OR filetype:txt`,
    `"${u}" site:linkedin.com`,
    `intext:"${u}" site:reddit.com`,
    `"${u}" "phone" OR "address" OR "dob" OR "date of birth"`,
    `"${u}" site:twitter.com OR site:x.com`,
    `"${u}" site:facebook.com`,
    `inurl:"${u}" site:keybase.io`,
    `"${u}" "ssn" OR "social security" OR "credit card"`,
    `"${u}" site:raidforums.com OR site:breachforums.com OR site:darkforum`,
    `"${u}" site:ghostbin.co OR site:hastebin.com OR site:rentry.co`,
  ];
}

// ── Dark web / paste site scanning ───────────────────────────────────────────

interface DarkWebResult {
  source: string;
  type: "dark_web" | "paste" | "breach_index";
  status: "found" | "not_found" | "possible" | "error";
  resultCount?: number;
  snippets?: Array<{ title: string; url?: string; description?: string }>;
}

/** Fetch a URL and return the body text (best-effort, max 50KB) */
function fetchBody(urlStr: string, timeoutMs = 8000): Promise<string | null> {
  return new Promise(resolve => {
    let done = false;
    const finish = (v: string | null) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        { host: parsed.hostname, path: parsed.pathname + (parsed.search || ""),
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          method: "GET", timeout: timeoutMs - 200, rejectUnauthorized: false,
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0", "Accept": "text/html,*/*" } },
        res => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => { body += chunk; if (body.length > 50000) res.destroy(); });
          res.on("end", () => { clearTimeout(timer); finish(body); });
          res.on("close", () => { if (!done) { clearTimeout(timer); finish(body || null); } });
        }
      );
      req.on("error", () => { clearTimeout(timer); finish(null); });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); finish(null); });
      req.end();
    } catch { clearTimeout(timer); finish(null); }
  });
}

/** Search Ahmia.fi — clearnet Tor/onion search engine */
async function searchAhmia(username: string): Promise<DarkWebResult> {
  const base: DarkWebResult = { source: "Ahmia.fi (Tor Index)", type: "dark_web", status: "not_found" };
  try {
    const body = await fetchBody(`https://ahmia.fi/search/?q=${encodeURIComponent(username)}`, 9000);
    if (!body) return { ...base, status: "error" };
    // Count result items — Ahmia wraps each result in <li class="result">
    const resultMatches = body.match(/<li[^>]+class=["'][^"']*result[^"']*["']/gi) ?? [];
    const count = resultMatches.length;
    if (count === 0) return base;
    // Extract up to 3 snippets
    const snippets: DarkWebResult["snippets"] = [];
    const hrefRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{1,120})<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(body)) !== null && snippets.length < 3) {
      const url = m[1]; const title = m[2].replace(/\s+/g, " ").trim();
      if (title.length < 3 || url.includes("ahmia.fi")) continue;
      snippets.push({ title, url });
    }
    return { ...base, status: "found", resultCount: count, snippets };
  } catch {
    return { ...base, status: "error" };
  }
}

/** Search DarkSearch.io — dark web search API (no key required for basic queries) */
async function searchDarkSearch(username: string): Promise<DarkWebResult> {
  const base: DarkWebResult = { source: "DarkSearch.io", type: "dark_web", status: "not_found" };
  try {
    const body = await fetchBody(`https://darksearch.io/api/search?query=${encodeURIComponent('"' + username + '"')}&page=1`, 9000);
    if (!body) return { ...base, status: "error" };
    const data = JSON.parse(body) as { data?: Array<{ title?: string; link?: string; description?: string }>; total?: number };
    if (!data.data?.length) return base;
    const snippets = data.data.slice(0, 3).map(d => ({
      title: d.title?.replace(/\s+/g, " ").trim() || "(untitled)",
      url: d.link,
      description: d.description?.replace(/\s+/g, " ").trim().slice(0, 200),
    }));
    return { ...base, status: "found", resultCount: data.total ?? data.data.length, snippets };
  } catch {
    return { ...base, status: "error" };
  }
}

/** Check Pastebin search for username mentions */
async function searchPastebin(username: string): Promise<DarkWebResult> {
  const base: DarkWebResult = { source: "Pastebin", type: "paste", status: "not_found" };
  try {
    // Pastebin's public search
    const body = await fetchBody(`https://pastebin.com/search?q=${encodeURIComponent(username)}`, 8000);
    if (!body) return { ...base, status: "error" };
    const matches = body.match(/class=["']preview_title["'][^>]*>[^<]*<\/a>/gi) ?? [];
    if (!matches.length) {
      // Also check for "results" text
      const hasResults = /\d+\s+results?\s+for/i.test(body);
      return hasResults ? { ...base, status: "possible", resultCount: 0 } : base;
    }
    const snippets = matches.slice(0, 3).map(m => {
      const title = m.replace(/<[^>]+>/g, "").trim();
      return { title: title || "Untitled paste" };
    });
    return { ...base, status: "found", resultCount: matches.length, snippets };
  } catch {
    return { ...base, status: "error" };
  }
}

/** Check GitHub code search for username / credential leaks */
async function searchGitHubGists(username: string): Promise<DarkWebResult> {
  const base: DarkWebResult = { source: "GitHub Gists", type: "paste", status: "not_found" };
  try {
    const body = await fetchBody(`https://gist.github.com/search?q=${encodeURIComponent(username)}`, 8000);
    if (!body) return { ...base, status: "error" };
    const countMatch = body.match(/(\d[\d,]*)\s+gist result/i);
    const count = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;
    if (count === 0) return base;
    return { ...base, status: "found", resultCount: count };
  } catch {
    return { ...base, status: "error" };
  }
}

/** Check Ghostbin/Rentry style paste sites via HEAD for username as path */
async function checkPasteSite(name: string, url: string): Promise<DarkWebResult> {
  const base: DarkWebResult = { source: name, type: "paste", status: "not_found" };
  return new Promise(resolve => {
    let done = false;
    const finish = (v: DarkWebResult) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish({ ...base, status: "error" }), 6000);
    try {
      const parsed = new URL(url);
      const req = https.request(
        { host: parsed.hostname, path: parsed.pathname + (parsed.search || ""),
          method: "HEAD", timeout: 5800, rejectUnauthorized: false,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ProxhqOSINT/1.0)" } },
        res => {
          clearTimeout(timer);
          res.resume();
          const code = res.statusCode ?? 0;
          if (code === 200) finish({ ...base, status: "found" });
          else if (code === 404) finish(base);
          else finish({ ...base, status: "possible" });
        }
      );
      req.on("error", () => { clearTimeout(timer); finish({ ...base, status: "error" }); });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); finish({ ...base, status: "error" }); });
      req.end();
    } catch { clearTimeout(timer); finish({ ...base, status: "error" }); }
  });
}

/** Run all dark web / paste site scans in parallel */
async function scanDarkWeb(username: string): Promise<DarkWebResult[]> {
  const [ahmia, darkSearch, pastebin, gists, rentry, hastebin] = await Promise.all([
    searchAhmia(username),
    searchDarkSearch(username),
    searchPastebin(username),
    searchGitHubGists(username),
    checkPasteSite("Rentry.co", `https://rentry.co/${encodeURIComponent(username)}`),
    checkPasteSite("Hastebin", `https://hastebin.com/${encodeURIComponent(username)}`),
  ]);
  return [ahmia, darkSearch, pastebin, gists, rentry, hastebin];
}

// POST /api/osint/username — full exposure scan
router.post("/username", async (req: Request, res: Response) => {
  const { username } = req.body as { username: string };
  if (!username?.trim()) return res.status(400).json({ error: "username is required" });

  const uname = username.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_.%-]{1,50}$/.test(uname)) {
    return res.status(400).json({ error: "Invalid username — use letters, numbers, _ . - only" });
  }

  // Run all checks in parallel: platform scans + dark web + email gravatar checks
  const emailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com"];
  const emailCandidates = emailDomains.map(d => `${uname}@${d}`);

  const [rawResults, darkWeb, gravatarResults] = await Promise.all([
    Promise.all(PLATFORMS.map(p => checkUsername(p, uname))),
    scanDarkWeb(uname),
    Promise.all(emailCandidates.map(e => checkGravatar(e))),
  ]);

  // For "found" platforms: extract profile snippet (max 10 to stay fast)
  const snippetTargets = rawResults.filter(r => r.status === "found").slice(0, 10);
  const snippets = await Promise.all(snippetTargets.map(r => extractProfileSnippet(r.url)));
  const snippetMap: Record<string, { title?: string; description?: string }> = {};
  snippetTargets.forEach((r, i) => { snippetMap[r.url] = snippets[i]; });

  const results = rawResults.map(r => ({
    ...r,
    snippet: snippetMap[r.url] ?? null,
  }));

  const emailPatterns = emailCandidates.map((email, i) => ({
    email,
    hasGravatar: gravatarResults[i],
  }));

  const dorkQueries = buildDorkQueries(uname);

  const found    = results.filter(r => r.status === "found").length;
  const possible = results.filter(r => r.status === "possible").length;

  // Collect exposed personal data from profile page snippets
  const NOISE = ["page not found", "404", "just a moment", "access denied", "sign in", "log in"];
  const exposedData: Array<{ platform: string; field: string; value: string }> = [];
  results.forEach(r => {
    if (!r.snippet) return;
    const { title, description } = r.snippet;
    if (title && !NOISE.some(n => title.toLowerCase().includes(n))) {
      exposedData.push({ platform: r.name, field: "title", value: title });
    }
    if (description && description.length > 10 && !NOISE.some(n => description.toLowerCase().includes(n))) {
      exposedData.push({ platform: r.name, field: "description", value: description });
    }
  });

  return res.json({
    username: uname,
    found, possible, total: PLATFORMS.length,
    results,
    darkWeb,
    emailPatterns,
    dorkQueries,
    exposedData,
  });
});

// ── Discord User ID Lookup ────────────────────────────────────────────────────

const SNOWFLAKE_RE = /\b(1\d{17}|[2-9]\d{17}|\d{18,19})\b/g;

/** Try to resolve a Discord username → User ID via lookup.guru */
async function discordLookupGuru(username: string): Promise<{ userId?: string; displayName?: string; avatar?: string }> {
  const body = await fetchBody(`https://lookup.guru/${encodeURIComponent(username)}`, 9000);
  if (!body) return {};
  // Look for 17-19 digit snowflake IDs in the page
  const matches = [...body.matchAll(SNOWFLAKE_RE)].map(m => m[1]);
  if (!matches.length) return {};
  const userId = matches[0];
  // Try to extract display name from <title>
  const titleMatch = body.match(/<title[^>]*>([^<]{1,100})<\/title>/i);
  const displayName = titleMatch?.[1]?.replace(/\s*[-|].*$/, "").trim();
  // Avatar: Discord CDN pattern sometimes appears in page
  const avatarMatch = body.match(/cdn\.discordapp\.com\/avatars\/\d+\/([a-f0-9]+)/i);
  const avatar = avatarMatch ? `https://cdn.discordapp.com/avatars/${userId}/${avatarMatch[1]}.png?size=128` : undefined;
  return { userId, displayName, avatar };
}

/** Try discord.id lookup API */
async function discordIdLookup(username: string): Promise<{ userId?: string; displayName?: string; avatar?: string }> {
  const body = await fetchBody(`https://discord.id/search?q=${encodeURIComponent(username)}`, 8000);
  if (!body) return {};
  const matches = [...body.matchAll(SNOWFLAKE_RE)].map(m => m[1]);
  if (!matches.length) return {};
  return { userId: matches[0], displayName: username };
}

/** Try discordlookup.com search by username */
async function discordLookupComSearch(username: string): Promise<{ userId?: string; source: string }> {
  const body = await fetchBody(`https://discordlookup.com/search?q=${encodeURIComponent(username)}`, 9000);
  if (!body) return { source: "discordlookup.com/search" };
  const matches = [...body.matchAll(SNOWFLAKE_RE)].map(m => m[1]);
  return { userId: matches[0], source: "discordlookup.com/search" };
}

/**
 * Search paste sites and GitHub for the username and extract any Discord User IDs
 * found nearby (within the same content block). This catches leaked data where
 * someone's username + Discord ID appeared together in a paste or config file.
 */
async function searchPasteSitesForDiscordId(username: string): Promise<Array<{ source: string; userId: string; context: string }>> {
  const results: Array<{ source: string; userId: string; context: string }> = [];

  // Helper: find Snowflake IDs within 200 chars of the username in a body
  const extractNearby = (body: string, src: string) => {
    const lBody = body.toLowerCase();
    const lUser = username.toLowerCase();
    let pos = lBody.indexOf(lUser);
    while (pos !== -1) {
      const slice = body.slice(Math.max(0, pos - 200), pos + 200 + lUser.length);
      for (const m of slice.matchAll(SNOWFLAKE_RE)) {
        results.push({ source: src, userId: m[1], context: slice.replace(/\s+/g, " ").trim().slice(0, 120) });
      }
      pos = lBody.indexOf(lUser, pos + 1);
    }
  };

  // Pastebin search
  const pbBody = await fetchBody(
    `https://pastebin.com/search?q=${encodeURIComponent(username + " discord")}`, 9000
  );
  if (pbBody) extractNearby(pbBody, "Pastebin");

  // GitHub code search for username + discord (unauthenticated — 10 req/min limit)
  const ghBody = await fetchBody(
    `https://api.github.com/search/code?q=${encodeURIComponent('"' + username + '" discord')}&per_page=5`,
    9000
  );
  if (ghBody) {
    try {
      const d = JSON.parse(ghBody);
      for (const item of (d.items ?? []).slice(0, 5)) {
        const rawUrl = item.html_url?.replace("github.com", "raw.githubusercontent.com")
          ?.replace("/blob/", "/");
        if (rawUrl) {
          const raw = await fetchBody(rawUrl, 6000);
          if (raw) extractNearby(raw, `GitHub: ${item.repository?.full_name ?? "repo"}`);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Deduplicate by userId
  const seen = new Set<string>();
  return results.filter(r => seen.has(r.userId) ? false : (seen.add(r.userId), true));
}

/** Decode a Discord Snowflake ID into metadata */
function decodeSnowflake(id: string): {
  createdAt: string; timestampMs: number;
  workerId: number; processId: number; increment: number;
} {
  const n = BigInt(id);
  const DISCORD_EPOCH = 1420070400000n;
  const timestampMs = Number((n >> 22n) + DISCORD_EPOCH);
  const workerId   = Number((n & 0x3E0000n) >> 17n);
  const processId  = Number((n & 0x1F000n)  >> 12n);
  const increment  = Number(n & 0xFFFn);
  return { createdAt: new Date(timestampMs).toISOString(), timestampMs, workerId, processId, increment };
}

/** Pull public profile info for a User ID from discordlookup.com + Lanyard */
async function fetchDiscordProfileById(userId: string): Promise<{
  displayName?: string; username?: string; avatar?: string;
  source?: string;
}> {
  const body = await fetchBody(`https://discordlookup.com/user/${userId}`, 10000);
  if (!body) return {};
  const titleMatch = body.match(/<title[^>]*>([^<]{1,100})<\/title>/i);
  const displayName = titleMatch?.[1]?.replace(/\s*[-|].*$/, "").trim() ?? undefined;
  const avatarMatch = body.match(/cdn\.discordapp\.com\/avatars\/(\d+)\/([a-f0-9_]+)/i);
  const avatar = avatarMatch
    ? `https://cdn.discordapp.com/avatars/${userId}/${avatarMatch[2]}.png?size=256`
    : undefined;
  const usernameMatch = body.match(/@([a-z0-9._]{2,32})/i);
  const username = usernameMatch?.[1];
  return { displayName, username, avatar, source: "discordlookup.com" };
}

/** Check Lanyard API for public Discord presence (opt-in service) */
async function fetchLanyardPresence(userId: string): Promise<{
  username?: string; avatar?: string; status?: string; activities?: string[];
} | null> {
  const body = await fetchBody(`https://api.lanyard.rest/v1/users/${userId}`, 6000);
  if (!body) return null;
  try {
    const d = JSON.parse(body);
    if (!d.success) return null;
    const u = d.data?.discord_user;
    if (!u) return null;
    return {
      username: u.username,
      avatar: u.avatar
        ? `https://cdn.discordapp.com/avatars/${userId}/${u.avatar}.png?size=256`
        : undefined,
      status: d.data.discord_status,
      activities: ((d.data.activities ?? []) as any[]).map((a: any) => a.name).filter(Boolean),
    };
  } catch { return null; }
}

/** Search paste/breach sites for a Discord User ID (snowflake) */
async function searchDiscordId(userId: string): Promise<Array<{ source: string; found: boolean; resultCount?: number; note?: string }>> {
  const [pastebin, gists, ahmia] = await Promise.all([
    searchPastebin(userId),
    searchGitHubGists(userId),
    searchAhmia(userId),
  ]);
  return [
    { source: "Pastebin",    found: pastebin.status === "found",    resultCount: pastebin.resultCount },
    { source: "GitHub Gists", found: gists.status === "found",       resultCount: gists.resultCount },
    { source: "Ahmia (Tor)", found: ahmia.status === "found",        resultCount: ahmia.resultCount,
      note: ahmia.snippets?.[0]?.title },
  ];
}

function discordIdDorks(userId: string, username: string): string[] {
  return [
    `"${userId}" discord`,
    `"${userId}" site:pastebin.com`,
    `"${userId}" site:github.com`,
    `"${userId}" "token" OR "password" OR "leaked"`,
    `"${username}" discord.com/users/${userId}`,
    `"${userId}" filetype:json OR filetype:txt OR filetype:sql`,
    `intext:"${userId}" "discord" site:pastebin.com OR site:rentry.co`,
  ];
}

// POST /api/osint/discord-lookup
router.post("/discord-lookup", async (req: Request, res: Response) => {
  const { username, userId: providedId } = req.body as { username?: string; userId?: string };

  if (!username?.trim() && !providedId?.trim()) {
    return res.status(400).json({ error: "username or userId required" });
  }

  const uname = (username ?? "").trim().replace(/^@/, "");
  const givenId = (providedId ?? "").trim();

  // Validate provided ID is a valid Snowflake (17-20 digits)
  if (givenId && !/^\d{17,20}$/.test(givenId)) {
    return res.status(400).json({ error: "Invalid Discord User ID — must be 17–20 digits" });
  }

  const selfLookupSteps = [
    "Open Discord app (desktop or mobile)",
    "Go to Settings → Advanced",
    "Enable 'Developer Mode'",
    "Close Settings",
    "Find your username anywhere (DM list, server member list, your own profile)",
    "Right-click (desktop) or long-press (mobile) your username",
    "Click 'Copy User ID' — this is your 18-digit Snowflake ID",
    "Paste it into the User ID field above for a full breach check",
  ];

  let resolvedUserId: string | undefined = givenId || undefined;
  let resolvedSource: string | undefined = givenId ? "provided" : undefined;
  let displayName: string | undefined;
  let avatar: string | undefined;
  let pasteExposures: Array<{ source: string; userId: string; context: string }> = [];

  const lookupAttempts: Array<{ source: string; status: "found" | "not_found" | "error"; note?: string }> = [];

  if (!resolvedUserId && uname) {
    // Run all ID-resolution sources in parallel for speed
    const [guru, dlCom, did, pasteHits] = await Promise.all([
      discordLookupGuru(uname).catch(() => ({})),
      discordLookupComSearch(uname).catch(() => ({ source: "discordlookup.com/search" })),
      discordIdLookup(uname).catch(() => ({})),
      searchPasteSitesForDiscordId(uname).catch(() => [] as typeof pasteExposures),
    ]);

    pasteExposures = pasteHits;

    // lookup.guru
    if ((guru as any).userId) {
      const g = guru as { userId: string; displayName?: string; avatar?: string };
      resolvedUserId = g.userId; resolvedSource = "lookup.guru";
      displayName = g.displayName; avatar = g.avatar;
      lookupAttempts.push({ source: "lookup.guru", status: "found", note: `User ID: ${g.userId}` });
    } else {
      lookupAttempts.push({ source: "lookup.guru", status: "not_found" });
    }

    // discordlookup.com search
    if ((dlCom as any).userId) {
      const d = dlCom as { userId: string; source: string };
      lookupAttempts.push({ source: "discordlookup.com", status: "found", note: `User ID: ${d.userId}` });
      if (!resolvedUserId) { resolvedUserId = d.userId; resolvedSource = "discordlookup.com"; }
    } else {
      lookupAttempts.push({ source: "discordlookup.com", status: "not_found" });
    }

    // discord.id
    if ((did as any).userId) {
      const d = did as { userId: string; displayName?: string };
      lookupAttempts.push({ source: "discord.id", status: "found", note: `User ID: ${d.userId}` });
      if (!resolvedUserId) { resolvedUserId = d.userId; resolvedSource = "discord.id"; displayName = d.displayName; }
    } else {
      lookupAttempts.push({ source: "discord.id", status: "not_found" });
    }

    // Paste/GitHub search — IDs found alongside username in leaked data
    if (pasteExposures.length > 0) {
      lookupAttempts.push({
        source: "Paste/Breach data",
        status: "found",
        note: `${pasteExposures.length} User ID(s) found near username in public paste/source data`,
      });
      // Use first paste-sourced ID if we still have nothing
      if (!resolvedUserId) {
        resolvedUserId = pasteExposures[0].userId;
        resolvedSource = pasteExposures[0].source;
      }
    } else {
      lookupAttempts.push({ source: "Paste/Breach data", status: "not_found" });
    }
  }

  let idBreachHits: Array<{ source: string; found: boolean; resultCount?: number; note?: string }> | undefined;
  let idDorkQueries: string[] | undefined;
  let snowflake: ReturnType<typeof decodeSnowflake> | undefined;
  let profile: { displayName?: string; username?: string; avatar?: string; source?: string } | undefined;
  let lanyardPresence: { username?: string; avatar?: string; status?: string; activities?: string[] } | null = null;

  if (resolvedUserId) {
    // Decode Snowflake immediately (no I/O)
    try { snowflake = decodeSnowflake(resolvedUserId); } catch { /* invalid id */ }

    // Run all I/O in parallel
    [idBreachHits, profile, lanyardPresence] = await Promise.all([
      searchDiscordId(resolvedUserId),
      fetchDiscordProfileById(resolvedUserId),
      fetchLanyardPresence(resolvedUserId),
    ]);
    idDorkQueries = discordIdDorks(resolvedUserId, uname || resolvedUserId);

    // Merge profile data: prefer discordlookup.com, fill gaps from resolution step
    if (!profile?.displayName && displayName) profile = { ...profile, displayName };
    if (!profile?.avatar && avatar) profile = { ...profile, avatar };
    // Also fill from Lanyard if richer
    if (lanyardPresence?.avatar && !profile?.avatar) profile = { ...profile, avatar: lanyardPresence.avatar };
    if (lanyardPresence?.username && !profile?.username) profile = { ...profile, username: lanyardPresence.username };
  }

  // Account age from snowflake
  const accountAgeMs = snowflake ? (Date.now() - snowflake.timestampMs) : null;
  const accountAgeDays = accountAgeMs !== null ? Math.floor(accountAgeMs / 86400000) : null;

  // Default avatar (Discord's CDN always serves these — no auth required)
  const defaultAvatarIndex = snowflake
    ? Number(BigInt(resolvedUserId!) % 6n)
    : 0;
  const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;

  // Profile public link
  const profileUrl = resolvedUserId ? `https://discord.com/users/${resolvedUserId}` : null;

  return res.json({
    username: uname || null,
    resolvedUserId: resolvedUserId ?? null,
    resolvedSource: resolvedSource ?? null,
    displayName: profile?.displayName ?? displayName ?? null,
    avatar: profile?.avatar ?? avatar ?? null,
    lookupAttempts,
    selfLookupSteps,
    pasteExposures: pasteExposures.length > 0 ? pasteExposures : null,
    idBreachHits: idBreachHits ?? null,
    idDorkQueries: idDorkQueries ?? null,
    snowflake: snowflake ?? null,
    accountAgeDays,
    defaultAvatarUrl,
    profileUrl,
    lanyardPresence: lanyardPresence ?? null,
    profile: profile
      ? { ...profile, createdAt: snowflake?.createdAt, accountAgeDays }
      : snowflake
        ? { createdAt: snowflake.createdAt, accountAgeDays }
        : null,
  });
});

// ── Email Intelligence scanner ─────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","temp-mail.org","throwam.com","yopmail.com",
  "sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info","guerrillamail.biz",
  "guerrillamail.de","guerrillamail.net","guerrillamail.org","spam4.me","trashmail.com",
  "trashmail.me","trashmail.net","trashmail.org","trashmail.at","trashmail.io",
  "dispostable.com","mailnull.com","spamgourmet.com","maildrop.cc","discard.email",
  "fakeinbox.com","mailnesia.com","spamfree24.org","getnada.com","tempinbox.com",
  "mailsac.com","throwaway.email","spambox.us","getairmail.com","filzmail.com",
  "tempr.email","discard.email","throwam.com","tempmail.net","mailtemp.info",
  "10minutemail.com","10minutemail.net","10minutemail.org","tempail.com","tempmail2.com",
  "spamhereplease.com","trashmail.fr","mailexpire.com","wegwerfemail.de",
]);

router.post("/email", async (req: Request, res: Response) => {
  const body = z.object({ email: z.string().min(3).max(254) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });

  const rawEmail = body.data.email.toLowerCase().trim();
  const emailMatch = rawEmail.match(/^([^@]+)@(.+)$/);
  if (!emailMatch) return res.status(400).json({ error: "Invalid email format" });

  const local = emailMatch[1];
  const domain = emailMatch[2];
  const isValidFormat = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(rawEmail);
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);

  // Parallel DNS lookups
  const [mxRecords, txtRecords, aRecords] = await Promise.allSettled([
    dns.resolveMx(domain).catch(() => [] as dns.MxRecord[]),
    dns.resolveTxt(domain).catch(() => [] as string[][]),
    dns.resolve4(domain).catch(() => [] as string[]),
  ]);

  const mx: dns.MxRecord[] = mxRecords.status === "fulfilled" ? (mxRecords.value as dns.MxRecord[]) : [];
  const txt: string[][] = txtRecords.status === "fulfilled" ? (txtRecords.value as string[][]) : [];
  const ips: string[] = aRecords.status === "fulfilled" ? (aRecords.value as string[]) : [];

  const flatTxt = txt.map(r => r.join(""));
  const spfRecord = flatTxt.find(r => r.startsWith("v=spf1")) ?? null;
  const dmarcTxtRecords = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => [] as string[][]);
  const dmarcRecord = dmarcTxtRecords.map(r => r.join("")).find(r => r.startsWith("v=DMARC1")) ?? null;
  const dkimRecord = await dns.resolveTxt(`default._domainkey.${domain}`).catch(() => null);

  // MX health
  const hasMx = mx.length > 0;
  const primaryMx = mx.sort((a, b) => a.priority - b.priority)[0]?.exchange ?? null;

  // Gravatar check
  const emailHash = crypto.createHash("md5").update(rawEmail).digest("hex");
  const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=404`;
  const gravatarHead = await fetchHead(gravatarUrl, 4000);
  const hasGravatar = gravatarHead?.status === 200;
  const gravatarProfileUrl = hasGravatar ? `https://gravatar.com/${emailHash}` : null;

  // HIBP breach check (if API key configured)
  let breaches: Array<{ name: string; domain: string; breachDate: string; dataClasses: string[]; pwnCount: number }> = [];
  let hibpError: string | null = null;
  const hibpKey = process.env.HIBP_API_KEY;
  if (hibpKey) {
    try {
      const hibpRes = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(rawEmail)}?truncateResponse=false`, {
        headers: { "hibp-api-key": hibpKey, "User-Agent": "ProxhqVPN-OSINT/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (hibpRes.status === 200) {
        const data = await hibpRes.json() as any[];
        breaches = data.map(b => ({
          name: b.Name,
          domain: b.Domain,
          breachDate: b.BreachDate,
          dataClasses: b.DataClasses?.slice(0, 6) ?? [],
          pwnCount: b.PwnCount,
        }));
      } else if (hibpRes.status === 404) {
        breaches = [];
      } else {
        hibpError = `HIBP returned ${hibpRes.status}`;
      }
    } catch (e: any) {
      hibpError = e.message;
    }
  } else {
    hibpError = "HIBP_API_KEY not configured — add it to enable live breach lookups";
  }

  // Paste exposure search (public indexers)
  const pasteSearches = await Promise.allSettled([
    fetchHead(`https://psbdmp.ws/api/search/${encodeURIComponent(rawEmail)}`, 4000),
    fetchHead(`https://www.google.com/search?q="${encodeURIComponent(rawEmail)}"`, 3000),
  ]);

  // Email reputation signals
  const reputationSignals: Array<{ signal: string; risk: "critical" | "high" | "medium" | "low" | "ok"; detail: string }> = [];
  if (!isValidFormat) reputationSignals.push({ signal: "Format", risk: "critical", detail: "Malformed email address" });
  if (isDisposable) reputationSignals.push({ signal: "Disposable", risk: "high", detail: `${domain} is a known disposable/throwaway email service` });
  if (!hasMx) reputationSignals.push({ signal: "MX Records", risk: "high", detail: "No MX records found — domain cannot receive email" });
  if (!spfRecord) reputationSignals.push({ signal: "SPF", risk: "medium", detail: "No SPF record — spoofing protection missing" });
  else reputationSignals.push({ signal: "SPF", risk: "ok", detail: spfRecord.slice(0, 80) });
  if (!dmarcRecord) reputationSignals.push({ signal: "DMARC", risk: "medium", detail: "No DMARC policy — phishing protection missing" });
  else {
    const dmarcPolicy = dmarcRecord.match(/p=(none|quarantine|reject)/i)?.[1] ?? "none";
    reputationSignals.push({ signal: "DMARC", risk: dmarcPolicy === "reject" ? "ok" : dmarcPolicy === "quarantine" ? "medium" : "high", detail: `Policy: ${dmarcPolicy}` });
  }
  if (dkimRecord) reputationSignals.push({ signal: "DKIM", risk: "ok", detail: "DKIM selector 'default' found" });
  else reputationSignals.push({ signal: "DKIM", risk: "low", detail: "No 'default' DKIM selector (may use another)" });
  if (hasGravatar) reputationSignals.push({ signal: "Gravatar", risk: "medium", detail: "Public Gravatar profile found — confirms real account" });
  if (breaches.length > 0) reputationSignals.push({ signal: "Breaches", risk: breaches.length >= 5 ? "critical" : "high", detail: `Found in ${breaches.length} data breach(es)` });

  // Risk score
  const riskWeights: Record<string, number> = { critical: 30, high: 15, medium: 8, low: 3, ok: 0 };
  const riskScore = Math.min(100, reputationSignals.reduce((acc, s) => acc + (riskWeights[s.risk] ?? 0), 0));

  // Dork queries for manual research
  const dorkQueries = [
    `"${rawEmail}" site:pastebin.com`,
    `"${rawEmail}" site:github.com`,
    `"${rawEmail}" site:linkedin.com`,
    `"${rawEmail}" filetype:sql OR filetype:csv`,
    `"${rawEmail}" intext:password`,
    `"${rawEmail}" site:reddit.com`,
    `intitle:"${local}" "${domain}"`,
  ];

  return res.json({
    email: rawEmail,
    local,
    domain,
    isValidFormat,
    isDisposable,
    mx: mx.slice(0, 5).map(m => ({ exchange: m.exchange, priority: m.priority })),
    hasMx,
    primaryMx,
    domainIps: ips.slice(0, 4),
    emailSecurity: {
      spf: spfRecord,
      dmarc: dmarcRecord,
      dkim: dkimRecord ? "Found (default selector)" : null,
    },
    gravatar: { found: hasGravatar, hash: emailHash, profileUrl: gravatarProfileUrl },
    breaches,
    hibpStatus: hibpKey ? (hibpError ? "error" : "ok") : "no_key",
    hibpError,
    reputationSignals,
    riskScore,
    dorkQueries,
    scannedAt: new Date().toISOString(),
  });
});

// ── Email Header Forensics ─────────────────────────────────────────────────
router.post("/email-headers", async (req: Request, res: Response) => {
  const body = z.object({ headers: z.string().min(20).max(50000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });

  const raw = body.data.headers;
  const lines = raw.split(/\r?\n/);

  // Fold multi-line headers
  const folded: string[] = [];
  for (const line of lines) {
    if (/^\s+/.test(line) && folded.length > 0) {
      folded[folded.length - 1] += " " + line.trim();
    } else {
      folded.push(line);
    }
  }

  function extractHeader(name: string): string | null {
    const re = new RegExp(`^${name}:\\s*(.+)$`, "i");
    for (const line of folded) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractAllHeaders(name: string): string[] {
    const re = new RegExp(`^${name}:\\s*(.+)$`, "i");
    return folded.flatMap(line => { const m = line.match(re); return m ? [m[1].trim()] : []; });
  }

  // Extract Received hops
  const receivedHops = extractAllHeaders("Received").map((hop, i) => {
    const fromMatch = hop.match(/from\s+([^\s;]+)/i);
    const byMatch = hop.match(/by\s+([^\s;(]+)/i);
    const ipMatch = hop.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);
    const dateMatch = hop.match(/;\s*(.+)$/);
    return {
      hop: i + 1,
      from: fromMatch?.[1] ?? null,
      by: byMatch?.[1] ?? null,
      ip: ipMatch?.[1] ?? null,
      timestamp: dateMatch?.[1]?.trim() ?? null,
    };
  });

  // Authentication results
  const authResults = extractHeader("Authentication-Results") ?? extractHeader("ARC-Authentication-Results") ?? null;
  const spfResult = authResults?.match(/spf=(pass|fail|softfail|neutral|none|permerror|temperror)/i)?.[1] ?? null;
  const dkimResult = authResults?.match(/dkim=(pass|fail|neutral|none|permerror|temperror)/i)?.[1] ?? null;
  const dmarcResult = authResults?.match(/dmarc=(pass|fail|bestguesspass|none)/i)?.[1] ?? null;

  const from = extractHeader("From");
  const replyTo = extractHeader("Reply-To");
  const returnPath = extractHeader("Return-Path");
  const to = extractHeader("To");
  const subject = extractHeader("Subject");
  const date = extractHeader("Date");
  const messageId = extractHeader("Message-ID");
  const xMailer = extractHeader("X-Mailer") ?? extractHeader("User-Agent");
  const xOrigIp = extractHeader("X-Originating-IP") ?? extractHeader("X-Forwarded-For") ?? extractHeader("X-Source-IP");
  const xSpamScore = extractHeader("X-Spam-Score") ?? extractHeader("X-Spam-Status");
  const contentType = extractHeader("Content-Type");
  const mimeVersion = extractHeader("MIME-Version");

  // Spoofing signals
  const suspiciousSignals: string[] = [];
  if (from && replyTo && from !== replyTo) suspiciousSignals.push(`Reply-To mismatch: From="${from}" vs Reply-To="${replyTo}"`);
  if (from && returnPath && !returnPath.includes(from.replace(/.*@/, ""))) {
    const fromDomain = from.match(/@([^>]+)/)?.[1];
    const rpDomain = returnPath.match(/@([^>]+)/)?.[1];
    if (fromDomain && rpDomain && fromDomain !== rpDomain) suspiciousSignals.push(`Return-Path domain mismatch: ${fromDomain} vs ${rpDomain}`);
  }
  if (spfResult && spfResult !== "pass") suspiciousSignals.push(`SPF ${spfResult.toUpperCase()}`);
  if (dkimResult && dkimResult !== "pass") suspiciousSignals.push(`DKIM ${dkimResult.toUpperCase()}`);
  if (dmarcResult && dmarcResult !== "pass") suspiciousSignals.push(`DMARC ${dmarcResult.toUpperCase()}`);
  if (!messageId) suspiciousSignals.push("No Message-ID header (unusual for legitimate MUAs)");

  // Timeline from Received hops
  const timestamps = receivedHops.map(h => h.timestamp ? new Date(h.timestamp).getTime() : null).filter(Boolean) as number[];
  const totalDelayMs = timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : null;

  return res.json({
    summary: { from, to, subject, date, messageId, xMailer, xOrigIp, xSpamScore, contentType, mimeVersion, replyTo, returnPath },
    authentication: { spf: spfResult, dkim: dkimResult, dmarc: dmarcResult, raw: authResults },
    receivedChain: receivedHops,
    totalDelayMs,
    totalDelaySeconds: totalDelayMs !== null ? Math.round(totalDelayMs / 1000) : null,
    suspiciousSignals,
    hopCount: receivedHops.length,
    originatingIp: xOrigIp ?? receivedHops[receivedHops.length - 1]?.ip ?? null,
    parsedAt: new Date().toISOString(),
  });
});

// ── Bigo Live ID lookup ───────────────────────────────────────────────────────
async function bigoLookupById(bigoId: string): Promise<{
  found: boolean; profileUrl: string; displayName?: string; username?: string; avatarHint?: string;
}> {
  const profileUrl = `https://www.bigo.tv/${encodeURIComponent(bigoId)}`;
  const body = await fetchBody(profileUrl, 9000);
  if (!body) return { found: false, profileUrl };

  // 4xx / error page patterns Bigo uses
  if (/user\s*not\s*found|page\s*not\s*found|404/i.test(body) && !/og:title/i.test(body)) {
    return { found: false, profileUrl };
  }

  const titleMatch = body.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const ogTitleMatch = body.match(/og:title[^>]+content=["']([^"']{1,200})["']/i)
    ?? body.match(/content=["']([^"']{1,200})["'][^>]+og:title/i);

  const rawTitle = ogTitleMatch?.[1] ?? titleMatch?.[1] ?? "";
  const displayName = rawTitle
    .replace(/\s*[-|–].*$/, "")
    .replace(/\s*bigo\s*live\s*/gi, "")
    .replace(/\s*@\S+/, "")
    .trim() || undefined;

  // Bigo Live og:image often includes the avatar CDN URL
  const imgMatch = body.match(/og:image[^>]+content=["']([^"']+)["']/i)
    ?? body.match(/content=["']([^"']+)["'][^>]+og:image/i);
  const avatarHint = imgMatch?.[1] ?? undefined;

  // og:description sometimes contains the username handle
  const descMatch = body.match(/og:description[^>]+content=["']([^"']{1,300})["']/i);
  const desc = descMatch?.[1] ?? "";
  const handleMatch = desc.match(/@([a-zA-Z0-9_.]{2,30})/);
  const username = handleMatch?.[1] ?? undefined;

  return { found: !!displayName || !!avatarHint, profileUrl, displayName, username, avatarHint };
}

// ── Cross-Intelligence Pivot Search ──────────────────────────────────────────
// POST /api/osint/pivot — accepts email, username, Discord ID, or Bigo ID. Auto-detects type.

router.post("/pivot", async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };
  if (!query?.trim()) return res.status(400).json({ error: "query required" });

  const q = query.trim();
  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q);
  const isDiscordSnowflake = /^\d{17,20}$/.test(q);
  const isNumericId = /^\d{5,20}$/.test(q);

  // ── Discord User ID (Snowflake) ───────────────────────────────────────────
  if (isDiscordSnowflake) {
    let snowflake: ReturnType<typeof decodeSnowflake> | undefined;
    try { snowflake = decodeSnowflake(q); } catch { /* invalid snowflake */ }

    const accountAgeMs = snowflake ? (Date.now() - snowflake.timestampMs) : null;
    const accountAgeDays = accountAgeMs !== null ? Math.floor(accountAgeMs / 86400000) : null;
    const defaultAvatarIndex = snowflake ? Number(BigInt(q) % 6n) : 0;
    const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;

    const [idBreachHits, profile, lanyardPresence] = await Promise.all([
      searchDiscordId(q),
      fetchDiscordProfileById(q),
      fetchLanyardPresence(q),
    ]);

    const mergedProfile = { ...profile };
    if (lanyardPresence?.avatar && !mergedProfile.avatar) mergedProfile.avatar = lanyardPresence.avatar;
    if (lanyardPresence?.username && !mergedProfile.username) mergedProfile.username = lanyardPresence.username;

    const dorkQueries = discordIdDorks(q, mergedProfile.username ?? q);

    return res.json({
      inputType: "discord_id",
      query: q,
      discord: {
        resolvedUserId: q,
        displayName: mergedProfile.displayName ?? null,
        username: mergedProfile.username ?? null,
        avatar: mergedProfile.avatar ?? defaultAvatarUrl,
        defaultAvatarUrl,
        profileUrl: `https://discord.com/users/${q}`,
        accountAgeDays,
        accountCreated: snowflake?.createdAt ?? null,
        source: mergedProfile.source ?? "discordlookup.com",
      },
      lanyardPresence: lanyardPresence ?? null,
      snowflake: snowflake ?? null,
      idBreachHits,
      nameHints: mergedProfile.displayName ? [{ platform: "Discord", hint: mergedProfile.displayName }] : [],
      platforms: null,
      emailPatterns: null,
      darkWeb: null,
      dorkQueries,
    });
  }

  // ── Numeric Bigo Live ID (or other platform numeric ID) ───────────────────
  if (isNumericId) {
    const [bigoProfile, darkWeb] = await Promise.all([
      bigoLookupById(q),
      scanDarkWeb(q),
    ]);

    const nameHints: Array<{ platform: string; hint: string }> = [];
    if (bigoProfile.displayName) nameHints.push({ platform: "Bigo Live", hint: bigoProfile.displayName });
    if (bigoProfile.username) nameHints.push({ platform: "Bigo Live", hint: `@${bigoProfile.username}` });

    // If Bigo found a username, also search platforms for it
    let platforms: any[] = [];
    let found = 0, possible = 0;
    if (bigoProfile.username) {
      const uname = bigoProfile.username;
      const rawResults = await Promise.all(PLATFORMS.map(p => checkUsername(p, uname)));
      const snippetTargets = rawResults.filter(r => r.status === "found").slice(0, 6);
      const snippets = await Promise.all(snippetTargets.map(r => extractProfileSnippet(r.url)));
      const snippetMap: Record<string, any> = {};
      snippetTargets.forEach((r, i) => { snippetMap[r.url] = snippets[i]; });
      platforms = rawResults.map(r => ({ ...r, snippet: snippetMap[r.url] ?? null }));
      found = platforms.filter(r => r.status === "found").length;
      possible = platforms.filter(r => r.status === "possible").length;
    }

    return res.json({
      inputType: "bigo_id",
      query: q,
      bigoLive: {
        bigoId: q,
        profileUrl: bigoProfile.profileUrl,
        found: bigoProfile.found,
        displayName: bigoProfile.displayName ?? null,
        username: bigoProfile.username ?? null,
        avatarHint: bigoProfile.avatarHint ?? null,
      },
      darkWeb,
      nameHints,
      platforms: platforms.length ? platforms : null,
      found,
      possible,
      total: platforms.length,
      emailPatterns: null,
      discord: null,
      dorkQueries: [
        `"${q}" bigo live`,
        `"${q}" site:bigo.tv`,
        `"bigo id" "${q}"`,
        `"${q}" live stream`,
        `"${q}" site:pastebin.com`,
        ...(bigoProfile.displayName ? [`"${bigoProfile.displayName}" bigo`, `"${bigoProfile.displayName}" social media`] : []),
        ...(bigoProfile.username ? buildDorkQueries(bigoProfile.username) : []),
      ],
    });
  }

  if (isEmail) {
    // ── Email input ──────────────────────────────────────────────────────────
    const rawEmail = q.toLowerCase();
    const emailParts = rawEmail.match(/^([^@]+)@(.+)$/);
    if (!emailParts) return res.status(400).json({ error: "Invalid email" });

    const local = emailParts[1];
    const emailDomain = emailParts[2];

    // Clean local part → username candidate (strip +tag, collapse dots for gmail-style)
    const usernameCandidate = local.replace(/\+.*$/, "").replace(/\./g, "").toLowerCase();
    const altCandidate = local.replace(/\+.*$/, "").toLowerCase(); // with dots preserved

    if (!/^[a-zA-Z0-9_.%-]{1,50}$/.test(usernameCandidate) && !/^[a-zA-Z0-9_.%-]{1,50}$/.test(altCandidate)) {
      return res.status(400).json({ error: "Cannot derive valid username from email local part" });
    }
    const uname = /^[a-zA-Z0-9_.%-]{1,50}$/.test(altCandidate) ? altCandidate : usernameCandidate;

    // Parallel: platform scan for derived username + email intel + Discord lookup
    const emailHash = crypto.createHash("md5").update(rawEmail).digest("hex");
    const derivedEmailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com"];
    const derivedEmails = derivedEmailDomains.map(d => `${uname}@${d}`);

    const [rawPlatformResults, darkWeb, gravatarResults, thisGravatar, discordRes,
      mxRecords, txtRecords, dmarcRecords] = await Promise.all([
      Promise.all(PLATFORMS.map(p => checkUsername(p, uname))),
      scanDarkWeb(uname),
      Promise.all(derivedEmails.map(e => checkGravatar(e))),
      fetchHead(`https://www.gravatar.com/avatar/${emailHash}?d=404`, 4000),
      discordLookupGuru(uname).catch(() => ({} as { userId?: string; displayName?: string })),
      dns.resolveMx(emailDomain).catch(() => [] as any[]),
      dns.resolveTxt(emailDomain).catch(() => [] as string[][]),
      dns.resolveTxt(`_dmarc.${emailDomain}`).catch(() => [] as string[][]),
    ]);

    const mx: any[] = Array.isArray(mxRecords) ? mxRecords : [];
    const txt: string[][] = Array.isArray(txtRecords) ? txtRecords : [];
    const flatTxt = txt.map((r: string[]) => r.join(""));
    const spfRecord = flatTxt.find(r => r.startsWith("v=spf1")) ?? null;
    const dmarcRecord = (dmarcRecords as string[][]).map((r: string[]) => r.join("")).find(r => r.startsWith("v=DMARC1")) ?? null;

    const hasGravatar = thisGravatar?.status === 200;
    const discordId = (discordRes as any).userId as string | undefined;
    const discordDisplay = (discordRes as any).displayName as string | undefined;

    // Snippets for found platforms
    const snippetTargets = rawPlatformResults.filter(r => r.status === "found").slice(0, 8);
    const snippets = await Promise.all(snippetTargets.map(r => extractProfileSnippet(r.url)));
    const snippetMap: Record<string, { title?: string; description?: string }> = {};
    snippetTargets.forEach((r, i) => { snippetMap[r.url] = snippets[i]; });

    const platforms = rawPlatformResults.map(r => ({ ...r, snippet: snippetMap[r.url] ?? null }));
    const found = platforms.filter(r => r.status === "found").length;
    const possible = platforms.filter(r => r.status === "possible").length;

    // Extract name hints from profile snippets
    const NOISE = ["page not found", "404", "just a moment", "access denied", "sign in", "log in"];
    const nameHints: Array<{ platform: string; hint: string }> = [];
    platforms.forEach(r => {
      if (!r.snippet) return;
      const { title, description } = r.snippet;
      if (title && !NOISE.some(n => title.toLowerCase().includes(n)) && !title.toLowerCase().includes(uname.toLowerCase())) {
        nameHints.push({ platform: r.name, hint: title });
      }
      if (description && description.length > 10 && !NOISE.some(n => description.toLowerCase().includes(n))) {
        nameHints.push({ platform: r.name, hint: description.slice(0, 120) });
      }
    });

    return res.json({
      inputType: "email",
      query: rawEmail,
      derivedUsername: uname,
      platforms,
      found, possible, total: PLATFORMS.length,
      darkWeb,
      emailPatterns: derivedEmails.map((email, i) => ({ email, hasGravatar: gravatarResults[i] })),
      discord: discordId ? {
        resolvedUserId: discordId,
        displayName: discordDisplay ?? null,
        profileUrl: `https://discord.com/users/${discordId}`,
        accountCreated: (() => {
          try { const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n); return new Date(ts).toISOString(); } catch { return null; }
        })(),
      } : null,
      emailIntel: {
        email: rawEmail,
        local,
        domain: emailDomain,
        hasGravatar,
        gravatarUrl: hasGravatar ? `https://gravatar.com/${emailHash}` : null,
        hasMx: mx.length > 0,
        primaryMx: mx.sort((a, b) => a.priority - b.priority)[0]?.exchange ?? null,
        spf: spfRecord,
        dmarc: dmarcRecord,
      },
      nameHints: nameHints.slice(0, 10),
      dorkQueries: [
        ...buildDorkQueries(uname),
        `"${rawEmail}" site:pastebin.com`,
        `"${rawEmail}" site:github.com`,
        `"${rawEmail}" filetype:sql OR filetype:csv`,
        `"${local}" site:linkedin.com`,
        `"${rawEmail}" intext:password`,
      ],
    });
  } else {
    // ── Username input ────────────────────────────────────────────────────────
    const uname = q.replace(/^@/, "");
    if (!/^[a-zA-Z0-9_.%-]{1,50}$/.test(uname)) {
      return res.status(400).json({ error: "Invalid username — use letters, numbers, _ . - only" });
    }

    const emailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com"];
    const emailCandidates = emailDomains.map(d => `${uname}@${d}`);

    const [rawResults, darkWeb, gravatarResults] = await Promise.all([
      Promise.all(PLATFORMS.map(p => checkUsername(p, uname))),
      scanDarkWeb(uname),
      Promise.all(emailCandidates.map(e => checkGravatar(e))),
    ]);

    const snippetTargets = rawResults.filter(r => r.status === "found").slice(0, 10);
    const snippets = await Promise.all(snippetTargets.map(r => extractProfileSnippet(r.url)));
    const snippetMap: Record<string, { title?: string; description?: string }> = {};
    snippetTargets.forEach((r, i) => { snippetMap[r.url] = snippets[i]; });
    const platforms = rawResults.map(r => ({ ...r, snippet: snippetMap[r.url] ?? null }));

    const emailPatterns = emailCandidates.map((email, i) => ({ email, hasGravatar: gravatarResults[i] }));

    const discordResult = platforms.find(r => r.name === "Discord");
    const discordId = discordResult?.status === "found"
      ? discordResult.manualNote?.match(/User ID: (\d+)/)?.[1] ?? null
      : null;
    const discordDisplay = discordResult?.status === "found"
      ? discordResult.manualNote?.match(/· (.+)$/)?.[1] ?? null
      : null;

    const NOISE = ["page not found", "404", "just a moment", "access denied", "sign in", "log in"];
    const nameHints: Array<{ platform: string; hint: string }> = [];
    platforms.forEach(r => {
      if (!r.snippet) return;
      const { title, description } = r.snippet;
      if (title && !NOISE.some(n => title.toLowerCase().includes(n)) && !title.toLowerCase().includes(uname.toLowerCase())) {
        nameHints.push({ platform: r.name, hint: title });
      }
      if (description && description.length > 10 && !NOISE.some(n => description.toLowerCase().includes(n))) {
        nameHints.push({ platform: r.name, hint: description.slice(0, 120) });
      }
    });

    const found = platforms.filter(r => r.status === "found").length;
    const possible = platforms.filter(r => r.status === "possible").length;

    return res.json({
      inputType: "username",
      query: uname,
      derivedUsername: uname,
      platforms,
      found, possible, total: PLATFORMS.length,
      darkWeb,
      emailPatterns,
      discord: discordId ? {
        resolvedUserId: discordId,
        displayName: discordDisplay,
        profileUrl: `https://discord.com/users/${discordId}`,
        accountCreated: (() => {
          try { const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n); return new Date(ts).toISOString(); } catch { return null; }
        })(),
      } : null,
      emailIntel: null,
      nameHints: nameHints.slice(0, 10),
      dorkQueries: buildDorkQueries(uname),
    });
  }
});


// ─── Phone Number OSINT Lookup ────────────────────────────────────────────────
import { parsePhoneNumber, getNumberType, PhoneNumberType } from "libphonenumber-js";

// US area code → {state, region, carriers} reference table (top 120 area codes)
const US_AREA_CODES: Record<string, { state: string; region: string; carriers: string[] }> = {
  "201":{"state":"NJ","region":"Jersey City / Hackensack","carriers":["Verizon","T-Mobile","AT&T"]},
  "202":{"state":"DC","region":"Washington D.C.","carriers":["Verizon","AT&T","T-Mobile"]},
  "203":{"state":"CT","region":"Bridgeport / New Haven","carriers":["AT&T","T-Mobile","Verizon"]},
  "205":{"state":"AL","region":"Birmingham","carriers":["AT&T","Verizon","T-Mobile"]},
  "206":{"state":"WA","region":"Seattle","carriers":["T-Mobile","AT&T","Verizon"]},
  "212":{"state":"NY","region":"Manhattan","carriers":["Verizon","AT&T","T-Mobile"]},
  "213":{"state":"CA","region":"Los Angeles","carriers":["AT&T","T-Mobile","Verizon"]},
  "214":{"state":"TX","region":"Dallas","carriers":["AT&T","T-Mobile","Verizon"]},
  "215":{"state":"PA","region":"Philadelphia","carriers":["Verizon","AT&T","T-Mobile"]},
  "216":{"state":"OH","region":"Cleveland","carriers":["AT&T","Verizon","T-Mobile"]},
  "217":{"state":"IL","region":"Springfield","carriers":["AT&T","T-Mobile","Verizon"]},
  "224":{"state":"IL","region":"North Suburban Chicago","carriers":["AT&T","T-Mobile","Comcast"]},
  "228":{"state":"MS","region":"Biloxi / Gulfport","carriers":["AT&T","Verizon","T-Mobile"]},
  "229":{"state":"GA","region":"Albany","carriers":["AT&T","Verizon","T-Mobile"]},
  "234":{"state":"OH","region":"Akron / Canton","carriers":["AT&T","Verizon","T-Mobile"]},
  "240":{"state":"MD","region":"Suburban DC / Montgomery County","carriers":["Verizon","AT&T","T-Mobile"]},
  "248":{"state":"MI","region":"Oakland County / Pontiac","carriers":["AT&T","T-Mobile","Verizon"]},
  "251":{"state":"AL","region":"Mobile","carriers":["AT&T","Verizon","T-Mobile"]},
  "253":{"state":"WA","region":"Tacoma","carriers":["T-Mobile","AT&T","Verizon"]},
  "267":{"state":"PA","region":"Philadelphia (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "281":{"state":"TX","region":"Houston suburbs","carriers":["AT&T","T-Mobile","Verizon"]},
  "301":{"state":"MD","region":"Suburban DC / Prince George's","carriers":["Verizon","AT&T","T-Mobile"]},
  "302":{"state":"DE","region":"Entire state","carriers":["Verizon","AT&T","T-Mobile"]},
  "303":{"state":"CO","region":"Denver","carriers":["AT&T","T-Mobile","Verizon"]},
  "305":{"state":"FL","region":"Miami / Key West","carriers":["AT&T","T-Mobile","Verizon"]},
  "309":{"state":"IL","region":"Peoria","carriers":["AT&T","T-Mobile","Verizon"]},
  "310":{"state":"CA","region":"West Los Angeles / Beverly Hills","carriers":["AT&T","T-Mobile","Verizon"]},
  "312":{"state":"IL","region":"Chicago (downtown)","carriers":["AT&T","T-Mobile","Verizon"]},
  "313":{"state":"MI","region":"Detroit","carriers":["AT&T","T-Mobile","Verizon"]},
  "314":{"state":"MO","region":"St. Louis","carriers":["AT&T","T-Mobile","Verizon"]},
  "315":{"state":"NY","region":"Syracuse","carriers":["Verizon","AT&T","T-Mobile"]},
  "317":{"state":"IN","region":"Indianapolis","carriers":["AT&T","Verizon","T-Mobile"]},
  "318":{"state":"LA","region":"Shreveport","carriers":["AT&T","Verizon","T-Mobile"]},
  "319":{"state":"IA","region":"Cedar Rapids","carriers":["T-Mobile","Verizon","AT&T"]},
  "320":{"state":"MN","region":"St. Cloud","carriers":["T-Mobile","Verizon","AT&T"]},
  "323":{"state":"CA","region":"Los Angeles (East)","carriers":["AT&T","T-Mobile","Verizon"]},
  "325":{"state":"TX","region":"Abilene","carriers":["AT&T","Verizon","T-Mobile"]},
  "330":{"state":"OH","region":"Youngstown / Canton","carriers":["AT&T","Verizon","T-Mobile"]},
  "334":{"state":"AL","region":"Montgomery","carriers":["AT&T","Verizon","T-Mobile"]},
  "336":{"state":"NC","region":"Greensboro / Winston-Salem","carriers":["AT&T","Verizon","T-Mobile"]},
  "337":{"state":"LA","region":"Lafayette","carriers":["AT&T","Verizon","T-Mobile"]},
  "347":{"state":"NY","region":"NYC Boroughs (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "351":{"state":"MA","region":"North Shore / Lowell","carriers":["Verizon","AT&T","T-Mobile"]},
  "352":{"state":"FL","region":"Gainesville / Ocala","carriers":["AT&T","Verizon","T-Mobile"]},
  "360":{"state":"WA","region":"Western WA (Bellingham/Olympia)","carriers":["T-Mobile","AT&T","Verizon"]},
  "385":{"state":"UT","region":"Salt Lake City (overlay)","carriers":["T-Mobile","Verizon","AT&T"]},
  "386":{"state":"FL","region":"Daytona Beach","carriers":["AT&T","Verizon","T-Mobile"]},
  "401":{"state":"RI","region":"Entire state","carriers":["Verizon","AT&T","T-Mobile"]},
  "402":{"state":"NE","region":"Omaha","carriers":["T-Mobile","Verizon","AT&T"]},
  "404":{"state":"GA","region":"Atlanta","carriers":["AT&T","T-Mobile","Verizon"]},
  "405":{"state":"OK","region":"Oklahoma City","carriers":["AT&T","T-Mobile","Verizon"]},
  "406":{"state":"MT","region":"Entire state","carriers":["T-Mobile","Verizon","AT&T"]},
  "407":{"state":"FL","region":"Orlando","carriers":["AT&T","Verizon","T-Mobile"]},
  "408":{"state":"CA","region":"San Jose / Silicon Valley","carriers":["AT&T","T-Mobile","Verizon"]},
  "409":{"state":"TX","region":"Beaumont / Galveston","carriers":["AT&T","Verizon","T-Mobile"]},
  "410":{"state":"MD","region":"Baltimore","carriers":["Verizon","AT&T","T-Mobile"]},
  "412":{"state":"PA","region":"Pittsburgh","carriers":["Verizon","AT&T","T-Mobile"]},
  "415":{"state":"CA","region":"San Francisco","carriers":["AT&T","T-Mobile","Verizon"]},
  "419":{"state":"OH","region":"Toledo","carriers":["AT&T","Verizon","T-Mobile"]},
  "423":{"state":"TN","region":"Chattanooga / Knoxville","carriers":["AT&T","Verizon","T-Mobile"]},
  "424":{"state":"CA","region":"Southwest LA (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "425":{"state":"WA","region":"Bellevue / Redmond / Kirkland","carriers":["T-Mobile","AT&T","Verizon"]},
  "432":{"state":"TX","region":"Odessa / Midland","carriers":["AT&T","Verizon","T-Mobile"]},
  "434":{"state":"VA","region":"Charlottesville","carriers":["Verizon","AT&T","T-Mobile"]},
  "435":{"state":"UT","region":"Rural Utah","carriers":["T-Mobile","Verizon","AT&T"]},
  "440":{"state":"OH","region":"Cleveland suburbs","carriers":["AT&T","Verizon","T-Mobile"]},
  "443":{"state":"MD","region":"Baltimore (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "458":{"state":"OR","region":"Eugene (overlay)","carriers":["T-Mobile","AT&T","Verizon"]},
  "469":{"state":"TX","region":"Dallas (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "470":{"state":"GA","region":"Atlanta (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "475":{"state":"CT","region":"Bridgeport (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "478":{"state":"GA","region":"Macon","carriers":["AT&T","Verizon","T-Mobile"]},
  "480":{"state":"AZ","region":"Scottsdale / Tempe / Mesa","carriers":["T-Mobile","AT&T","Verizon"]},
  "484":{"state":"PA","region":"Allentown (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "501":{"state":"AR","region":"Little Rock","carriers":["AT&T","Verizon","T-Mobile"]},
  "502":{"state":"KY","region":"Louisville","carriers":["AT&T","T-Mobile","Verizon"]},
  "503":{"state":"OR","region":"Portland","carriers":["T-Mobile","AT&T","Verizon"]},
  "504":{"state":"LA","region":"New Orleans","carriers":["AT&T","Verizon","T-Mobile"]},
  "505":{"state":"NM","region":"Albuquerque","carriers":["T-Mobile","AT&T","Verizon"]},
  "507":{"state":"MN","region":"Rochester","carriers":["T-Mobile","Verizon","AT&T"]},
  "508":{"state":"MA","region":"Worcester / Cape Cod","carriers":["Verizon","AT&T","T-Mobile"]},
  "509":{"state":"WA","region":"Spokane / Eastern WA","carriers":["T-Mobile","AT&T","Verizon"]},
  "510":{"state":"CA","region":"Oakland / East Bay","carriers":["AT&T","T-Mobile","Verizon"]},
  "512":{"state":"TX","region":"Austin","carriers":["AT&T","T-Mobile","Verizon"]},
  "513":{"state":"OH","region":"Cincinnati","carriers":["AT&T","Verizon","T-Mobile"]},
  "515":{"state":"IA","region":"Des Moines","carriers":["T-Mobile","Verizon","AT&T"]},
  "516":{"state":"NY","region":"Nassau County / Long Island","carriers":["Verizon","AT&T","T-Mobile"]},
  "517":{"state":"MI","region":"Lansing","carriers":["AT&T","T-Mobile","Verizon"]},
  "518":{"state":"NY","region":"Albany","carriers":["Verizon","AT&T","T-Mobile"]},
  "520":{"state":"AZ","region":"Tucson","carriers":["T-Mobile","AT&T","Verizon"]},
  "530":{"state":"CA","region":"Sacramento suburbs / Chico","carriers":["AT&T","T-Mobile","Verizon"]},
  "539":{"state":"OK","region":"Tulsa (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "540":{"state":"VA","region":"Roanoke / Fredericksburg","carriers":["Verizon","AT&T","T-Mobile"]},
  "541":{"state":"OR","region":"Eugene / Medford","carriers":["T-Mobile","AT&T","Verizon"]},
  "559":{"state":"CA","region":"Fresno","carriers":["AT&T","T-Mobile","Verizon"]},
  "561":{"state":"FL","region":"West Palm Beach / Boca Raton","carriers":["AT&T","Verizon","T-Mobile"]},
  "562":{"state":"CA","region":"Long Beach","carriers":["AT&T","T-Mobile","Verizon"]},
  "563":{"state":"IA","region":"Davenport / Quad Cities","carriers":["T-Mobile","Verizon","AT&T"]},
  "570":{"state":"PA","region":"Scranton / Wilkes-Barre","carriers":["Verizon","AT&T","T-Mobile"]},
  "571":{"state":"VA","region":"Northern VA (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "573":{"state":"MO","region":"Columbia / Jefferson City","carriers":["AT&T","T-Mobile","Verizon"]},
  "575":{"state":"NM","region":"Southern NM","carriers":["T-Mobile","AT&T","Verizon"]},
  "580":{"state":"OK","region":"Southwest Oklahoma","carriers":["AT&T","Verizon","T-Mobile"]},
  "585":{"state":"NY","region":"Rochester","carriers":["Verizon","AT&T","T-Mobile"]},
  "586":{"state":"MI","region":"Macomb County","carriers":["AT&T","T-Mobile","Verizon"]},
  "601":{"state":"MS","region":"Jackson","carriers":["AT&T","Verizon","T-Mobile"]},
  "602":{"state":"AZ","region":"Phoenix","carriers":["T-Mobile","AT&T","Verizon"]},
  "603":{"state":"NH","region":"Entire state","carriers":["Verizon","AT&T","T-Mobile"]},
  "605":{"state":"SD","region":"Entire state","carriers":["T-Mobile","Verizon","AT&T"]},
  "606":{"state":"KY","region":"Eastern Kentucky","carriers":["AT&T","Verizon","T-Mobile"]},
  "607":{"state":"NY","region":"Binghamton / Ithaca","carriers":["Verizon","AT&T","T-Mobile"]},
  "608":{"state":"WI","region":"Madison","carriers":["AT&T","T-Mobile","Verizon"]},
  "609":{"state":"NJ","region":"Trenton / Atlantic City","carriers":["Verizon","AT&T","T-Mobile"]},
  "610":{"state":"PA","region":"Allentown / Bethlehem","carriers":["Verizon","AT&T","T-Mobile"]},
  "612":{"state":"MN","region":"Minneapolis","carriers":["T-Mobile","Verizon","AT&T"]},
  "614":{"state":"OH","region":"Columbus","carriers":["AT&T","Verizon","T-Mobile"]},
  "615":{"state":"TN","region":"Nashville","carriers":["AT&T","T-Mobile","Verizon"]},
  "616":{"state":"MI","region":"Grand Rapids","carriers":["AT&T","T-Mobile","Verizon"]},
  "617":{"state":"MA","region":"Boston","carriers":["Verizon","AT&T","T-Mobile"]},
  "619":{"state":"CA","region":"San Diego","carriers":["AT&T","T-Mobile","Verizon"]},
  "620":{"state":"KS","region":"Wichita area","carriers":["T-Mobile","AT&T","Verizon"]},
  "623":{"state":"AZ","region":"Phoenix West / Glendale","carriers":["T-Mobile","AT&T","Verizon"]},
  "626":{"state":"CA","region":"Pasadena / San Gabriel Valley","carriers":["AT&T","T-Mobile","Verizon"]},
  "630":{"state":"IL","region":"DuPage County / Naperville","carriers":["AT&T","T-Mobile","Verizon"]},
  "631":{"state":"NY","region":"Suffolk County / Long Island","carriers":["Verizon","AT&T","T-Mobile"]},
  "636":{"state":"MO","region":"St. Louis suburbs","carriers":["AT&T","T-Mobile","Verizon"]},
  "646":{"state":"NY","region":"Manhattan (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "650":{"state":"CA","region":"San Mateo / Palo Alto","carriers":["AT&T","T-Mobile","Verizon"]},
  "651":{"state":"MN","region":"St. Paul","carriers":["T-Mobile","Verizon","AT&T"]},
  "657":{"state":"CA","region":"Orange County (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "660":{"state":"MO","region":"Sedalia","carriers":["AT&T","T-Mobile","Verizon"]},
  "661":{"state":"CA","region":"Bakersfield","carriers":["AT&T","T-Mobile","Verizon"]},
  "662":{"state":"MS","region":"Oxford / Tupelo","carriers":["AT&T","Verizon","T-Mobile"]},
  "667":{"state":"MD","region":"Baltimore (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "678":{"state":"GA","region":"Atlanta (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "682":{"state":"TX","region":"Fort Worth (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "701":{"state":"ND","region":"Entire state","carriers":["T-Mobile","Verizon","AT&T"]},
  "702":{"state":"NV","region":"Las Vegas","carriers":["T-Mobile","AT&T","Verizon"]},
  "703":{"state":"VA","region":"Northern Virginia","carriers":["Verizon","AT&T","T-Mobile"]},
  "704":{"state":"NC","region":"Charlotte","carriers":["AT&T","Verizon","T-Mobile"]},
  "706":{"state":"GA","region":"Augusta / Columbus","carriers":["AT&T","Verizon","T-Mobile"]},
  "707":{"state":"CA","region":"Santa Rosa / Napa","carriers":["AT&T","T-Mobile","Verizon"]},
  "708":{"state":"IL","region":"South Suburban Chicago","carriers":["AT&T","T-Mobile","Verizon"]},
  "712":{"state":"IA","region":"Sioux City","carriers":["T-Mobile","Verizon","AT&T"]},
  "713":{"state":"TX","region":"Houston","carriers":["AT&T","T-Mobile","Verizon"]},
  "714":{"state":"CA","region":"Anaheim / Orange County","carriers":["AT&T","T-Mobile","Verizon"]},
  "715":{"state":"WI","region":"Wausau / Eau Claire","carriers":["AT&T","T-Mobile","Verizon"]},
  "716":{"state":"NY","region":"Buffalo","carriers":["Verizon","AT&T","T-Mobile"]},
  "717":{"state":"PA","region":"Harrisburg / Lancaster","carriers":["Verizon","AT&T","T-Mobile"]},
  "718":{"state":"NY","region":"NYC Outer Boroughs","carriers":["Verizon","AT&T","T-Mobile"]},
  "719":{"state":"CO","region":"Colorado Springs / Pueblo","carriers":["AT&T","T-Mobile","Verizon"]},
  "720":{"state":"CO","region":"Denver (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "724":{"state":"PA","region":"Western PA","carriers":["Verizon","AT&T","T-Mobile"]},
  "725":{"state":"NV","region":"Las Vegas (overlay)","carriers":["T-Mobile","AT&T","Verizon"]},
  "727":{"state":"FL","region":"Clearwater / St. Petersburg","carriers":["AT&T","Verizon","T-Mobile"]},
  "731":{"state":"TN","region":"Jackson","carriers":["AT&T","Verizon","T-Mobile"]},
  "732":{"state":"NJ","region":"Central Jersey","carriers":["Verizon","AT&T","T-Mobile"]},
  "734":{"state":"MI","region":"Ann Arbor","carriers":["AT&T","T-Mobile","Verizon"]},
  "737":{"state":"TX","region":"Austin (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "740":{"state":"OH","region":"Southeast Ohio / Zanesville","carriers":["AT&T","Verizon","T-Mobile"]},
  "747":{"state":"CA","region":"San Fernando Valley (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "754":{"state":"FL","region":"Broward County (overlay)","carriers":["AT&T","Verizon","T-Mobile"]},
  "757":{"state":"VA","region":"Virginia Beach / Norfolk","carriers":["Verizon","AT&T","T-Mobile"]},
  "760":{"state":"CA","region":"Palm Springs / Inland Empire","carriers":["AT&T","T-Mobile","Verizon"]},
  "762":{"state":"GA","region":"Columbus (overlay)","carriers":["AT&T","Verizon","T-Mobile"]},
  "763":{"state":"MN","region":"Northwest Minneapolis suburbs","carriers":["T-Mobile","Verizon","AT&T"]},
  "765":{"state":"IN","region":"Lafayette","carriers":["AT&T","Verizon","T-Mobile"]},
  "770":{"state":"GA","region":"Atlanta suburbs","carriers":["AT&T","T-Mobile","Verizon"]},
  "772":{"state":"FL","region":"Fort Pierce / Stuart","carriers":["AT&T","Verizon","T-Mobile"]},
  "773":{"state":"IL","region":"Chicago (non-downtown)","carriers":["AT&T","T-Mobile","Verizon"]},
  "775":{"state":"NV","region":"Reno / Northern NV","carriers":["T-Mobile","AT&T","Verizon"]},
  "781":{"state":"MA","region":"Boston suburbs","carriers":["Verizon","AT&T","T-Mobile"]},
  "785":{"state":"KS","region":"Topeka","carriers":["T-Mobile","AT&T","Verizon"]},
  "786":{"state":"FL","region":"Miami (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "801":{"state":"UT","region":"Salt Lake City","carriers":["T-Mobile","Verizon","AT&T"]},
  "802":{"state":"VT","region":"Entire state","carriers":["Verizon","AT&T","T-Mobile"]},
  "803":{"state":"SC","region":"Columbia","carriers":["AT&T","Verizon","T-Mobile"]},
  "804":{"state":"VA","region":"Richmond","carriers":["Verizon","AT&T","T-Mobile"]},
  "805":{"state":"CA","region":"Santa Barbara / Ventura","carriers":["AT&T","T-Mobile","Verizon"]},
  "806":{"state":"TX","region":"Amarillo / Lubbock","carriers":["AT&T","Verizon","T-Mobile"]},
  "808":{"state":"HI","region":"Entire state","carriers":["T-Mobile","AT&T","Verizon"]},
  "810":{"state":"MI","region":"Flint","carriers":["AT&T","T-Mobile","Verizon"]},
  "812":{"state":"IN","region":"Evansville","carriers":["AT&T","Verizon","T-Mobile"]},
  "813":{"state":"FL","region":"Tampa","carriers":["AT&T","Verizon","T-Mobile"]},
  "814":{"state":"PA","region":"Erie","carriers":["Verizon","AT&T","T-Mobile"]},
  "815":{"state":"IL","region":"Rockford","carriers":["AT&T","T-Mobile","Verizon"]},
  "816":{"state":"MO","region":"Kansas City","carriers":["AT&T","T-Mobile","Verizon"]},
  "817":{"state":"TX","region":"Fort Worth","carriers":["AT&T","T-Mobile","Verizon"]},
  "818":{"state":"CA","region":"San Fernando Valley","carriers":["AT&T","T-Mobile","Verizon"]},
  "828":{"state":"NC","region":"Asheville","carriers":["AT&T","Verizon","T-Mobile"]},
  "830":{"state":"TX","region":"Del Rio / Kerrville","carriers":["AT&T","Verizon","T-Mobile"]},
  "831":{"state":"CA","region":"Monterey / Santa Cruz","carriers":["AT&T","T-Mobile","Verizon"]},
  "832":{"state":"TX","region":"Houston (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "843":{"state":"SC","region":"Charleston / Myrtle Beach","carriers":["AT&T","Verizon","T-Mobile"]},
  "845":{"state":"NY","region":"Hudson Valley / Poughkeepsie","carriers":["Verizon","AT&T","T-Mobile"]},
  "847":{"state":"IL","region":"North Suburban Chicago","carriers":["AT&T","T-Mobile","Verizon"]},
  "850":{"state":"FL","region":"Tallahassee / Pensacola","carriers":["AT&T","Verizon","T-Mobile"]},
  "856":{"state":"NJ","region":"South Jersey / Camden","carriers":["Verizon","AT&T","T-Mobile"]},
  "857":{"state":"MA","region":"Boston (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "858":{"state":"CA","region":"North San Diego","carriers":["AT&T","T-Mobile","Verizon"]},
  "859":{"state":"KY","region":"Lexington","carriers":["AT&T","T-Mobile","Verizon"]},
  "860":{"state":"CT","region":"Hartford","carriers":["AT&T","T-Mobile","Verizon"]},
  "862":{"state":"NJ","region":"Newark (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "863":{"state":"FL","region":"Lakeland","carriers":["AT&T","Verizon","T-Mobile"]},
  "864":{"state":"SC","region":"Greenville / Spartanburg","carriers":["AT&T","Verizon","T-Mobile"]},
  "865":{"state":"TN","region":"Knoxville","carriers":["AT&T","Verizon","T-Mobile"]},
  "870":{"state":"AR","region":"Northeast Arkansas","carriers":["AT&T","Verizon","T-Mobile"]},
  "872":{"state":"IL","region":"Chicago (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "901":{"state":"TN","region":"Memphis","carriers":["AT&T","T-Mobile","Verizon"]},
  "903":{"state":"TX","region":"East Texas / Tyler","carriers":["AT&T","Verizon","T-Mobile"]},
  "904":{"state":"FL","region":"Jacksonville","carriers":["AT&T","Verizon","T-Mobile"]},
  "906":{"state":"MI","region":"Upper Peninsula","carriers":["AT&T","T-Mobile","Verizon"]},
  "907":{"state":"AK","region":"Entire state","carriers":["GCI","AT&T","T-Mobile"]},
  "908":{"state":"NJ","region":"Central NJ","carriers":["Verizon","AT&T","T-Mobile"]},
  "909":{"state":"CA","region":"Inland Empire / San Bernardino","carriers":["AT&T","T-Mobile","Verizon"]},
  "910":{"state":"NC","region":"Fayetteville / Wilmington","carriers":["AT&T","Verizon","T-Mobile"]},
  "912":{"state":"GA","region":"Savannah","carriers":["AT&T","Verizon","T-Mobile"]},
  "913":{"state":"KS","region":"Kansas City (KS side)","carriers":["T-Mobile","AT&T","Verizon"]},
  "914":{"state":"NY","region":"Westchester County","carriers":["Verizon","AT&T","T-Mobile"]},
  "915":{"state":"TX","region":"El Paso","carriers":["AT&T","T-Mobile","Verizon"]},
  "916":{"state":"CA","region":"Sacramento","carriers":["AT&T","T-Mobile","Verizon"]},
  "917":{"state":"NY","region":"NYC (mobile overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "918":{"state":"OK","region":"Tulsa","carriers":["AT&T","T-Mobile","Verizon"]},
  "919":{"state":"NC","region":"Raleigh / Durham","carriers":["AT&T","Verizon","T-Mobile"]},
  "920":{"state":"WI","region":"Green Bay / Appleton","carriers":["AT&T","T-Mobile","Verizon"]},
  "925":{"state":"CA","region":"Contra Costa County / Concord","carriers":["AT&T","T-Mobile","Verizon"]},
  "928":{"state":"AZ","region":"Flagstaff / Yuma","carriers":["T-Mobile","AT&T","Verizon"]},
  "929":{"state":"NY","region":"NYC Boroughs (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "930":{"state":"IN","region":"Bloomington","carriers":["AT&T","Verizon","T-Mobile"]},
  "931":{"state":"TN","region":"Clarksville","carriers":["AT&T","Verizon","T-Mobile"]},
  "934":{"state":"NY","region":"Long Island (overlay)","carriers":["Verizon","AT&T","T-Mobile"]},
  "936":{"state":"TX","region":"Nacogdoches / Lufkin","carriers":["AT&T","Verizon","T-Mobile"]},
  "937":{"state":"OH","region":"Dayton","carriers":["AT&T","Verizon","T-Mobile"]},
  "940":{"state":"TX","region":"Wichita Falls","carriers":["AT&T","Verizon","T-Mobile"]},
  "941":{"state":"FL","region":"Sarasota","carriers":["AT&T","Verizon","T-Mobile"]},
  "945":{"state":"TX","region":"Dallas (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "947":{"state":"MI","region":"Oakland County (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "949":{"state":"CA","region":"Irvine / Newport Beach","carriers":["AT&T","T-Mobile","Verizon"]},
  "951":{"state":"CA","region":"Riverside / Murrieta","carriers":["AT&T","T-Mobile","Verizon"]},
  "952":{"state":"MN","region":"Southwest Minneapolis suburbs","carriers":["T-Mobile","Verizon","AT&T"]},
  "954":{"state":"FL","region":"Fort Lauderdale / Broward","carriers":["AT&T","Verizon","T-Mobile"]},
  "956":{"state":"TX","region":"Laredo / McAllen","carriers":["AT&T","T-Mobile","Verizon"]},
  "959":{"state":"CT","region":"Hartford (overlay)","carriers":["AT&T","T-Mobile","Verizon"]},
  "970":{"state":"CO","region":"Grand Junction / Fort Collins","carriers":["AT&T","T-Mobile","Verizon"]},
  "971":{"state":"OR","region":"Portland (overlay)","carriers":["T-Mobile","AT&T","Verizon"]},
  "972":{"state":"TX","region":"Dallas suburbs","carriers":["AT&T","T-Mobile","Verizon"]},
  "973":{"state":"NJ","region":"Newark / Passaic","carriers":["Verizon","AT&T","T-Mobile"]},
  "978":{"state":"MA","region":"North Shore / Lawrence","carriers":["Verizon","AT&T","T-Mobile"]},
  "979":{"state":"TX","region":"Bryan / College Station","carriers":["AT&T","Verizon","T-Mobile"]},
  "980":{"state":"NC","region":"Charlotte (overlay)","carriers":["AT&T","Verizon","T-Mobile"]},
  "984":{"state":"NC","region":"Research Triangle (overlay)","carriers":["AT&T","Verizon","T-Mobile"]},
  "985":{"state":"LA","region":"Houma / Thibodaux","carriers":["AT&T","Verizon","T-Mobile"]},
  "989":{"state":"MI","region":"Saginaw / Bay City","carriers":["AT&T","T-Mobile","Verizon"]},
};

function buildPhoneDorks(number: string, e164: string): string[] {
  const clean = number.replace(/\D/g, "");
  const dashes = clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  const dots   = clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1.$2.$3");
  const parens = clean.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  return [
    `"${clean}" OR "${dashes}" OR "${dots}"`,
    `"${parens}" site:whitepages.com OR site:spokeo.com OR site:beenverified.com`,
    `"${clean}" site:facebook.com OR site:linkedin.com OR site:twitter.com`,
    `"${clean}" OR "${dashes}" inurl:profile OR inurl:user OR inurl:contact`,
    `"${e164}" OR "${clean}" site:truecaller.com OR site:callerID.com`,
    `"${clean}" filetype:pdf OR filetype:xlsx OR filetype:csv`,
    `"${dashes}" -site:whitepages.com -site:yellowpages.com`,
  ];
}

const LINE_TYPE_LABEL: Partial<Record<PhoneNumberType, string>> = {
  MOBILE:       "Mobile",
  FIXED_LINE:   "Landline",
  FIXED_LINE_OR_MOBILE: "Landline or Mobile",
  TOLL_FREE:    "Toll-Free",
  PREMIUM_RATE: "Premium Rate",
  VOIP:         "VoIP",
  PAGER:        "Pager",
  UAN:          "Universal Access Number",
  UNKNOWN:      "Unknown",
};

router.post("/phone-lookup", async (req: Request, res: Response) => {
  const schema = z.object({ phone: z.string().min(7).max(30) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid phone number input" });

  const raw = parsed.data.phone.trim();

  // Normalise common formats before parsing:
  // 1. "44 7926 549374"  → "+44 7926 549374"  (country code without +)
  // 2. "07926 549374"    → kept as-is, tried under GB
  // 3. "00 44 ..."       → "+44 ..."
  const normalise = (s: string): string => {
    if (s.startsWith("00")) return "+" + s.slice(2).trim();          // 00-prefixed IDD
    if (/^\d{1,3}[\s\-]/.test(s) && !s.startsWith("0")) return "+" + s; // bare CC like "44 7926..."
    return s;
  };
  const normRaw = normalise(raw);

  // Country hint for local-format numbers (no CC at all, starts with 0)
  const isLocalFormat = /^0\d/.test(normRaw.replace(/\s/g, ""));
  // Try parsing with multiple country contexts
  const tryCountries = isLocalFormat
    ? (["GB", "AU", "NZ", "IE", "ZA", "US", undefined] as const)
    : (["US", undefined, "GB", "AU", "IN", "DE", "FR", "JP", "BR", "MX"] as const);

  let phoneObj = null;
  let parseError = "";
  for (const country of tryCountries) {
    try {
      const candidate = country
        ? parsePhoneNumber(normRaw, country as any)
        : parsePhoneNumber(normRaw);
      if (candidate.isValid()) { phoneObj = candidate; break; }
    } catch (e: any) { parseError = e.message; }
  }

  if (!phoneObj) {
    return res.json({
      valid: false,
      input: raw,
      error: `Could not parse as a valid phone number. ${parseError}`,
      suggestions: [
        "US:  +1 (555) 867-5309  or  5558675309",
        "UK:  +44 7926 549374  or  44 7926 549374  or  07926 549374",
        "International: include country code, e.g. +33 6 12 34 56 78",
      ],
    });
  }

  const e164     = phoneObj.format("E.164");           // +14155551234
  const national = phoneObj.formatNational();          // (415) 555-1234
  const intl     = phoneObj.formatInternational();     // +1 415 555 1234
  const country  = phoneObj.country ?? "Unknown";
  const lineType = getNumberType(phoneObj);
  const lineLabel = LINE_TYPE_LABEL[lineType] ?? "Unknown";
  const areaCode  = e164.startsWith("+1") ? e164.slice(2, 5) : null;
  const areaInfo  = areaCode ? (US_AREA_CODES[areaCode] ?? null) : null;

  // Country code → human-readable name map
  const COUNTRY_NAMES: Record<string, string> = {
    US: "United States", GB: "United Kingdom", AU: "Australia", CA: "Canada",
    NZ: "New Zealand", IE: "Ireland", ZA: "South Africa", IN: "India",
    DE: "Germany", FR: "France", JP: "Japan", BR: "Brazil", MX: "Mexico",
    IT: "Italy", ES: "Spain", NL: "Netherlands", SE: "Sweden", NO: "Norway",
    DK: "Denmark", FI: "Finland", PL: "Poland", PT: "Portugal", BE: "Belgium",
    CH: "Switzerland", AT: "Austria", SG: "Singapore", HK: "Hong Kong",
    KR: "South Korea", CN: "China", RU: "Russia", UA: "Ukraine",
    NG: "Nigeria", GH: "Ghana", KE: "Kenya", PK: "Pakistan", BD: "Bangladesh",
  };
  const countryName = COUNTRY_NAMES[country] ?? country;

  const isGB = country === "GB";
  const digitsNational = national.replace(/\D/g, "");
  const e164Digits = e164.slice(1); // without leading +

  // Public reverse lookup links — universal + country-specific
  const reverseLookupLinks: { name: string; url: string; region?: string }[] = [
    { name: "TrueCaller",   url: `https://www.truecaller.com/search/${country}/${e164Digits}` },
    { name: "NumLookup",    url: `https://www.numlookup.com/?number=${encodeURIComponent(e164)}` },
    // UK-specific
    ...(isGB ? [
      { name: "BT Phone Book",    url: `https://www.thephonebook.bt.com/person/phoneNumber/${digitsNational}/`, region: "UK" },
      { name: "192.com",          url: `https://www.192.com/search/people/phone/?q=${digitsNational}`, region: "UK" },
      { name: "Who Called Me UK", url: `https://www.whocalledme.co.uk/Phone-Number/${national.replace(/\s/g, "-")}`, region: "UK" },
      { name: "Say Who Is",       url: `https://www.saywho.co.uk/phone-number/${digitsNational}`, region: "UK" },
      { name: "HiWho UK",         url: `https://hiwho.com/reverse-phone-lookup/gb/${digitsNational}`, region: "UK" },
      { name: "ReversePhoneLookup.co.uk", url: `https://www.reversephonenumbers.co.uk/phone-number/${digitsNational}`, region: "UK" },
    ] : [
      { name: "WhitePages",   url: `https://www.whitepages.com/phone/${e164.replace("+1", "")}` },
      { name: "Spokeo",       url: `https://www.spokeo.com/phone/${e164.replace("+1", "")}` },
      { name: "BeenVerified", url: `https://www.beenverified.com/phone/${digitsNational}` },
      { name: "CocoFinder",   url: `https://cocofinder.com/phone/${e164.replace("+1", "").replace(/\D/g, "")}` },
      { name: "Intelius",     url: `https://www.intelius.com/reverse-phone-lookup/${digitsNational}` },
      { name: "AnyWho",       url: `https://www.anywho.com/reverse-lookup/phone/${digitsNational}` },
    ]),
  ];

  // Social media searches
  const socialSearchLinks = [
    { name: "Google",     url: `https://www.google.com/search?q=${encodeURIComponent('"' + intl + '" OR "' + national + '"')}` },
    { name: "Facebook",   url: `https://www.facebook.com/search/top?q=${encodeURIComponent(intl)}` },
    { name: "LinkedIn",   url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(intl)}` },
    { name: "Twitter/X",  url: `https://x.com/search?q=${encodeURIComponent('"' + national + '"')}&src=typed_query` },
  ];

  // Dork queries
  const dorkQueries = buildPhoneDorks(national, e164);

  // Try fetching public info from Veriphone (free, no key)
  let veriphoneData: any = null;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6000);
    const vr = await fetch(
      `https://api.veriphone.io/v1/verify?phone=${encodeURIComponent(e164)}&key=test`,
      { signal: ctrl.signal }
    );
    if (vr.ok) {
      const vd = await vr.json();
      if (vd.phone_valid) veriphoneData = vd;
    }
  } catch { /* API unavailable — graceful degradation */ }

  // Try fetching from AbstractAPI free NANP lookup
  let carrierData: any = null;
  if (!veriphoneData && areaCode) {
    // Fall back to our built-in area code data
    carrierData = areaInfo ? {
      carrier: areaInfo.carriers[0],
      possibleCarriers: areaInfo.carriers,
      source: "NANP area code database",
    } : null;
  }

  return res.json({
    valid: true,
    input: raw,
    formatted: { e164, national, international: intl },
    country,
    countryName,
    lineType: lineLabel,
    areaCode,
    areaInfo: areaInfo ? {
      state: areaInfo.state,
      region: areaInfo.region,
      topCarriers: areaInfo.carriers,
    } : null,
    carrier: veriphoneData?.carrier ?? carrierData?.carrier ?? null,
    carrierSource: veriphoneData ? "Veriphone API" : carrierData ? "NANP area code database" : "Unavailable",
    veriphoneEnriched: veriphoneData ? {
      carrier:    veriphoneData.carrier,
      lineType:   veriphoneData.phone_type,
      local:      veriphoneData.local_format,
      countryCode: veriphoneData.country_code,
      countryName: veriphoneData.country_name,
    } : null,
    osint: {
      reverseLookupLinks,
      socialSearchLinks,
      dorkQueries,
      note: "Links open third-party public records sites. Results depend on whether the number is registered in their databases.",
    },
    warnings: [
      country === "US" && lineType === "MOBILE" ? "Mobile numbers can be ported between carriers — carrier data reflects original assignment, not necessarily current." : null,
      "Phone number lookup is for authorized investigations only. Ensure compliance with TCPA, FCRA, CCPA, and applicable state laws before using results.",
    ].filter(Boolean),
  });
});

export default router;


