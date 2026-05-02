// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const router = Router();

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface Endpoint {
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
  parameters?: any[];
  requestBody?: any;
  security?: any[];
  tags?: string[];
}

interface TestResult {
  testId: string;
  endpoint: string;
  method: string;
  testName: string;
  severity: Severity;
  passed: boolean;
  status?: number;
  detail: string;
  request?: { url: string; headers: Record<string, string>; body?: string };
  response?: { status: number; headers: Record<string, string>; snippet: string };
}

interface Session {
  id: string;
  baseUrl: string;
  specTitle: string;
  endpoints: Endpoint[];
  results: TestResult[];
  startedAt: string;
  completedAt?: string;
  status: "pending" | "running" | "done" | "error";
}

const sessions = new Map<string, Session>();

function extractEndpoints(spec: any): Endpoint[] {
  const paths = spec.paths || {};
  const endpoints: Endpoint[] = [];
  for (const path of Object.keys(paths)) {
    const pathItem = paths[path];
    const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
    for (const method of methods) {
      if (pathItem[method]) {
        const op = pathItem[method];
        endpoints.push({
          method: method.toUpperCase(), path,
          summary: op.summary, operationId: op.operationId,
          parameters: op.parameters, requestBody: op.requestBody,
          security: op.security, tags: op.tags,
        });
      }
    }
  }
  return endpoints.slice(0, 30);
}

