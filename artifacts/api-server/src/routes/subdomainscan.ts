// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Subdomain Scanner — subfinder / amass equivalent
 * Enumerate subdomains via certificate transparency logs (crt.sh) + DNS resolution.
 */
import { Router } from "express";
import { z } from "zod";
import https from "https";
import dns from "dns/promises";
import { requireVerifiedAsset } from "../lib/verified-assets";

const router = Router();

const ScanSchema = z.object({
  domain:       z.string().min(3).max(253).regex(/^[a-zA-Z0-9.-]+$/),
  resolveDns:   z.boolean().default(true),
  checkHttp:    z.boolean().default(true),
  timeoutMs:    z.number().int().min(2000).max(60000).default(20000),
  bruteForce:   z.boolean().default(false),
});

const COMMON_PREFIXES = [
  // ── TIER 1: Universal ──────────────────────────────────────────────────────
  "www","www2","www3","web","web1","web2","mail","email","webmail",
  "smtp","smtp1","smtp2","pop","pop3","imap","ftp","sftp","ssh","vpn",
  "api","app","apps","mobile","m",
  // ── TIER 2: Dev / Staging / QA ─────────────────────────────────────────────
  "dev","dev1","dev2","dev3","development","staging","stage","stg","stg1",
  "uat","qa","qa1","qa2","test","test1","test2","testing","sandbox","demo",
  "preview","beta","alpha","pre","prep","preprod","nightly","rc","release",
  "local","localhost",
  // ── TIER 3: Admin / Management ─────────────────────────────────────────────
  "admin","administrator","administrador","panel","cpanel","whm","plesk",
  "webadmin","webmaster","siteadmin","superadmin","root","manager","manage",
  "management","dashboard","portal","control","console","backend","backoffice",
  "ops","operations","helpdesk","servicedesk","staff","employee","employees",
  "hr","crm","erp","oms","cms","wiki","confluence","jira","redmine","mantis",
  // ── TIER 4: Auth / Identity ─────────────────────────────────────────────────
  "auth","oauth","sso","id","identity","login","signin","signup","register",
  "account","accounts","user","users","profile","profiles","me","my",
  "saml","ldap","openid","passport","keycloak","okta","ping","adfs","sts",
  // ── TIER 5: API / Services ──────────────────────────────────────────────────
  "api","api2","api3","api-v1","api-v2","v1","v2","v3","v4","rest","graphql",
  "rpc","soap","webhook","webhooks","callback","service","services","microservice",
  "gateway","proxy","lb","loadbalancer","edge","cdn","cdn2","static","assets",
  // ── TIER 6: Storage / Data ─────────────────────────────────────────────────
  "db","database","db1","db2","mysql","postgres","postgresql","redis","mongo",
  "mongodb","elasticsearch","es","kibana","cassandra","kafka","rabbitmq",
  "storage","files","media","img","images","upload","uploads","download",
  "downloads","blob","s3","minio","object","cdn-assets","img2","pic","pics",
  // ── TIER 7: Monitoring / DevOps ─────────────────────────────────────────────
  "status","health","monitor","monitoring","metrics","prometheus","grafana",
  "analytics","tracking","log","logs","logging","logstash","siem","splunk",
  "newrelic","datadog","zabbix","nagios","prtg","opsgenie","alertmanager",
  "ci","cd","jenkins","gitlab","github","bitbucket","travis","circleci",
  "sonar","sonarqube","nexus","artifactory","registry","harbor","docker",
  "k8s","kubernetes","rancher","openshift","helm","argocd","flux","spinnaker",
  // ── TIER 8: Network / Infrastructure ────────────────────────────────────────
  "ns1","ns2","ns3","ns4","mx1","mx2","mx3","smtp1","smtp2","mail1","mail2",
  "relay","mta","mx","imap","pop","calendar","contacts","calendar2",
  "node","node1","node2","cluster","cluster1","worker","worker1","worker2",
  "master","slave","primary","secondary","replica","failover","standby",
  "firewall","waf","ips","ids","vpn2","remote","rdp","citrix","openvpn",
  "router","switch","dhcp","dns","dns1","dns2","ntp","radius","tacacs",
  // ── TIER 9: Payments / Commerce ─────────────────────────────────────────────
  "pay","payment","payments","checkout","billing","invoice","invoices",
  "shop","store","ecommerce","cart","order","orders","pos","stripe","paypal",
  // ── TIER 10: Communication / Collaboration ───────────────────────────────────
  "chat","slack","teams","meet","video","conference","webrtc","zoom","voice",
  "sip","pbx","voip","twilio","support","helpdesk","zendesk","freshdesk",
  "ticket","tickets","community","forum","blog","news","press","media",
  // ── TIER 11: Backup / Archive / Legacy ──────────────────────────────────────
  "backup","backups","bak","archive","archives","old","legacy","deprecated",
  "mirror","repo","repository","snapshot","vault","archive1","backup1",
  // ── TIER 12: Internal / Corporate ───────────────────────────────────────────
  "internal","intranet","corp","corporate","office","extranet","partner",
  "vendor","supplier","client","clients","vpn-internal","dmz","bastion",
  "jump","jumpbox","jumphost","bastion","dev-internal","staging-internal",
  // ── TIER 13: Cloud / SaaS ───────────────────────────────────────────────────
  "cloud","aws","azure","gcp","heroku","digitalocean","linode","vultr",
  "terraform","ansible","puppet","chef","vagrant","packer","consul","vault",
  // ── TIER 14: Security-specific (honeypots/misconfig targets) ─────────────────
  "secret","secrets","private","hidden","test-api","debug","dev-api","dev-db",
  "test-db","qa-db","staging-db","temp","tmp","cache","session","sessions",
  "token","tokens","key","keys","credential","credentials","config","configs",
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
  source: string;
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

function addSubdomain(found: Map<string, SubdomainResult>, sub: string, source: string) {
  sub = sub.trim().toLowerCase().replace(/^\*\./, "");
  if (!sub || sub.startsWith(".") || sub.includes(" ")) return;
  if (found.has(sub)) {
    const existing = found.get(sub)!;
    if (!existing.source.includes(source)) existing.source += `, ${source}`;
  } else {
    found.set(sub, { subdomain: sub, ips: [], cnames: [], hasHttp: false, hasHttps: false, source });
  }
}

router.post("/", async (req, res) => {
  try {
    const params = ScanSchema.parse(req.body);
    const _sdUserId = (req as any).auth?.userId ?? "unknown";
    const domain = params.domain.toLowerCase().replace(/^\.+|\.+$/g, "");
    await requireVerifiedAsset(_sdUserId, domain, req);

    const found = new Map<string, SubdomainResult>();
    const timeout = Math.min(params.timeoutMs, 15000);

    // ── 1. Certificate Transparency via crt.sh ─────────────────────────────────
    try {
      const json = await httpsGet(
        `https://crt.sh/?q=%25.${domain}&output=json`,
        timeout
      );
      const records: any[] = JSON.parse(json);
      for (const r of records) {
        const names: string[] = (r.name_value ?? "").split("\n").map((s: string) => s.trim().toLowerCase());
        for (const name of names) {
          if (!name.endsWith(`.${domain}`) && name !== domain) continue;
          addSubdomain(found, name, "crt.sh");
        }
      }
    } catch {}

    // ── 2. AlienVault OTX (passive DNS, no key needed) ─────────────────────────
    try {
      const json = await httpsGet(
        `https://otx.alienvault.com/api/v1/indicators/domain/${domain}/passive_dns`,
        timeout
      );
      const data = JSON.parse(json);
      for (const r of (data.passive_dns || [])) {
        const hostname = (r.hostname || "").toLowerCase();
        if (hostname.endsWith(`.${domain}`) || hostname === domain) {
          addSubdomain(found, hostname, "AlienVault OTX");
        }
      }
    } catch {}

    // ── 3. HackerTarget (free, no key) ─────────────────────────────────────────
    try {
      const text = await httpsGet(
        `https://api.hackertarget.com/hostsearch/?q=${domain}`,
        timeout
      );
      for (const line of text.split("\n")) {
        const host = line.split(",")[0]?.trim().toLowerCase();
        if (host && (host.endsWith(`.${domain}`) || host === domain)) {
          addSubdomain(found, host, "HackerTarget");
        }
      }
    } catch {}

    // ── 4. URLScan.io (public results, no key needed for basic) ────────────────
    try {
      const json = await httpsGet(
        `https://urlscan.io/api/v1/search/?q=domain:${domain}&size=200`,
        timeout
      );
      const data = JSON.parse(json);
      for (const r of (data.results || [])) {
        const task = r?.task?.domain || r?.page?.domain || "";
        if (task && (task.endsWith(`.${domain}`) || task === domain)) {
          addSubdomain(found, task, "URLScan.io");
        }
      }
    } catch {}

    // ── 5. Wayback Machine CDX API ─────────────────────────────────────────────
    try {
      const text = await httpsGet(
        `https://web.archive.org/cdx/search/cdx?url=*.${domain}&output=text&fl=original&collapse=urlkey&limit=5000`,
        timeout
      );
      for (const line of text.split("\n")) {
        try {
          const url = new URL(line.trim());
          const host = url.hostname.toLowerCase();
          if (host && (host.endsWith(`.${domain}`) || host === domain)) {
            addSubdomain(found, host, "Wayback CDX");
          }
        } catch {}
      }
    } catch {}

    // ── 6. AnubisDB ────────────────────────────────────────────────────────────
    try {
      const json = await httpsGet(
        `https://jldc.me/anubis/subdomains/${domain}`,
        timeout
      );
      const names: string[] = JSON.parse(json);
      for (const name of (Array.isArray(names) ? names : [])) {
        if (name && (name.endsWith(`.${domain}`) || name === domain)) {
          addSubdomain(found, name, "AnubisDB");
        }
      }
    } catch {}

    // ── 7. RapidDNS ────────────────────────────────────────────────────────────
    try {
      const json = await httpsGet(
        `https://rapiddns.io/subdomain/${domain}?full=1&down=1`,
        timeout
      );
      const matches = json.match(/([a-zA-Z0-9_.-]+\.[a-zA-Z]{2,})/g) || [];
      for (const match of matches) {
        const h = match.toLowerCase();
        if (h.endsWith(`.${domain}`) && h !== domain) {
          addSubdomain(found, h, "RapidDNS");
        }
      }
    } catch {}

    // ── 8. ThreatCrowd (legacy, still useful) ──────────────────────────────────
    try {
      const json = await httpsGet(
        `https://www.threatcrowd.org/searchApi/v2/domain/report/?domain=${domain}`,
        timeout
      );
      const data = JSON.parse(json);
      for (const sub of (data.subdomains || [])) {
        if (sub && (sub.endsWith(`.${domain}`) || sub === domain)) {
          addSubdomain(found, sub, "ThreatCrowd");
        }
      }
    } catch {}

    // ── 9. BufferOver (DNS aggregation) ────────────────────────────────────────
    try {
      const json = await httpsGet(
        `https://tls.bufferover.run/dns?q=.${domain}`,
        timeout
      );
      const data = JSON.parse(json);
      for (const r of [...(data.FDNS_A || []), ...(data.RDNS || [])]) {
        const parts = (r || "").split(",");
        for (const p of parts) {
          const h = p.trim().toLowerCase();
          if (h.endsWith(`.${domain}`) || h === domain) {
            addSubdomain(found, h, "BufferOver");
          }
        }
      }
    } catch {}

    // ── 10. Brute-force common prefixes ─────────────────────────────────────────
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

    const sourceMap: Record<string, number> = {};
    for (const r of results) {
      for (const src of r.source.split(", ")) {
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      }
    }

    res.json({
      domain,
      totalFound: results.length,
      passiveSources: ["crt.sh", "AlienVault OTX", "HackerTarget", "URLScan.io", "Wayback CDX", "AnubisDB", "RapidDNS", "ThreatCrowd", "BufferOver"],
      sourceBreakdown: sourceMap,
      bruteForced: params.bruteForce ? COMMON_PREFIXES.length : 0,
      results,
      summary: {
        withDns: results.filter(e => e.ips.length > 0).length,
        withHttp: results.filter(e => e.hasHttp).length,
        withHttps: results.filter(e => e.hasHttps).length,
        uniqueSources: Object.keys(sourceMap).length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Subdomain scan failed" });
  }
});

export default router;
