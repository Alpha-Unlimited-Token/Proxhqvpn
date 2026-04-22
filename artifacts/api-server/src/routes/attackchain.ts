import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { attackChainScansTable, attackChainFindingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import https from "https";
import http from "http";
import dns from "dns/promises";
import tls from "tls";
import { URL } from "url";

const router = Router();

interface Finding {
  surface: string;
  surfaceType: string;
  findingType: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  evidence?: string;
  remediation?: string;
  businessImpact?: string;
  chainIds?: number[];
}

interface StageResult {
  name: string;
  status: "pending" | "running" | "complete" | "error";
  findings: number;
  durationMs?: number;
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchWithTimeout(urlStr: string, timeoutMs = 8000): Promise<{ status: number; headers: Record<string, string>; body: string } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        { host: parsed.hostname, path: parsed.pathname + parsed.search, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80), method: "GET", headers: { "User-Agent": "Mozilla/5.0 ProxhqVPN-Scanner/1.0" }, timeout: timeoutMs, rejectUnauthorized: false },
        res => {
          let body = "";
          res.on("data", chunk => { if (body.length < 8000) body += chunk; });
          res.on("end", () => {
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (typeof v === "string") headers[k.toLowerCase()] = v;
              else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0];
            }
            resolve({ status: res.statusCode || 0, headers, body });
          });
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

