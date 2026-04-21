/**
 * Subdomain Scanner — subfinder / amass equivalent
 * Enumerate subdomains via certificate transparency logs (crt.sh) + DNS resolution.
 */
import { Router } from "express";
import { z } from "zod";
import https from "https";
import dns from "dns/promises";

const router = Router();

const ScanSchema = z.object({
  domain:       z.string().min(3).max(253).regex(/^[a-zA-Z0-9.-]+$/),
  resolveDns:   z.boolean().default(true),
  checkHttp:    z.boolean().default(true),
  timeoutMs:    z.number().int().min(2000).max(60000).default(20000),
  bruteForce:   z.boolean().default(false),
});

const COMMON_PREFIXES = [
  "www","mail","smtp","pop","pop3","imap","ftp","ssh","vpn","remote","cdn",
  "api","api2","v1","v2","dev","staging","stage","test","qa","uat","beta",
  "prod","production","admin","dashboard","portal","panel","app","web","mobile",
  "m","static","assets","media","img","images","upload","uploads","download",
  "downloads","blog","shop","store","checkout","payment","billing","invoice",
  "auth","login","signup","register","oauth","sso","id","identity","account",
  "accounts","user","users","profile","support","help","docs","documentation",
  "status","health","monitor","metrics","analytics","tracking","log","logs",
  "db","database","mysql","postgres","redis","mongo","es","elasticsearch",
  "git","gitlab","github","jenkins","ci","cd","deploy","k8s","kubernetes",
  "docker","registry","artifacts","repo","repository","npm","pypi",
  "ns1","ns2","mx1","mx2","smtp1","smtp2","mail1","mail2",
  "gateway","proxy","lb","loadbalancer","edge","node","cluster",
  "backup","archive","old","legacy","internal","intranet","corp","office",
];

function httpsGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
  });
}

type SubdomainResult = {
  subdomain: string;
  ips: string[];
  cnames: string[];
  hasHttp: boolean;
  hasHttps: boolean;
  source: "crt.sh" | "brute" | "both";
};

async function resolveDomain(sub: string): Promise<{ ips: string[]; cnames: string[] }> {
  try {
    const [a, cname] = await Promise.allSettled([
      dns.resolve4(sub),
      dns.resolveCname(sub),
    ]);
    return {
      ips: a.status === "fulfilled" ? a.value : [],
      cnames: cname.status === "fulfilled" ? cname.value : [],
    };
  } catch {
    return { ips: [], cnames: [] };
  }
}

async function checkHttp(sub: string, timeoutMs: number): Promise<{ hasHttp: boolean; hasHttps: boolean }> {
  const check = (url: string) =>
    new Promise<boolean>((resolve) => {
      const mod = url.startsWith("https") ? https : require("http");
      const req = mod.get(url, { timeout: Math.min(timeoutMs, 5000) }, () => { resolve(true); req.destroy(); });
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.on("error", () => resolve(false));
    });
  const [h, hs] = await Promise.all([
    check(`http://${sub}`),
    check(`https://${sub}`),
  ]);
  return { hasHttp: h, hasHttps: hs };
}

router.post("/", async (req, res) => {
  try {
    const params = ScanSchema.parse(req.body);
    const domain = params.domain.toLowerCase().replace(/^\.+|\.+$/g, "");

    const found = new Map<string, SubdomainResult>();

    // ── 1. Certificate Transparency via crt.sh ─────────────────────────────────
    try {
      const json = await httpsGet(
        `https://crt.sh/?q=%25.${domain}&output=json`,
        params.timeoutMs
      );
      const records: any[] = JSON.parse(json);
      for (const r of records) {
        const names: string[] = (r.name_value ?? "").split("\n").map((s: string) => s.trim().toLowerCase());
        for (const name of names) {
          if (!name.endsWith(`.${domain}`) && name !== domain) continue;
          const sub = name.replace(/^\*\./, "");
          if (!found.has(sub)) {
            found.set(sub, { subdomain: sub, ips: [], cnames: [], hasHttp: false, hasHttps: false, source: "crt.sh" });
          }
        }
      }
    } catch {
      // crt.sh may be rate-limited
    }

    // ── 2. Brute-force common prefixes ─────────────────────────────────────────
    if (params.bruteForce) {
      for (const prefix of COMMON_PREFIXES) {
        const sub = `${prefix}.${domain}`;
        if (!found.has(sub)) {
          const r = await resolveDomain(sub);
          if (r.ips.length > 0 || r.cnames.length > 0) {
            found.set(sub, { subdomain: sub, ips: r.ips, cnames: r.cnames, hasHttp: false, hasHttps: false, source: "brute" });
          }
        } else {
          const existing = found.get(sub)!;
          existing.source = "both";
        }
      }
    }

    // ── 3. DNS resolution for crt.sh results ──────────────────────────────────
    if (params.resolveDns) {
      const resolveJobs = Array.from(found.values()).map(async (entry) => {
        const r = await resolveDomain(entry.subdomain);
        entry.ips = r.ips;
        entry.cnames = r.cnames;
      });
      await Promise.all(resolveJobs);
    }

    // Filter out subdomains with no DNS resolution if resolving
    const results = Array.from(found.values()).filter(
      (e) => !params.resolveDns || e.ips.length > 0 || e.cnames.length > 0
    );

    // ── 4. HTTP probe ──────────────────────────────────────────────────────────
    if (params.checkHttp) {
      const httpJobs = results.map(async (entry) => {
        const r = await checkHttp(entry.subdomain, params.timeoutMs);
        entry.hasHttp = r.hasHttp;
        entry.hasHttps = r.hasHttps;
      });
      await Promise.all(httpJobs);
    }

    results.sort((a, b) => a.subdomain.localeCompare(b.subdomain));

    res.json({
      domain,
      totalFound: results.length,
      sources: { certTransparency: Array.from(found.values()).filter(e => e.source !== "brute").length, bruteForce: params.bruteForce ? COMMON_PREFIXES.length : 0 },
      results,
      summary: {
        withDns: results.filter(e => e.ips.length > 0).length,
        withHttp: results.filter(e => e.hasHttp).length,
        withHttps: results.filter(e => e.hasHttps).length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Subdomain scan failed" });
  }
});

export default router;
