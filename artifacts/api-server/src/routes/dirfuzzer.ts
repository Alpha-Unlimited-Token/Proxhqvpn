// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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
    // Core pages & structure
    "admin","login","dashboard","api","v1","v2","v3","v4","status","health","config",
    "backup","db","database","logs","log","data","files","uploads","images","static",
    "assets","css","js","media","docs","documentation","help","support","about",
    "contact","home","index","default","robots.txt","sitemap.xml","security.txt",
    "wp-admin","wp-login","phpmyadmin","cpanel","webmail","mail","ftp","ssh",
    "console","panel","portal","management","manager","admin.php","login.php",
    "register","signup","signin","logout","auth","oauth","token","refresh","reset",
    "graphql","rest","soap","swagger","openapi","api-docs","redoc","metrics",
    "prometheus","kibana","grafana","jenkins","gitlab","github","bitbucket","sonar",
    ".git","/.git/HEAD","/.env",".env","env","environment","secrets","credentials",
    "private","hidden","test","debug","dev","development","staging","production",
    "tmp","temp","cache","session","cookie","users","user","accounts","account",
    "profile","settings","preferences","billing","payment","checkout","cart",
    "store","shop","product","products","order","orders","invoice","invoices",
    // Common web frameworks
    "wp-content","wp-includes","wp-json","xmlrpc.php","feed","rss","atom",
    "drupal","joomla","magento","prestashop","opencart","typo3","laravel",
    // Server-side files
    "server-status","server-info","info.php","phpinfo.php","test.php","debug.php",
    "install.php","setup.php","upgrade.php","update.php","migrate.php",
    // Common endpoints
    "ping","pong","alive","ok","ready","version","info","about.json","health.json",
    "error","404","500","403","503","maintenance","coming-soon","error.php",
    // Monitoring / metrics
    "actuator","actuator/health","actuator/info","actuator/env","actuator/metrics",
    "actuator/beans","actuator/mappings","actuator/threaddump","actuator/heapdump",
    "trace","tracing","jaeger","zipkin","lightstep",
    // Node / Express
    "node_modules","package.json","package-lock.json","yarn.lock",".npmrc",
    // Python / Django / Flask
    "requirements.txt","Pipfile","Pipfile.lock","manage.py","wsgi.py","asgi.py",
    "settings.py","urls.py","admin/","django-admin",
    // Java / Spring Boot
    "WEB-INF","WEB-INF/web.xml","META-INF","spring","struts","seam",
    // Miscellaneous
    "crossdomain.xml","clientaccesspolicy.xml","browserconfig.xml","manifest.json",
    ".well-known","/.well-known/security.txt","/.well-known/acme-challenge",
    "humans.txt","ads.txt","app-ads.txt","sellers.json",
  ],
  api: [
    // REST versioned
    "api/v1","api/v2","api/v3","api/v4","api/v5",
    "api/v1/users","api/v1/auth","api/v1/login","api/v1/admin","api/v1/config",
    "api/v1/health","api/v1/status","api/v1/metrics","api/v1/logs",
    "api/v2/users","api/v2/auth","api/v2/login","api/v2/admin",
    "api/users","api/auth","api/token","api/login","api/logout","api/register",
    "api/me","api/profile","api/admin","api/config","api/health","api/status",
    "api/metrics","api/logs","api/backup","api/export","api/import","api/debug",
    "api/search","api/upload","api/download","api/keys","api/secrets","api/reset",
    "api/ping","api/info","api/version","api/swagger","api/docs","api/openapi",
    // Spring Boot / Java
    "api/actuator","api/actuator/health","api/actuator/env","api/actuator/beans",
    "api/actuator/heapdump","api/actuator/threaddump","api/actuator/metrics",
    // GraphQL
    "graphql","graphiql","api/graphql","graphql/console","graph","gql",
    // Protocol endpoints
    "rest/v1","rest/v2","rpc","json-rpc","xml-rpc","soap","wsdl","wsdl?wsdl",
    "jsonrpc","trpc","grpc","websocket","ws","wss",
    // Webhooks / callbacks
    "webhook","webhooks","callback","callbacks","notify","notification","push",
    "events","event","stream","streaming","poll","polling","subscribe","hook",
    // Internal API paths
    "internal/api","private/api","api/internal","api/private","api/admin/users",
    "api/admin/settings","api/system","api/platform","api/service","api/backend",
    // Auth-specific
    "oauth","oauth2","oauth/authorize","oauth/token","oauth/callback","oauth/revoke",
    "saml","saml2","saml/login","saml/acs","saml/logout","saml/metadata",
    "auth","auth/login","auth/logout","auth/refresh","auth/token","auth/callback",
    "auth/register","auth/forgot-password","auth/reset-password","auth/verify",
    "sso","sso/login","sso/callback","sso/logout","sso/saml","sso/oidc",
  ],
  admin: [
    // Generic admin panels
    "admin","administrator","admin/login","admin/dashboard","admin/users",
    "admin/config","admin/settings","admin/panel","adminpanel","admin-panel",
    "admin.php","admin.html","admin.asp","admin.aspx","admin.jsp","admin.do",
    // CMS panels
    "wp-admin","wp-admin/","wp-login.php","wp-json/wp/v2/users",
    "phpmyadmin","phpmyadmin/","pma","pma/","adminer","adminer.php",
    "drupal","drupal/admin","joomla/administrator","typo3/","magento/admin",
    "opencart/admin","prestashop/admin","craft/admin","ghost/ghost","strapi/admin",
    // Server management
    "cpanel","cpanel/","whm","plesk","directadmin","vesta","kloxo","aaPanel",
    "webmin","virtualmin","monit","supervisord","pm2","passenger",
    // Internal management
    "manage","management","control","controlpanel","console","portal","backend",
    "backoffice","ops","operations","sysadmin","superadmin","root","webmaster",
    "master","master/","internal","intranet","staff","employees","hr","helpdesk",
    // Databases
    "adminer","dbadmin","db-admin","myadmin","mysql-admin","pgadmin","pgadmin4",
    "redis-commander","mongo-express","elastichead","kibana",
    // DevOps / CI
    "jenkins","jenkins/","gitlab","gitlab-ci","teamcity","bamboo","drone",
    "argo","argocd","spinnaker","concourse","gocd","rundeck","ansible-tower",
    // Secrets / Config
    "vault","consul","secrets","config-server","spring-config","etcd",
    // Monitoring
    "grafana","prometheus","alertmanager","nagios","zabbix","prtg","icinga",
    "newrelic","datadog","splunk","graylog","elk","opensearch-dashboards",
  ],
  backup: [
    // Backup directories
    "backup","backups","bak","old","archive","archives","dump","dumps","snap",
    "snapshots","restore","history","previous","latest","recent",
    // SQL dumps
    "db.sql","database.sql","backup.sql","dump.sql","full.sql","data.sql",
    "users.sql","admin.sql","wordpress.sql","joomla.sql","drupal.sql",
    "db_backup.sql","prod.sql","production.sql","staging.sql","dev.sql",
    // Archives
    "backup.zip","backup.tar.gz","backup.tar","backup.tgz","backup.7z",
    "site.zip","www.zip","website.zip","web.zip","data.zip","files.zip",
    "public_html.zip","htdocs.zip","wwwroot.zip","html.zip",
    "site.tar.gz","www.tar.gz","website.tar.gz","public.tar.gz",
    "_backup","_old","_archive","backup_old","old_backup","site_backup","db_backup",
    "backup_2023","backup_2024","backup_2025","db_2024","db_2025",
    // WordPress-specific
    "wp-content/backup-db","wp-content/backups","wp-content/uploads",
    "wp-content/debug.log","wp-content/uploads/backup",
    // Config backups
    "config.php.bak","config.bak","settings.bak","web.config.bak",
    "config.php.old","config.php~","settings.php.bak","database.php.bak",
    ".htaccess.bak","nginx.conf.bak","apache2.conf.bak","httpd.conf.bak",
    // Miscellaneous backup artifacts
    ".DS_Store","Thumbs.db","desktop.ini","thumbs.db",".htaccess",".htpasswd",
    "error_log","access_log","php_errors.log","laravel.log","debug.log",
    "npm-debug.log","yarn-error.log","pip-log.txt",
  ],
  sensitive: [
    // Environment files
    ".env",".env.local",".env.production",".env.staging",".env.development",
    ".env.test",".env.backup",".env.bak",".env.old",".env.example",".env.sample",
    ".env.default",".env.docker",".env.ci",".env.prod",".env.dev",
    "env.json","config.json","config.yaml","config.yml","config.toml","config.ini",
    "app.config","appsettings.json","appsettings.Development.json",
    "application.properties","application.yml","application.yaml",
    // Secrets / credentials
    "secrets.json","secrets.yaml","secrets.yml","credentials.json","credentials.yaml",
    "credentials","keyfile.json","service-account.json","sa.json","gcp-key.json",
    "aws-credentials","~/.aws/credentials","cloud-config.yml",
    // Git internals (source code leak)
    ".git/config",".git/HEAD",".git/COMMIT_EDITMSG",".git/description",
    ".git/index",".git/packed-refs",".git/refs/heads/master",
    ".git/refs/heads/main",".git/logs/HEAD",".git/FETCH_HEAD",
    ".gitignore",".gitconfig",".gitmodules",
    // SSH keys
    ".ssh/authorized_keys",".ssh/id_rsa",".ssh/id_rsa.pub",".ssh/id_ed25519",
    ".ssh/id_ecdsa","id_rsa","id_ed25519","id_ecdsa","known_hosts",
    // SSL/TLS
    "private.pem","private.key","server.key","server.pem","certificate.pem",
    "cert.pem","ssl.key","ssl.crt","ssl.pem","ca.pem","ca.key","ca.crt",
    "wildcard.pem","star.key","fullchain.pem","privkey.pem",
    // PHP configs
    "wp-config.php","wp-config-sample.php","wp-config.php.bak","wp-config.php.old",
    "config.php","configuration.php","settings.php","database.php","db.php",
    "db_connect.php","connection.php","conf.php","define.php","init.php",
    // Web server
    ".htaccess",".htpasswd","passwd","shadow","hosts","resolv.conf",
    "nginx.conf","apache2.conf","httpd.conf","lighttpd.conf","caddy.json",
    "mime.types","ssl.conf",
    // Package managers / deps
    "package.json","package-lock.json","yarn.lock","composer.json","composer.lock",
    "requirements.txt","Gemfile","Gemfile.lock","Pipfile","Pipfile.lock",
    "go.mod","go.sum","Cargo.toml","Cargo.lock","pom.xml","build.gradle",
    // Container / IaC
    "docker-compose.yml","docker-compose.yaml","Dockerfile",
    "kubernetes.yml","kubernetes.yaml","k8s.yml","k8s.yaml","helm-values.yaml",
    "terraform.tfstate","terraform.tfstate.backup","terraform.tfvars",".terraform",
    "ansible.cfg","inventory.ini","inventory.yaml","playbook.yml",
    "Vagrantfile","packer.json","vault.yml",
    // CI/CD
    ".travis.yml",".circleci/config.yml","Jenkinsfile",".drone.yml",
    ".github/workflows/","bitbucket-pipelines.yml","azure-pipelines.yml",
    "cloudbuild.yaml","appspec.yml","buildspec.yml",
    // Misc sensitive
    "README.md","CHANGELOG.md","INSTALL.md","TODO.md","NOTES.txt","SECURITY.md",
    "crossdomain.xml","clientaccesspolicy.xml","browserconfig.xml",
    "dump.rdb","appendonly.aof","mongodump",
    "id_tokens","refresh_tokens","session_tokens","auth_tokens",
    "private_key.json","keystore.jks","truststore.jks",".p12",".pfx",
  ],
};