async function checkTls(hostname: string): Promise<{ valid: boolean; expiresSoon: boolean; daysLeft: number; protocol: string } | null> {
  return new Promise(resolve => {
    try {
      const sock = tls.connect({ host: hostname, port: 443, rejectUnauthorized: false, timeout: 6000 }, () => {
        const cert = sock.getPeerCertificate();
        const protocol = sock.getProtocol() || "unknown";
        if (!cert || !cert.valid_to) { sock.destroy(); return resolve(null); }
        const expiry = new Date(cert.valid_to);
        const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);
        sock.destroy();
        resolve({ valid: daysLeft > 0, expiresSoon: daysLeft < 30, daysLeft, protocol });
      });
      sock.on("error", () => resolve(null));
      sock.on("timeout", () => { sock.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

async function runScan(scanId: number, target: string) {
  const stages: StageResult[] = [
    { name: "Surface Discovery", status: "pending", findings: 0 },
    { name: "Technology Fingerprinting", status: "pending", findings: 0 },
    { name: "Vulnerability Testing", status: "pending", findings: 0 },
    { name: "Chain Correlation", status: "pending", findings: 0 },
    { name: "Impact Assessment", status: "pending", findings: 0 },
  ];

  const allFindings: Finding[] = [];

  async function saveStages() {
    await db.update(attackChainScansTable)
      .set({ stagesJson: JSON.stringify(stages) })
      .where(eq(attackChainScansTable.id, scanId));
  }

  async function setStage(index: number, status: StageResult["status"]) {
    stages[index].status = status;
    await db.update(attackChainScansTable)
      .set({ stagesJson: JSON.stringify(stages), currentStage: stages[index].name })
      .where(eq(attackChainScansTable.id, scanId));
  }

  try {
    let hostname = target.replace(/^https?:\/\//, "").replace(/\/.*/, "");
    const baseUrl = target.startsWith("http") ? target.replace(/\/$/, "") : `https://${target}`;

    // ─── Stage 1: Surface Discovery ──────────────────────────────────────────
    await setStage(0, "running");
    const t0 = Date.now();

    let ipAddresses: string[] = [];
    try {
      const resolved = await dns.resolve4(hostname);
      ipAddresses = resolved;
    } catch {}

    let subdomainsFound: string[] = [];
    const commonSubs = ["www", "api", "admin", "app", "dev", "staging", "mail", "blog", "shop", "cdn", "static", "assets", "m", "mobile", "portal", "auth", "login", "dashboard", "panel"];
    await Promise.allSettled(commonSubs.map(async sub => {
      try {
        await dns.resolve4(`${sub}.${hostname}`);
        subdomainsFound.push(`${sub}.${hostname}`);
      } catch {}
    }));

    if (ipAddresses.length > 0) {
      allFindings.push({
        surface: hostname,
        surfaceType: "host",
        findingType: "dns_resolved",
        severity: "info",
        title: "Target Resolved",
        description: `${hostname} resolves to ${ipAddresses.join(", ")}`,
        evidence: `A records: ${ipAddresses.join(", ")}`,
        businessImpact: "Target is reachable and active.",
      });
    }

    if (subdomainsFound.length > 0) {
      allFindings.push({
        surface: hostname,
        surfaceType: "subdomain",
        findingType: "subdomain_exposure",
        severity: subdomainsFound.includes(`admin.${hostname}`) || subdomainsFound.includes(`dev.${hostname}`) ? "medium" : "info",
        title: `${subdomainsFound.length} Subdomains Discovered`,
        description: `Found active subdomains: ${subdomainsFound.join(", ")}`,
        evidence: subdomainsFound.join("\n"),
        remediation: "Audit each subdomain for unnecessary exposure. Remove or restrict access to dev/staging environments.",
        businessImpact: subdomainsFound.includes(`admin.${hostname}`) ? "Admin subdomain publicly exposed — direct target for brute force and exploitation." : "Additional attack surfaces increase total exposure.",
      });
    }

    stages[0].findings = allFindings.length;
    stages[0].durationMs = Date.now() - t0;
    await setStage(0, "complete");
    await delay(400);

    // ─── Stage 2: Technology Fingerprinting ───────────────────────────────────
    await setStage(1, "running");
    const t1 = Date.now();

    const rootResp = await fetchWithTimeout(baseUrl);
    let techStack: string[] = [];

    if (rootResp) {
      const h = rootResp.headers;

      if (!h["x-frame-options"] && !h["content-security-policy"]) {
        allFindings.push({
          surface: baseUrl,
          surfaceType: "header",
          findingType: "missing_security_headers",
          severity: "medium",
          title: "Missing Security Headers",
          description: "Critical security headers are absent: X-Frame-Options, Content-Security-Policy",
          evidence: `Observed response headers: ${Object.keys(h).join(", ")}`,
          remediation: "Add X-Frame-Options: DENY, Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, and HSTS headers.",
          businessImpact: "Without CSP and X-Frame-Options, the app is vulnerable to Clickjacking and XSS attacks that can steal sessions.",
        });
      }

      if (!h["strict-transport-security"]) {
        allFindings.push({
          surface: baseUrl,
          surfaceType: "header",
          findingType: "missing_hsts",
          severity: "medium",
          title: "HTTP Strict Transport Security Not Set",
          description: "HSTS header missing — browsers may connect over HTTP, enabling MITM downgrade attacks.",
          evidence: "No Strict-Transport-Security header in response.",
          remediation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
          businessImpact: "Without HSTS, attackers on the same network can intercept HTTPS-intended traffic.",
        });
      }

      if (h["x-powered-by"]) {
        techStack.push(h["x-powered-by"]);
        allFindings.push({
          surface: baseUrl,
          surfaceType: "header",
          findingType: "technology_disclosure",
          severity: "low",
          title: "Server Technology Disclosed",
          description: `X-Powered-By header reveals server technology: ${h["x-powered-by"]}`,
          evidence: `X-Powered-By: ${h["x-powered-by"]}`,
          remediation: "Remove the X-Powered-By header from server configuration.",
          businessImpact: "Technology disclosure helps attackers target known vulnerabilities in specific framework versions.",
        });
      }

      if (h["server"]) {
        techStack.push(h["server"]);
        if (/apache|nginx|iis|litespeed/i.test(h["server"])) {
          allFindings.push({
            surface: baseUrl,
            surfaceType: "header",
            findingType: "server_banner",
            severity: "low",
            title: "Web Server Version Disclosed",
            description: `Server header reveals: ${h["server"]}`,
            evidence: `Server: ${h["server"]}`,
            remediation: "Configure the server to suppress version information in the Server header.",
            businessImpact: "Known CVEs for detected server version can be directly targeted.",
          });
        }
      }

      if (h["access-control-allow-origin"] === "*") {
        allFindings.push({
          surface: baseUrl,
          surfaceType: "header",
          findingType: "cors_wildcard",
          severity: "high",
          title: "CORS Wildcard Origin Allowed",
          description: "Access-Control-Allow-Origin: * permits any website to make cross-origin requests to this API.",
          evidence: "Access-Control-Allow-Origin: *",
          remediation: "Restrict CORS to specific allowed origins. Never use * on authenticated endpoints.",
          businessImpact: "Any malicious website can make API requests on behalf of authenticated users, enabling CSRF and data theft.",
        });
      }

      if (rootResp.body.includes("wp-content") || rootResp.body.includes("wp-json")) {
        techStack.push("WordPress");
        allFindings.push({
          surface: baseUrl,
          surfaceType: "tech",
          findingType: "cms_detected",
          severity: "low",
          title: "WordPress CMS Detected",
          description: "WordPress signatures detected in page source. Version exposure and plugin vulnerabilities are common attack vectors.",
          evidence: "wp-content references found in HTML",
          remediation: "Hide WordPress version, keep plugins/themes updated, install security plugin (Wordfence).",
          businessImpact: "Outdated WordPress installations are among the most exploited targets globally.",
        });
      }

      if (rootResp.body.includes("laravel") || rootResp.body.includes("Laravel")) {
        techStack.push("Laravel");
      }

      if (rootResp.body.includes("react") || rootResp.body.includes("__webpack_modules__")) {
        techStack.push("React");
      }
    }

    const tlsInfo = await checkTls(hostname);
    if (tlsInfo) {
      if (!tlsInfo.valid) {
        allFindings.push({
          surface: hostname,
          surfaceType: "tls",
          findingType: "invalid_tls",
          severity: "critical",
          title: "TLS Certificate Invalid / Expired",
          description: `TLS certificate has expired or is invalid. Days remaining: ${tlsInfo.daysLeft}`,
          evidence: `daysLeft: ${tlsInfo.daysLeft}, protocol: ${tlsInfo.protocol}`,
          remediation: "Renew the TLS certificate immediately. Consider Let's Encrypt for auto-renewal.",
          businessImpact: "An invalid certificate allows attackers to intercept all encrypted traffic via MITM attacks.",
        });
      } else if (tlsInfo.expiresSoon) {
        allFindings.push({
          surface: hostname,
          surfaceType: "tls",
          findingType: "tls_expiring",
          severity: "medium",
          title: "TLS Certificate Expiring Soon",
          description: `Certificate expires in ${tlsInfo.daysLeft} days.`,
          evidence: `daysLeft: ${tlsInfo.daysLeft}`,
          remediation: "Renew certificate before expiry.",
          businessImpact: "Certificate expiry causes browser security warnings and potential traffic interception.",
        });
      }

      if (tlsInfo.protocol && /TLSv1$|TLSv1\.0|TLSv1\.1|SSLv/.test(tlsInfo.protocol)) {
        allFindings.push({
          surface: hostname,
          surfaceType: "tls",
          findingType: "weak_tls",
          severity: "high",
          title: "Outdated TLS Protocol",
          description: `Server negotiated ${tlsInfo.protocol} — vulnerable to POODLE, BEAST, and LOGJAM attacks.`,
          evidence: `Negotiated: ${tlsInfo.protocol}`,
          remediation: "Disable TLS 1.0 and 1.1. Enforce TLS 1.2 minimum, TLS 1.3 preferred.",
          businessImpact: "Outdated TLS versions allow decryption of intercepted HTTPS traffic.",
        });
      }
    }

    stages[1].findings = allFindings.length - stages[0].findings;
    stages[1].durationMs = Date.now() - t1;
    await setStage(1, "complete");
    await delay(400);

    // ─── Stage 3: Vulnerability Testing ───────────────────────────────────────
    await setStage(2, "running");
    const t2 = Date.now();

    const sensitivePaths = [
      { path: "/.env",           type: "env_exposure",       severity: "critical" as const, title: "Environment File Exposed" },
      { path: "/.git/HEAD",      type: "git_exposure",        severity: "critical" as const, title: "Git Repository Exposed" },
      { path: "/admin",          type: "admin_panel",         severity: "medium"  as const, title: "Admin Panel Accessible" },
      { path: "/admin/login",    type: "admin_panel",         severity: "medium"  as const, title: "Admin Login Page Accessible" },
      { path: "/wp-admin",       type: "wordpress_admin",     severity: "high"    as const, title: "WordPress Admin Exposed" },
      { path: "/phpinfo.php",    type: "phpinfo",             severity: "high"    as const, title: "PHPInfo Exposed" },
      { path: "/config.php",     type: "config_exposure",     severity: "high"    as const, title: "Config File Accessible" },
      { path: "/backup.zip",     type: "backup_exposure",     severity: "critical" as const, title: "Backup Archive Exposed" },
      { path: "/robots.txt",     type: "robots_disclosure",   severity: "info"    as const, title: "Robots.txt Found" },
      { path: "/sitemap.xml",    type: "sitemap",             severity: "info"    as const, title: "Sitemap Exposed" },
      { path: "/server-status",  type: "apache_status",       severity: "medium"  as const, title: "Apache Server Status Exposed" },
      { path: "/actuator",       type: "spring_actuator",     severity: "critical" as const, title: "Spring Boot Actuator Exposed" },
      { path: "/api/v1",         type: "api_endpoint",        severity: "info"    as const, title: "API v1 Endpoint Accessible" },
      { path: "/swagger-ui.html",type: "swagger_ui",          severity: "medium"  as const, title: "Swagger UI Exposed" },
      { path: "/graphql",        type: "graphql",             severity: "medium"  as const, title: "GraphQL Endpoint Found" },
    ];

    const pathResults = await Promise.allSettled(
      sensitivePaths.map(async p => {
        const r = await fetchWithTimeout(`${baseUrl}${p.path}`, 5000);
        return { ...p, resp: r };
      })
    );

    for (const result of pathResults) {
      if (result.status !== "fulfilled") continue;
      const { path, type, severity, title, resp } = result.value;
      if (!resp) continue;

      if (resp.status === 200 || resp.status === 301 || resp.status === 302) {
        let description = "";
        let evidence = `HTTP ${resp.status} at ${baseUrl}${path}`;
        let remediation = "";
        let businessImpact = "";

        if (type === "env_exposure") {
          description = "The .env file is publicly accessible and may contain database credentials, API keys, and secret tokens.";
          evidence += resp.body.includes("=") ? `\nContent preview: ${resp.body.slice(0, 200)}` : "";
          remediation = "Block access to .env via web server config (deny from all in .htaccess or nginx location block).";
          businessImpact = "Complete application compromise — credentials exposed for database, API services, and encryption keys.";
        } else if (type === "git_exposure") {
          description = "Git repository metadata is accessible. Attackers can reconstruct full source code via git-dumper.";
          remediation = "Block /.git/ directory via web server config. Never deploy with git repository intact.";
          businessImpact = "Full source code disclosure enables targeted exploitation of all application logic and hardcoded secrets.";
        } else if (type === "admin_panel") {
          description = `Admin interface at ${path} is publicly reachable without IP restriction.`;
          remediation = "Restrict admin paths to specific IP ranges or place behind VPN/bastion host.";
          businessImpact = "Publicly exposed admin panels are primary targets for credential stuffing and brute force attacks.";
        } else if (type === "phpinfo") {
          description = "phpinfo() output is publicly accessible, revealing server configuration, PHP version, loaded modules, and environment variables.";
          remediation = "Remove phpinfo.php from production. Never expose server diagnostics publicly.";
          businessImpact = "Detailed server configuration enables precision exploitation of known vulnerabilities.";
        } else if (type === "spring_actuator") {
          description = "Spring Boot Actuator endpoint exposes internal health, metrics, environment variables, and in some versions allows arbitrary code execution.";
          remediation = "Disable or secure Actuator endpoints. Never expose /actuator publicly.";
          businessImpact = "Remote code execution possible if /actuator/env or /actuator/loggers endpoints are writable.";
        } else if (type === "swagger_ui") {
          description = "Swagger UI is publicly accessible, exposing all API endpoints, parameters, and authentication mechanisms.";
          remediation = "Restrict Swagger UI to development environments or behind authentication.";
          businessImpact = "Full API documentation accelerates attack planning — all endpoints and expected inputs are revealed.";
        } else if (type === "graphql") {
          description = "GraphQL endpoint accessible. Introspection may be enabled, exposing complete schema.";
          remediation = "Disable GraphQL introspection in production. Add query depth and rate limiting.";
          businessImpact = "GraphQL introspection enables attackers to map every data type, relationship, and mutation available.";
        } else {
          description = `Path ${path} returned HTTP ${resp.status}`;
          remediation = "Audit whether this path should be publicly accessible.";
          businessImpact = "Additional attack surface confirmed accessible.";
        }

        allFindings.push({
          surface: `${baseUrl}${path}`,
          surfaceType: "path",
          findingType: type,
          severity,
          title,
          description,
          evidence,
          remediation,
          businessImpact,
        });
      }
    }

    stages[2].findings = allFindings.length - stages[0].findings - stages[1].findings;
    stages[2].durationMs = Date.now() - t2;
    await setStage(2, "complete");
    await delay(300);

    // ─── Stage 4: Chain Correlation ───────────────────────────────────────────
    await setStage(3, "running");
    const t3 = Date.now();

    interface ChainNode { id: string; label: string; severity: string; type: string; }
    interface ChainEdge { from: string; to: string; label: string; }
    const chainNodes: ChainNode[] = [];
    const chainEdges: ChainEdge[] = [];

    allFindings.forEach((f, i) => {
      chainNodes.push({ id: `F${i}`, label: f.title, severity: f.severity, type: f.findingType });
    });

    const envIdx = allFindings.findIndex(f => f.findingType === "env_exposure");
    const gitIdx = allFindings.findIndex(f => f.findingType === "git_exposure");
    const adminIdx = allFindings.findIndex(f => f.findingType === "admin_panel" || f.findingType === "wordpress_admin");
    const corsIdx = allFindings.findIndex(f => f.findingType === "cors_wildcard");
    const headerIdx = allFindings.findIndex(f => f.findingType === "missing_security_headers");
    const weakTlsIdx = allFindings.findIndex(f => f.findingType === "weak_tls");
    const swaggerIdx = allFindings.findIndex(f => f.findingType === "swagger_ui");
    const actuatorIdx = allFindings.findIndex(f => f.findingType === "spring_actuator");
    const graphqlIdx = allFindings.findIndex(f => f.findingType === "graphql");

    if (envIdx !== -1 && adminIdx !== -1) {
      chainEdges.push({ from: `F${envIdx}`, to: `F${adminIdx}`, label: "Credentials → Admin Access" });
      allFindings[envIdx].chainIds = [...(allFindings[envIdx].chainIds || []), adminIdx];
    }
    if (gitIdx !== -1 && envIdx !== -1) {
      chainEdges.push({ from: `F${gitIdx}`, to: `F${envIdx}`, label: "Source exposes .env path" });
    }
    if (corsIdx !== -1 && headerIdx !== -1) {
      chainEdges.push({ from: `F${corsIdx}`, to: `F${headerIdx}`, label: "No CSP → XSS + CORS steal" });
    }
    if (swaggerIdx !== -1 && adminIdx !== -1) {
      chainEdges.push({ from: `F${swaggerIdx}`, to: `F${adminIdx}`, label: "API map → admin endpoint targeting" });
    }
    if (weakTlsIdx !== -1 && envIdx !== -1) {
      chainEdges.push({ from: `F${weakTlsIdx}`, to: `F${envIdx}`, label: "TLS downgrade → .env in cleartext" });
    }
    if (actuatorIdx !== -1) {
      chainEdges.push({ from: `F${actuatorIdx}`, to: `F${actuatorIdx}`, label: "Actuator → RCE via env POST" });
    }
    if (graphqlIdx !== -1 && corsIdx !== -1) {
      chainEdges.push({ from: `F${corsIdx}`, to: `F${graphqlIdx}`, label: "CORS + GraphQL → cross-origin data dump" });
    }

    stages[3].findings = chainEdges.length;
    stages[3].durationMs = Date.now() - t3;
    await setStage(3, "complete");
    await delay(200);

    // ─── Stage 5: Impact Assessment ───────────────────────────────────────────
    await setStage(4, "running");

    const severityWeight = { critical: 40, high: 20, medium: 8, low: 2, info: 0 };
    let rawScore = 0;
    for (const f of allFindings) {
      rawScore += severityWeight[f.severity] || 0;
    }
    const riskScore = Math.min(100, rawScore);

    const criticals = allFindings.filter(f => f.severity === "critical").length;
    const highs = allFindings.filter(f => f.severity === "high").length;
    const chains = chainEdges.length;

    let summary = `Attack surface analysis of ${target} complete. `;
    if (criticals > 0) summary += `${criticals} critical finding${criticals > 1 ? "s" : ""} detected — immediate remediation required. `;
    if (chains > 0) summary += `${chains} attack chain${chains > 1 ? "s" : ""} identified where findings compound each other. `;
    if (allFindings.length === 0) summary = `No significant vulnerabilities detected in the analyzed surface of ${target}.`;

    stages[4].findings = allFindings.length;
    stages[4].durationMs = 200;
    await setStage(4, "complete");

    // ─── Persist Findings ─────────────────────────────────────────────────────
    if (allFindings.length > 0) {
      await db.insert(attackChainFindingsTable).values(
        allFindings.map(f => ({
          scanId,
          surface: f.surface,
          surfaceType: f.surfaceType,
          findingType: f.findingType,
          severity: f.severity,
          title: f.title,
          description: f.description,
          evidence: f.evidence || null,
          remediation: f.remediation || null,
          chainIdsJson: f.chainIds ? JSON.stringify(f.chainIds) : null,
          businessImpact: f.businessImpact || null,
        }))
      );
    }

    await db.update(attackChainScansTable).set({
      scanStatus: "complete",
      riskScore,
      summary,
      stagesJson: JSON.stringify(stages),
      chainGraphJson: JSON.stringify({ nodes: chainNodes, edges: chainEdges }),
      completedAt: new Date(),
      currentStage: "Complete",
    }).where(eq(attackChainScansTable.id, scanId));

  } catch (err) {
    console.error("[attack-chain] scan error:", err);
    await db.update(attackChainScansTable).set({
      scanStatus: "error",
      summary: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      stagesJson: JSON.stringify(stages),
    }).where(eq(attackChainScansTable.id, scanId));
  }
}

router.post("/scan", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let { target } = req.body as { target: string };
  if (!target) return res.status(400).json({ error: "target required" });

  target = target.trim().toLowerCase();
  if (!target.startsWith("http")) target = `https://${target}`;

  let hostname: string;
  try {
    hostname = new URL(target).hostname;
    if (!hostname || hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
      return res.status(400).json({ error: "Internal/private targets not allowed" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid target URL" });
  }

  const stages = [
    { name: "Surface Discovery", status: "pending", findings: 0 },
    { name: "Technology Fingerprinting", status: "pending", findings: 0 },
    { name: "Vulnerability Testing", status: "pending", findings: 0 },
    { name: "Chain Correlation", status: "pending", findings: 0 },
    { name: "Impact Assessment", status: "pending", findings: 0 },
  ];

  const [scan] = await db.insert(attackChainScansTable).values({
    target: hostname,
    scanStatus: "running",
    createdBy: userId,
    stagesJson: JSON.stringify(stages),
    currentStage: "Initializing",
  }).returning();

  runScan(scan.id, target).catch(err => console.error("[attack-chain] background scan error:", err));

  res.json({ scanId: scan.id, target: hostname, status: "running" });
});

router.get("/scan/:id", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const scanId = parseInt(String(req.params.id));
  const [scan] = await db.select().from(attackChainScansTable).where(eq(attackChainScansTable.id, scanId)).limit(1);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  if (scan.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });

  const findings = await db.select().from(attackChainFindingsTable).where(eq(attackChainFindingsTable.scanId, scanId)).orderBy(attackChainFindingsTable.severity);

  res.json({
    ...scan,
    stages: scan.stagesJson ? JSON.parse(scan.stagesJson) : [],
    chainGraph: scan.chainGraphJson ? JSON.parse(scan.chainGraphJson) : { nodes: [], edges: [] },
    findings,
  });
});

router.get("/scans", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const scans = await db
    .select()
    .from(attackChainScansTable)
    .where(eq(attackChainScansTable.createdBy, userId))
    .orderBy(desc(attackChainScansTable.startedAt))
    .limit(20);

  res.json(scans);
});

router.delete("/scan/:id", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const scanId = parseInt(String(req.params.id));
  const [scan] = await db.select().from(attackChainScansTable).where(eq(attackChainScansTable.id, scanId)).limit(1);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  if (scan.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });

  await db.delete(attackChainFindingsTable).where(eq(attackChainFindingsTable.scanId, scanId));
  await db.delete(attackChainScansTable).where(eq(attackChainScansTable.id, scanId));
  res.json({ ok: true });
});

export default router;
