/**
 * Directory Fuzzer — Burp Suite Intruder / ffuf equivalent
 * Brute-force paths against a target to discover hidden endpoints.
 */
import { Router } from "express";
import { z } from "zod";
import https from "https";
import http from "http";
import { URL } from "url";

const router = Router();

const WORDLISTS: Record<string, string[]> = {
  common: [
    "admin","login","dashboard","api","v1","v2","v3","status","health","config",
    "backup","db","database","logs","log","data","files","uploads","images","static",
    "assets","css","js","media","docs","documentation","help","support","about",
    "contact","home","index","default","robots.txt","sitemap.xml","security.txt",
    "wp-admin","wp-login","phpmyadmin","cpanel","webmail","mail","ftp","ssh",
    "console","panel","portal","management","manager","admin.php","login.php",
    "register","signup","signin","logout","auth","oauth","token","refresh",
    "graphql","rest","soap","swagger","openapi","api-docs","redoc","metrics",
    "prometheus","kibana","grafana","jenkins","gitlab","github","bitbucket",
    ".git","/.git/HEAD","/.env",".env","env","environment","secrets","credentials",
    "private","hidden","test","debug","dev","development","staging","production",
    "tmp","temp","cache","session","cookie","users","user","accounts","account",
    "profile","settings","preferences","billing","payment","checkout","cart",
    "store","shop","product","products","order","orders","invoice","invoices",
  ],
  api: [
    "api/v1","api/v2","api/v3","api/users","api/auth","api/token","api/login",
    "api/register","api/me","api/profile","api/admin","api/config","api/health",
    "api/status","api/metrics","api/logs","api/backup","api/export","api/import",
    "api/search","api/upload","api/download","api/keys","api/secrets","api/keys",
    "v1/users","v1/auth","v1/login","v1/admin","v2/users","v2/auth","v2/admin",
    "graphql","rest/v1","rest/v2","rpc","json-rpc","xml-rpc","soap","wsdl",
    "webhook","webhooks","callback","callbacks","notify","notification","push",
  ],
  admin: [
    "admin","administrator","admin/login","admin/dashboard","admin/users",
    "admin/config","admin/settings","admin/panel","adminpanel","admin-panel",
    "wp-admin","phpmyadmin","adminer","manage","management","control",
    "controlpanel","cpanel","webadmin","siteadmin","superadmin","root",
    "backend","backoffice","cms","oms","erp","crm","dashboard","portal",
    "secret","hidden","private","internal","intranet","staff","employee",
  ],
  backup: [
    "backup","backups","bak","old","archive","archives","dump","dumps",
    "db.sql","database.sql","backup.sql","dump.sql","backup.zip","backup.tar.gz",
    "backup.tar","backup.tgz","site.zip","www.zip","website.zip","data.zip",
    ".backup","_backup","backup_old","old_backup","site_backup","db_backup",
    "wp-content/backup-db","wp-content/backups","wp-content/uploads",
    "config.php.bak","config.bak","settings.bak","web.config.bak",
    ".DS_Store","Thumbs.db","desktop.ini","thumbs.db",".htaccess",".htpasswd",
  ],
  sensitive: [
    ".env",".env.local",".env.production",".env.staging",".env.development",
    ".env.backup",".env.bak","env.json","config.json","config.yaml","config.yml",
    "secrets.json","secrets.yaml","credentials.json","credentials.yaml",
    ".git/config",".git/HEAD",".git/COMMIT_EDITMSG",".git/description",
    ".ssh/authorized_keys",".ssh/id_rsa","id_rsa","private.pem","private.key",
    "server.key","server.pem","certificate.pem","cert.pem","ssl.key","ssl.crt",
    "wp-config.php","wp-config-sample.php","wp-config.php.bak",
    "config.php","configuration.php","settings.php","database.php","db.php",
    ".htaccess",".htpasswd","passwd","shadow","hosts","resolv.conf",
    "package.json","composer.json","requirements.txt","Gemfile","Pipfile",
    "docker-compose.yml","docker-compose.yaml","Dockerfile","kubernetes.yml",
    "terraform.tfstate","terraform.tfvars","ansible.cfg","inventory.ini",
    "README.md","CHANGELOG.md","INSTALL.md","TODO.md","NOTES.txt",
    "crossdomain.xml","clientaccesspolicy.xml","browserconfig.xml",
  ],
};

