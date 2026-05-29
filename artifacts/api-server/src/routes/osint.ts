// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import dns from "dns/promises";
import https from "https";
import http from "http";
import tls from "tls";
import { URL } from "url";
import crypto from "crypto";

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
  checkMode?: "json" | "hn_json";
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
  // Discord: no public profile URL by username — requires numeric User ID
  {
    name: "Discord", category: "Social", url: "",
    manualCheck: true,
    manualNote: "Discord changed to username handles but profiles are only accessible by numeric User ID (not username). Check manually at discordlookup.com — search by server to find member IDs.",
  },
  // Video / Streaming
  { name: "YouTube",        category: "Video",     url: "https://www.youtube.com/@{u}" },
  { name: "Twitch",         category: "Video",     url: "https://www.twitch.tv/{u}" },
  { name: "Vimeo",          category: "Video",     url: "https://vimeo.com/{u}" },
  { name: "Dailymotion",    category: "Video",     url: "https://www.dailymotion.com/{u}" },
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
  // Manual-check platforms (e.g. Discord) — can't be checked via HTTP
  if (platform.manualCheck) {
    return Promise.resolve({
      name: platform.name, category: platform.category, url: "",
      status: "manual", statusCode: null, manualNote: platform.manualNote,
    });
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

export default router;