const FuzzSchema = z.object({
  url:            z.string().url(),
  wordlist:       z.enum(["common","api","admin","backup","sensitive","custom"]).default("common"),
  customWords:    z.array(z.string()).max(500).optional(),
  extensions:     z.array(z.string()).max(10).default([]),
  filterCodes:    z.array(z.number()).default([404]),
  filterSizes:    z.array(z.number()).optional(),
  threads:        z.number().int().min(1).max(20).default(10),
  timeoutMs:      z.number().int().min(500).max(10000).default(5000),
  followRedirects:z.boolean().default(false),
  verifySsl:      z.boolean().default(false),
  recursive:      z.boolean().default(false),
  recursionDepth: z.number().int().min(1).max(3).default(2),
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

async function fuzzPaths(
  baseUrl: string,
  pathList: string[],
  params: { timeoutMs: number; verifySsl: boolean; followRedirects: boolean; threads: number; filterCodes: number[]; filterSizes?: number[] }
): Promise<{ hits: FuzzHit[]; errors: string[]; tested: number }> {
  const filter = new Set(params.filterCodes);
  const hits: FuzzHit[] = [];
  const errors: string[] = [];
  const queue = [...pathList];

  const workers = Array.from({ length: params.threads }, async () => {
    while (queue.length > 0) {
      const path = queue.shift();
      if (!path) break;
      try {
        const r = await probe(baseUrl, path, {
          timeoutMs: params.timeoutMs,
          verifySsl: params.verifySsl,
          followRedirects: params.followRedirects,
        });
        if (r.status > 0 && !filter.has(r.status)) {
          if (params.filterSizes && params.filterSizes.length > 0 && params.filterSizes.includes(r.size)) continue;
          hits.push({ path, status: r.status, size: r.size, redirectTo: r.location, timingMs: r.timingMs });
        }
      } catch (e: any) {
        errors.push(`${path}: ${e.message}`);
      }
    }
  });
  await Promise.all(workers);
  return { hits, errors, tested: pathList.length };
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

    const fuzzOpts = {
      timeoutMs: params.timeoutMs,
      verifySsl: params.verifySsl,
      followRedirects: params.followRedirects,
      threads: params.threads,
      filterCodes: params.filterCodes,
      filterSizes: params.filterSizes,
    };

    const first = await fuzzPaths(params.url, paths, fuzzOpts);
    let allHits = [...first.hits];
    let totalTested = first.tested;
    const allErrors = [...first.errors];

    if (params.recursive && params.recursionDepth > 1) {
      const dirs = first.hits
        .filter(h => h.status >= 200 && h.status < 400)
        .map(h => h.path)
        .filter(p => !p.includes("."));

      const recurseWords = WORDLISTS["common"].slice(0, 50);
      const seen = new Set(paths);

      for (let depth = 1; depth < params.recursionDepth; depth++) {
        const newDirs: string[] = [];
        for (const dir of (depth === 1 ? dirs : newDirs)) {
          const subPaths: string[] = [];
          for (const w of recurseWords) {
            const p = `${dir}/${w}`;
            if (!seen.has(p)) { subPaths.push(p); seen.add(p); }
          }
          if (subPaths.length === 0) continue;
          const sub = await fuzzPaths(params.url, subPaths, fuzzOpts);
          allHits = [...allHits, ...sub.hits];
          totalTested += sub.tested;
          allErrors.push(...sub.errors);
          for (const h of sub.hits) {
            if (h.status >= 200 && h.status < 400 && !h.path.includes(".")) newDirs.push(h.path);
          }
        }
      }
    }

    allHits.sort((a, b) => a.path.localeCompare(b.path));

    res.json({
      baseUrl: params.url,
      wordlist: params.wordlist,
      totalTested,
      recursive: params.recursive,
      recursionDepth: params.recursive ? params.recursionDepth : 0,
      hits: allHits,
      errors: allErrors.slice(0, 30),
      summary: {
        found: allHits.length,
        "2xx": allHits.filter(h => h.status >= 200 && h.status < 300).length,
        "3xx": allHits.filter(h => h.status >= 300 && h.status < 400).length,
        "4xx": allHits.filter(h => h.status >= 400 && h.status < 500).length,
        "5xx": allHits.filter(h => h.status >= 500).length,
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