async function fetch(urlStr: string, opts: { method: string; headers?: Record<string, string>; body?: string; timeout?: number }): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const parsed = new URL(urlStr);
  const isHttps = parsed.protocol === "https:";
  const port = parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80);

  return new Promise((resolve, reject) => {
    const reqOpts: http.RequestOptions = {
      hostname: parsed.hostname, port,
      path: parsed.pathname + parsed.search,
      method: opts.method,
      headers: { "User-Agent": "ProxhqVPN-ApiTester/1.0", ...(opts.headers || {}) },
      timeout: opts.timeout || 8000,
    };
    const lib = isHttps ? https : http;
    const req = (lib as any).request({ ...reqOpts, rejectUnauthorized: false }, (res: any) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        const resHeaders: Record<string, string> = {};
        Object.entries(res.headers).forEach(([k, v]) => { resHeaders[k] = String(v); });
        resolve({ status: res.statusCode, headers: resHeaders, body: Buffer.concat(chunks).toString("utf8").slice(0, 2000) });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function runTests(session: Session): Promise<void> {
  session.status = "running";
  const { baseUrl, endpoints } = session;
  const results: TestResult[] = [];

  for (const ep of endpoints) {
    const urlPath = ep.path.replace(/\{[^}]+\}/g, "1");
    const url = `${baseUrl}${urlPath}`;

    // 1. Auth bypass — try without Authorization
    try {
      const r = await fetch(url, { method: ep.method, headers: { "Content-Type": "application/json" }, body: ep.method !== "GET" ? "{}" : undefined });
      const noAuth = r.status !== 401 && r.status !== 403;
      results.push({
        testId: `${ep.method}-${ep.path}-auth`,
        endpoint: ep.path, method: ep.method,
        testName: "Authentication Bypass",
        severity: "CRITICAL",
        passed: !noAuth,
        status: r.status,
        detail: noAuth
          ? `Endpoint responded ${r.status} without Authorization — may not require authentication.`
          : `Correctly returned ${r.status} without credentials.`,
        request: { url, headers: { "Content-Type": "application/json" } },
        response: { status: r.status, headers: r.headers, snippet: r.body.slice(0, 300) },
      });
    } catch { /* skip */ }

    // 2. CORS misconfiguration
    try {
      const r = await fetch(url, { method: ep.method, headers: { "Origin": "https://evil.com", "Content-Type": "application/json" }, body: ep.method !== "GET" ? "{}" : undefined });
      const acOrigin = r.headers["access-control-allow-origin"] || "";
      const corsVuln = acOrigin === "*" || acOrigin === "https://evil.com";
      results.push({
        testId: `${ep.method}-${ep.path}-cors`,
        endpoint: ep.path, method: ep.method,
        testName: "CORS Misconfiguration",
        severity: "HIGH",
        passed: !corsVuln,
        status: r.status,
        detail: corsVuln
          ? `Access-Control-Allow-Origin: ${acOrigin} — arbitrary origins accepted.`
          : "CORS appears restricted.",
        request: { url, headers: { "Origin": "https://evil.com" } },
        response: { status: r.status, headers: r.headers, snippet: r.body.slice(0, 200) },
      });
    } catch { /* skip */ }

    // 3. Verbose error / stack trace on bad input
    if (ep.method !== "GET") {
      try {
        const r = await fetch(url, { method: ep.method, headers: { "Content-Type": "application/json" }, body: '{"id":"<FUZZ>","__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}}}' });
        const verbose = /stack|traceback|exception|syntaxerror|at Object\.|at Array\./i.test(r.body);
        results.push({
          testId: `${ep.method}-${ep.path}-verbose`,
          endpoint: ep.path, method: ep.method,
          testName: "Verbose Error / Stack Trace Leak",
          severity: "MEDIUM",
          passed: !verbose,
          status: r.status,
          detail: verbose
            ? "Server returned a stack trace or internal error detail — leaks implementation info."
            : "No verbose error detected.",
          request: { url, headers: { "Content-Type": "application/json" }, body: "malformed payload" },
          response: { status: r.status, headers: r.headers, snippet: r.body.slice(0, 300) },
        });
      } catch { /* skip */ }
    }

    // 4. HTTP → HTTPS redirect check
    if (url.startsWith("https://")) {
      const httpUrl = url.replace("https://", "http://");
      try {
        const r = await fetch(httpUrl, { method: "GET", headers: {} });
        const redirected = r.status >= 300 && r.status < 400 && (r.headers["location"] || "").startsWith("https://");
        results.push({
          testId: `${ep.method}-${ep.path}-https-redirect`,
          endpoint: ep.path, method: ep.method,
          testName: "HTTP to HTTPS Redirect",
          severity: "MEDIUM",
          passed: redirected,
          status: r.status,
          detail: redirected
            ? "HTTP correctly redirects to HTTPS."
            : `HTTP returned ${r.status} without redirecting to HTTPS.`,
          request: { url: httpUrl, headers: {} },
          response: { status: r.status, headers: r.headers, snippet: r.body.slice(0, 100) },
        });
      } catch { /* skip */ }
    }

    // 5. Security headers check (only once per base)
    if (ep.path === endpoints[0].path && ep.method === endpoints[0].method) {
      try {
        const r = await fetch(url, { method: "GET", headers: {} });
        const missing: string[] = [];
        const secHeaders = ["x-frame-options", "x-content-type-options", "content-security-policy", "strict-transport-security"];
        secHeaders.forEach(h => { if (!r.headers[h]) missing.push(h); });
        results.push({
          testId: `global-security-headers`,
          endpoint: "/", method: "GET",
          testName: "Security Headers Audit",
          severity: "MEDIUM",
          passed: missing.length === 0,
          status: r.status,
          detail: missing.length > 0
            ? `Missing headers: ${missing.join(", ")}`
            : "All key security headers present.",
          response: { status: r.status, headers: r.headers, snippet: "" },
        });
      } catch { /* skip */ }
    }
  }

  session.results = results;
  session.completedAt = new Date().toISOString();
  session.status = "done";
}

// Parse and store spec
router.post("/parse", async (req, res) => {
  const { spec, baseUrl } = req.body as { spec?: any; baseUrl?: string };
  if (!spec || typeof spec !== "object") return res.status(400).json({ error: "spec object required" });
  if (!baseUrl) return res.status(400).json({ error: "baseUrl required (e.g. https://api.example.com)" });

  const endpoints = extractEndpoints(spec);
  const title = spec.info?.title || "Unknown API";
  const id = crypto.randomUUID();

  const session: Session = {
    id, baseUrl, specTitle: title, endpoints,
    results: [], startedAt: new Date().toISOString(), status: "pending",
  };
  sessions.set(id, session);

  res.json({ sessionId: id, title, endpointCount: endpoints.length, endpoints });
});

// Start tests
router.post("/run/:sessionId", async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  if (session.status === "running") return res.json({ message: "already running" });

  res.json({ message: "started", sessionId: session.id });
  runTests(session).catch(() => { session.status = "error"; });
});

// Poll results
router.get("/results/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "not found" });
  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0, pass: 0, fail: 0 };
  session.results.forEach(r => {
    if (r.passed) summary.pass++;
    else { summary.fail++; (summary as any)[r.severity]++; }
  });
  res.json({ ...session, summary });
});

export default router;