const FuzzSchema = z.object({
  url:            z.string().url(),
  wordlist:       z.enum(["common","api","admin","backup","sensitive","custom"]).default("common"),
  customWords:    z.array(z.string()).max(500).optional(),
  extensions:     z.array(z.string()).max(10).default([]),
  filterCodes:    z.array(z.number()).default([404]),
  threads:        z.number().int().min(1).max(20).default(10),
  timeoutMs:      z.number().int().min(500).max(10000).default(5000),
  followRedirects:z.boolean().default(false),
  verifySsl:      z.boolean().default(false),
});

type FuzzHit = {
  path: string;
  status: number;
  size: number;
  redirectTo?: string;
  timingMs: number;
};

function probe(baseUrl: string, path: string, opts: { timeoutMs: number; verifySsl: boolean; followRedirects: boolean }) {
  return new Promise<{ status: number; size: number; location?: string; timingMs: number }>((resolve) => {
    const start = Date.now();
    const full = baseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    let parsed: URL;
    try { parsed = new URL(full); } catch { resolve({ status: 0, size: 0, timingMs: 0 }); return; }

    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        method: "HEAD",
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: { "User-Agent": "ProxhqVPN-Fuzzer/1.0" },
        rejectUnauthorized: opts.verifySsl,
        timeout: opts.timeoutMs,
      },
      (res) => {
        let size = 0;
        res.on("data", (c: Buffer) => { size += c.length; });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            size: parseInt(res.headers["content-length"] ?? "0") || size,
            location: res.headers.location,
            timingMs: Date.now() - start,
          });
        });
        res.destroy();
        resolve({
          status: res.statusCode ?? 0,
          size: parseInt(res.headers["content-length"] ?? "0") || 0,
          location: res.headers.location,
          timingMs: Date.now() - start,
        });
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, size: 0, timingMs: Date.now() - start }); });
    req.on("error", () => { resolve({ status: 0, size: 0, timingMs: Date.now() - start }); });
    req.end();
  });
}

router.post("/", async (req, res) => {
  try {
    const params = FuzzSchema.parse(req.body);
    const baseWords = params.wordlist === "custom"
      ? (params.customWords ?? [])
      : WORDLISTS[params.wordlist];

    const paths: string[] = [];
    for (const w of baseWords) {
      paths.push(w);
      for (const ext of params.extensions) {
        const e = ext.startsWith(".") ? ext : `.${ext}`;
        if (!w.includes(".")) paths.push(w + e);
      }
    }

    const filter = new Set(params.filterCodes);
    const hits: FuzzHit[] = [];
    const errors: string[] = [];

    const queue = [...paths];
    const workers = Array.from({ length: params.threads }, async () => {
      while (queue.length > 0) {
        const path = queue.shift();
        if (!path) break;
        try {
          const r = await probe(params.url, path, {
            timeoutMs: params.timeoutMs,
            verifySsl: params.verifySsl,
            followRedirects: params.followRedirects,
          });
          if (r.status > 0 && !filter.has(r.status)) {
            hits.push({
              path,
              status: r.status,
              size: r.size,
              redirectTo: r.location,
              timingMs: r.timingMs,
            });
          }
        } catch (e: any) {
          errors.push(`${path}: ${e.message}`);
        }
      }
    });
    await Promise.all(workers);

    hits.sort((a, b) => a.path.localeCompare(b.path));

    res.json({
      baseUrl: params.url,
      wordlist: params.wordlist,
      totalTested: paths.length,
      hits,
      errors: errors.slice(0, 20),
      summary: {
        found: hits.length,
        "2xx": hits.filter(h => h.status >= 200 && h.status < 300).length,
        "3xx": hits.filter(h => h.status >= 300 && h.status < 400).length,
        "4xx": hits.filter(h => h.status >= 400 && h.status < 500).length,
        "5xx": hits.filter(h => h.status >= 500).length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Fuzz failed" });
  }
});

router.get("/wordlists", (_req, res) => {
  res.json(
    Object.fromEntries(
      Object.entries(WORDLISTS).map(([k, v]) => [k, v.length])
    )
  );
});

export default router;
