import http from "http";
import https from "https";

export interface PenTestFinding {
  id: string;
  testName: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  cvssScore: number;
  endpoint: string;
  method: string;
  payload: string;
  response: string;
  vulnerable: boolean;
  evidence: string;
  cweId: string;
  description: string;
  recommendation: string;
  bountyEstimate: string;
}

export interface PenTestReport {
  target: string;
  scanDate: string;
  duration: number;
  totalTests: number;
  vulnerableCount: number;
  findings: PenTestFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8080";

async function probe(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "QuantumAudit-PenTest/1.0",
      ...headers,
    };
    if (bodyStr) reqHeaders["Content-Length"] = String(Buffer.byteLength(bodyStr));

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: reqHeaders,
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const resHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            resHeaders[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
          }
          resolve({ status: res.statusCode ?? 0, body: data.slice(0, 2000), headers: resHeaders });
        });
      }
    );
    req.on("error", (e) => resolve({ status: 0, body: e.message, headers: {} }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "TIMEOUT", headers: {} }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Test Definitions ──────────────────────────────────────────────────────────

async function testSQLInjection(): Promise<PenTestFinding[]> {
  const findings: PenTestFinding[] = [];
  const sqlPayloads = [
    { label: "Classic OR bypass", p: "' OR '1'='1" },
    { label: "UNION SELECT", p: "' UNION SELECT 1,2,3--" },
    { label: "Stacked query", p: "'; DROP TABLE scan_jobs;--" },
    { label: "Boolean blind", p: "1 AND 1=1" },
    { label: "Time-based blind", p: "'; SELECT pg_sleep(3);--" },
    { label: "Comment bypass", p: "admin'--" },
  ];

  for (const { label, p } of sqlPayloads) {
    const r = await probe("GET", `/api/quantum-audit/scans?search=${encodeURIComponent(p)}`);
    const sqlErrorPatterns = [
      "syntax error", "pg_query", "unterminated", "postgresql",
      "ERROR:", "invalid input syntax", "pg_sleep", "column", "relation",
    ];
    const hasError = sqlErrorPatterns.some((pat) =>
      r.body.toLowerCase().includes(pat.toLowerCase())
    );
    const hasSleep = r.status === 0 && p.includes("pg_sleep");

    findings.push({
      id: `sqli-${label.replace(/\s/g, "-").toLowerCase()}`,
      testName: `SQL Injection — ${label}`,
      category: "SQL Injection",
      severity: hasError || hasSleep ? "critical" : "info",
      cvssScore: hasError || hasSleep ? 9.8 : 0,
      endpoint: "/api/quantum-audit/scans",
      method: "GET",
      payload: p,
      response: `HTTP ${r.status}: ${r.body.slice(0, 300)}`,
      vulnerable: hasError || hasSleep,
      evidence: hasError
        ? `Database error leaked in response: ${r.body.slice(0, 200)}`
        : hasSleep
        ? "Query caused timeout — time-based injection confirmed"
        : "No SQL error pattern detected — parameterized queries appear to be in use",
      cweId: "CWE-89",
      description:
        "SQL injection allows attackers to manipulate database queries by injecting malicious SQL syntax through user-supplied input fields.",
      recommendation:
        "Use parameterized queries (prepared statements) exclusively. Never concatenate user input into SQL strings. Drizzle ORM with parameterized queries is the correct approach already in use — confirm no raw SQL strings exist in the codebase.",
      bountyEstimate: hasError ? "$5,000–$25,000" : "N/A",
    });
  }
  return findings;
}

async function testXSS(): Promise<PenTestFinding[]> {
  const xssPayloads = [
    { label: "Basic script tag", p: '<script>alert("XSS")</script>' },
    { label: "IMG onerror", p: '<img src=x onerror=alert(1)>' },
    { label: "SVG onload", p: '<svg onload=alert(1)>' },
    { label: "JavaScript URI", p: 'javascript:alert(document.cookie)' },
    { label: "Encoded payload", p: '&lt;script&gt;alert(1)&lt;/script&gt;' },
  ];

  const findings: PenTestFinding[] = [];
  for (const { label, p } of xssPayloads) {
    const r = await probe("POST", "/api/quantum-audit/scans", {
      name: p,
      chain: "ethereum",
      scanType: "smart_contract",
    });

    const reflected = r.body.includes(p) && !r.body.includes(`"name":"${p}"`);
    const stored = r.status === 200 || r.status === 201;

    findings.push({
      id: `xss-${label.replace(/\s/g, "-").toLowerCase()}`,
      testName: `XSS — ${label}`,
      category: "Cross-Site Scripting",
      severity: reflected ? "high" : "info",
      cvssScore: reflected ? 7.4 : 0,
      endpoint: "/api/quantum-audit/scans",
      method: "POST",
      payload: p,
      response: `HTTP ${r.status}: ${r.body.slice(0, 300)}`,
      vulnerable: reflected,
      evidence: reflected
        ? `Payload reflected unescaped in response body`
        : r.status === 401 || r.status === 403
        ? "Auth required — unauthenticated XSS test blocked by auth layer"
        : "Payload not reflected — input appears to be sanitized or rejected",
      cweId: "CWE-79",
      description:
        "XSS allows attackers to inject client-side scripts into web pages viewed by other users, enabling session hijacking, credential theft, and malware delivery.",
      recommendation:
        "Sanitize all user input server-side. Use Content-Security-Policy headers. Never reflect raw user input in HTML responses.",
      bountyEstimate: reflected ? "$1,000–$10,000" : "N/A",
    });
  }
  return findings;
}

async function testAuthBypass(): Promise<PenTestFinding[]> {
  const findings: PenTestFinding[] = [];

  const tests: Array<{ name: string; path: string; headers: Record<string, string>; desc: string }> = [
    {
      name: "No auth token",
      path: "/api/quantum-audit/scans",
      headers: {},
      desc: "Access protected endpoint with no Authorization header",
    },
    {
      name: "Forged JWT (none algorithm)",
      path: "/api/quantum-audit/scans",
      headers: { Authorization: "Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiJ9." },
      desc: "JWT with 'none' algorithm — should be rejected",
    },
    {
      name: "Empty Bearer token",
      path: "/api/quantum-audit/scans",
      headers: { Authorization: "Bearer " },
      desc: "Empty bearer token — should return 401",
    },
    {
      name: "SQL in Authorization header",
      path: "/api/quantum-audit/scans",
      headers: { Authorization: "Bearer ' OR '1'='1" },
      desc: "SQL payload in auth header",
    },
    {
      name: "Admin path traversal",
      path: "/api/quantum-audit/../../../etc/passwd",
      headers: {},
      desc: "Path traversal attempt to read system files",
    },
    {
      name: "HTTP verb tampering (PUT)",
      path: "/api/quantum-audit/scans",
      headers: {},
      desc: "Unexpected HTTP verb — should be rejected or return 405",
    },
  ];

  for (const t of tests) {
    const method = t.name.includes("PUT") ? "PUT" : "GET";
    const r = await probe(method, t.path, undefined, t.headers);
    const bypassed =
      r.status === 200 &&
      !t.headers.Authorization?.startsWith("Bearer eyJ") &&
      !Object.keys(t.headers).length;
    const pathTraversal = t.path.includes("../") && r.body.includes("root:");
    const algorithmConfusion = t.name.includes("none") && r.status === 200;

    const vulnerable = bypassed || pathTraversal || algorithmConfusion;

    findings.push({
      id: `auth-${t.name.replace(/\s/g, "-").toLowerCase()}`,
      testName: `Auth Bypass — ${t.name}`,
      category: "Authentication",
      severity: vulnerable ? "critical" : r.status === 401 || r.status === 403 ? "info" : "medium",
      cvssScore: vulnerable ? 9.1 : 0,
      endpoint: t.path,
      method,
      payload: JSON.stringify(t.headers),
      response: `HTTP ${r.status}: ${r.body.slice(0, 300)}`,
      vulnerable,
      evidence: pathTraversal
        ? "Path traversal succeeded — /etc/passwd content in response"
        : algorithmConfusion
        ? "JWT 'none' algorithm accepted — auth bypass confirmed"
        : bypassed
        ? "Protected endpoint returned 200 with no credentials"
        : `HTTP ${r.status} — ${r.status === 401 || r.status === 403 ? "auth enforced correctly" : "unexpected response code"}`,
      cweId: pathTraversal ? "CWE-22" : algorithmConfusion ? "CWE-347" : "CWE-287",
      description: t.desc,
      recommendation:
        "Ensure all routes validate Clerk JWT tokens. Reject 'none' algorithm JWTs at the middleware level. Normalize paths before resolving to prevent traversal.",
      bountyEstimate: vulnerable ? "$3,000–$15,000" : "N/A",
    });
  }
  return findings;
}

async function testSecurityHeaders(): Promise<PenTestFinding[]> {
  const r = await probe("GET", "/api/health");
  const headers = r.headers;

  const requiredHeaders: Array<{
    header: string; expected: string; severity: PenTestFinding["severity"]; cwe: string; bounty: string;
  }> = [
    { header: "content-security-policy", expected: "default-src", severity: "high", cwe: "CWE-693", bounty: "$500–$2,000" },
    { header: "strict-transport-security", expected: "max-age=", severity: "medium", cwe: "CWE-319", bounty: "$200–$1,000" },
    { header: "x-frame-options", expected: "DENY", severity: "medium", cwe: "CWE-1021", bounty: "$200–$500" },
    { header: "x-content-type-options", expected: "nosniff", severity: "low", cwe: "CWE-116", bounty: "$100–$300" },
    { header: "referrer-policy", expected: "no-referrer", severity: "low", cwe: "CWE-200", bounty: "$100–$300" },
    { header: "permissions-policy", expected: "geolocation=", severity: "low", cwe: "CWE-693", bounty: "$100–$200" },
    { header: "x-powered-by", expected: "ABSENT", severity: "low", cwe: "CWE-200", bounty: "$100" },
  ];

  return requiredHeaders.map((h) => {
    const value = headers[h.header] || "";
    const present = h.expected === "ABSENT" ? !value : value.includes(h.expected.split("=")[0]);
    const vulnerable = h.expected === "ABSENT" ? !!value : !present;

    return {
      id: `header-${h.header}`,
      testName: `Security Header — ${h.header}`,
      category: "Security Headers",
      severity: vulnerable ? h.severity : "info",
      cvssScore: vulnerable ? (h.severity === "high" ? 6.5 : h.severity === "medium" ? 4.3 : 2.1) : 0,
      endpoint: "/api/health",
      method: "GET",
      payload: "N/A — header inspection",
      response: `${h.header}: ${value || "(not present)"}`,
      vulnerable,
      evidence: vulnerable
        ? h.expected === "ABSENT"
          ? `Header ${h.header} present — leaks server technology: ${value}`
          : `Header ${h.header} missing — browser protections not enforced`
        : `Header ${h.header} correctly configured: ${value}`,
      cweId: h.cwe,
      description: `Security header ${h.header} ${vulnerable ? "is missing or misconfigured" : "is correctly set"}.`,
      recommendation: h.expected === "ABSENT"
        ? `Remove the ${h.header} header to avoid leaking server information.`
        : `Add header: ${h.header}: ${h.expected}`,
      bountyEstimate: vulnerable ? h.bounty : "N/A",
    };
  });
}

async function testRateLimiting(): Promise<PenTestFinding[]> {
  const start = Date.now();
  const requests = await Promise.all(
    Array.from({ length: 20 }).map(() => probe("GET", "/api/quantum-audit/scans"))
  );
  const elapsed = Date.now() - start;
  const rateLimited = requests.some((r) => r.status === 429);
  const allSucceeded = requests.filter((r) => r.status === 200 || r.status === 401).length;

  return [
    {
      id: "rate-limit-burst",
      testName: "Rate Limiting — Burst Request Test (20 req/s)",
      category: "Rate Limiting",
      severity: !rateLimited ? "medium" : "info",
      cvssScore: !rateLimited ? 5.3 : 0,
      endpoint: "/api/quantum-audit/scans",
      method: "GET",
      payload: "20 concurrent requests",
      response: `${allSucceeded}/20 succeeded | ${elapsed}ms total | 429s: ${requests.filter((r) => r.status === 429).length}`,
      vulnerable: !rateLimited,
      evidence: rateLimited
        ? "Rate limiting is enforced — 429 responses detected"
        : `All 20 simultaneous requests completed without rate limiting. API is vulnerable to brute force and DoS attacks.`,
      cweId: "CWE-770",
      description:
        "Without rate limiting, attackers can brute-force authentication tokens, enumerate resources, or conduct denial-of-service attacks against the API.",
      recommendation:
        "Implement rate limiting middleware (e.g., express-rate-limit). Recommended: 100 req/15min per IP on public endpoints, 20 req/min on authenticated endpoints.",
      bountyEstimate: !rateLimited ? "$200–$1,000" : "N/A",
    },
  ];
}

async function testInputValidation(): Promise<PenTestFinding[]> {
  const malformedPayloads = [
    { label: "Oversized payload (1MB string)", body: { name: "A".repeat(1_000_000), chain: "ethereum", scanType: "smart_contract" } },
    { label: "Null byte injection", body: { name: "test\x00injection", chain: "ethereum", scanType: "smart_contract" } },
    { label: "Unicode overflow", body: { name: "𠜎".repeat(10000), chain: "ethereum", scanType: "smart_contract" } },
    { label: "Invalid chain value", body: { name: "test", chain: "not_a_real_chain_xyz", scanType: "smart_contract" } },
    { label: "Negative scan ID", body: null },
    { label: "Array instead of string", body: { name: ["array", "injection"], chain: "ethereum", scanType: "smart_contract" } },
    { label: "Prototype pollution", body: { "__proto__": { "admin": true }, name: "test", chain: "ethereum", scanType: "smart_contract" } },
  ];

  const findings: PenTestFinding[] = [];
  for (const { label, body } of malformedPayloads) {
    const path = label.includes("scan ID") ? "/api/quantum-audit/scans/-1" : "/api/quantum-audit/scans";
    const method = label.includes("scan ID") ? "GET" : "POST";
    const r = body ? await probe(method, path, body) : await probe(method, path);

    const crashed = r.status === 500;
    const accepted = r.status === 200 || r.status === 201;
    const protoPollutiion = label.includes("Prototype") && accepted;

    findings.push({
      id: `input-${label.replace(/\s/g, "-").toLowerCase().slice(0, 30)}`,
      testName: `Input Validation — ${label}`,
      category: "Input Validation",
      severity: crashed ? "high" : protoPollutiion ? "critical" : accepted && label.includes("Oversized") ? "medium" : "info",
      cvssScore: crashed ? 7.5 : protoPollutiion ? 9.0 : accepted && label.includes("Oversized") ? 5.0 : 0,
      endpoint: path,
      method,
      payload: body ? JSON.stringify(body).slice(0, 200) : "N/A",
      response: `HTTP ${r.status}: ${r.body.slice(0, 300)}`,
      vulnerable: crashed || protoPollutiion,
      evidence: crashed
        ? `Server returned 500 — unhandled exception on malformed input`
        : protoPollutiion
        ? "Prototype pollution payload accepted — JavaScript object prototype may be modified"
        : accepted
        ? `Payload accepted with HTTP ${r.status} — validate if input was properly sanitized`
        : `HTTP ${r.status} — input correctly rejected`,
      cweId: crashed ? "CWE-755" : protoPollutiion ? "CWE-1321" : "CWE-20",
      description: `Testing API behavior with malformed input: ${label}`,
      recommendation:
        "Validate all inputs with Zod schema before processing. Set request body size limits (express limit middleware). Strip null bytes. Freeze Object.prototype in Node.js startup.",
      bountyEstimate: crashed ? "$500–$3,000" : protoPollutiion ? "$2,000–$8,000" : "N/A",
    });
  }
  return findings;
}

async function testCORS(): Promise<PenTestFinding[]> {
  const r = await probe("OPTIONS", "/api/quantum-audit/scans", undefined, {
    Origin: "https://evil-attacker.com",
    "Access-Control-Request-Method": "GET",
  });

  const allowOrigin = r.headers["access-control-allow-origin"] || "";
  const isWildcard = allowOrigin === "*";
  const reflectsEvil = allowOrigin.includes("evil-attacker.com");
  const withCredentials = r.headers["access-control-allow-credentials"] === "true";
  const vulnerable = (isWildcard && withCredentials) || reflectsEvil;

  return [
    {
      id: "cors-origin-reflection",
      testName: "CORS — Arbitrary Origin Reflection Test",
      category: "CORS Misconfiguration",
      severity: vulnerable ? "high" : "info",
      cvssScore: vulnerable ? 8.1 : 0,
      endpoint: "/api/quantum-audit/scans",
      method: "OPTIONS",
      payload: "Origin: https://evil-attacker.com",
      response: `Access-Control-Allow-Origin: ${allowOrigin || "(not set)"} | With-Credentials: ${withCredentials}`,
      vulnerable,
      evidence: reflectsEvil
        ? "Server reflects arbitrary Origin header — any site can make authenticated requests"
        : isWildcard && withCredentials
        ? "Wildcard CORS with credentials — high severity CORS misconfiguration"
        : isWildcard
        ? "Wildcard CORS set — acceptable for public APIs but verify no credentials are exposed"
        : `Origin restricted to: ${allowOrigin || "none"}`,
      cweId: "CWE-942",
      description:
        "CORS misconfiguration allows malicious websites to make authenticated API requests on behalf of logged-in users, enabling data theft and account takeover.",
      recommendation:
        "Explicitly whitelist allowed origins. Never reflect the Origin header directly. Never combine Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true.",
      bountyEstimate: vulnerable ? "$1,000–$5,000" : "N/A",
    },
  ];
}

// ── Main Scanner ──────────────────────────────────────────────────────────────

export async function runApplicationPenTest(): Promise<PenTestReport> {
  const start = Date.now();
  const allFindings: PenTestFinding[] = [];

  const [sqli, xss, auth, headers, rate, input, cors] = await Promise.all([
    testSQLInjection(),
    testXSS(),
    testAuthBypass(),
    testSecurityHeaders(),
    testRateLimiting(),
    testInputValidation(),
    testCORS(),
  ]);

  allFindings.push(...sqli, ...xss, ...auth, ...headers, ...rate, ...input, ...cors);

  const vulnerable = allFindings.filter((f) => f.vulnerable);
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of allFindings) summary[f.severity]++;

  return {
    target: BASE_URL,
    scanDate: new Date().toISOString(),
    duration: Date.now() - start,
    totalTests: allFindings.length,
    vulnerableCount: vulnerable.length,
    findings: allFindings,
    summary,
  };
}
