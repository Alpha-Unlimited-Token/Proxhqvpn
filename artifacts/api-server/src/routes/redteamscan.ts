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

// ─── Scan Endpoint ────────────────────────────────────────────────────────────

const ScanSchema = z.object({
  url: z.string().url(),
  modules: z.array(z.enum(["keylogger", "credentials", "crypto", "c2", "disclosure", "ui", "tracking", "waf"])).optional(),
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

export default router;
