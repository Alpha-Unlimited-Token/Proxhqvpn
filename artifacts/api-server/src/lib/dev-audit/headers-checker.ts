/**
 * HTTP Security Headers Checker
 * Fetches a real URL from the server and reports exactly what security
 * headers are present, missing, or misconfigured — the same analysis
 * an attacker runs before targeting a web application.
 */

export type HeaderSeverity = "critical" | "high" | "medium" | "low" | "pass";

export interface HeaderResult {
  header: string;
  present: boolean;
  value?: string;
  severity: HeaderSeverity;
  title: string;
  description: string;
  attackEnabled: string;
  recommendation: string;
  score: number;
}

export interface HeadersScanResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  tlsEnabled: boolean;
  serverBanner?: string;
  poweredBy?: string;
  responseTimeMs: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  score: number;
  headers: HeaderResult[];
  corsAnalysis?: {
    allowOrigin?: string;
    allowCredentials?: string;
    allowMethods?: string;
    wildcardWithCredentials: boolean;
    risk: string;
  };
  cookieAnalysis: Array<{
    name: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite?: string;
    risk: string;
  }>;
  criticalMissing: string[];
}

interface HeaderDef {
  header: string;
  title: string;
  description: string;
  attackEnabled: string;
  recommendation: string;
  missingSeverity: HeaderSeverity;
  missingScore: number;
  presentScore: number;
  validate?: (value: string) => { ok: boolean; note?: string };
}

const HEADER_DEFS: HeaderDef[] = [
  {
    header: "strict-transport-security",
    title: "HTTP Strict Transport Security (HSTS)",
    description: "Instructs browsers to only connect via HTTPS, even if the user types http://.",
    attackEnabled: "Without HSTS, an attacker can perform an SSL stripping attack — downgrade HTTPS to HTTP, intercept all traffic including session tokens, wallet connection approvals, and transaction data.",
    recommendation: "Set: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    missingSeverity: "critical",
    missingScore: -25,
    presentScore: 20,
    validate: (v) => ({
      ok: v.includes("max-age=") && parseInt(v.match(/max-age=(\d+)/)?.[1] ?? "0") >= 31536000,
      note: parseInt(v.match(/max-age=(\d+)/)?.[1] ?? "0") < 31536000 ? "max-age should be at least 31536000 (1 year)" : undefined,
    }),
  },
  {
    header: "content-security-policy",
    title: "Content Security Policy (CSP)",
    description: "Restricts which scripts, styles, and resources can execute on the page.",
    attackEnabled: "Without CSP, a single XSS vulnerability lets attackers inject scripts that silently replace wallet addresses on-screen, intercept transaction confirmations, or steal session cookies.",
    recommendation: "Set a strict CSP: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'",
    missingSeverity: "critical",
    missingScore: -25,
    presentScore: 20,
    validate: (v) => ({
      ok: !v.includes("unsafe-eval") && !v.includes("'*'"),
      note: v.includes("unsafe-eval") ? "unsafe-eval undermines XSS protection" : v.includes("'*'") ? "Wildcard (*) in CSP defeats its purpose" : undefined,
    }),
  },
  {
    header: "x-frame-options",
    title: "X-Frame-Options",
    description: "Prevents the page from being embedded in an iframe on an attacker's site.",
    attackEnabled: "Without this header, clickjacking attacks can overlay a transparent iframe of your dApp over a malicious page. Users think they're clicking on something innocuous but are actually signing transactions in your wallet UI.",
    recommendation: "Set: X-Frame-Options: DENY (or SAMEORIGIN if you need iframe embedding on your own domain)",
    missingSeverity: "high",
    missingScore: -15,
    presentScore: 10,
    validate: (v) => ({
      ok: v.toUpperCase() === "DENY" || v.toUpperCase().startsWith("SAMEORIGIN"),
      note: v.toUpperCase() === "ALLOWALL" ? "ALLOWALL is equivalent to no protection" : undefined,
    }),
  },
  {
    header: "x-content-type-options",
    title: "X-Content-Type-Options",
    description: "Prevents browsers from MIME-sniffing a response away from the declared content type.",
    attackEnabled: "Without nosniff, an attacker can upload a file with a misleading content type (e.g. a .png that is actually JavaScript). The browser sniffs the content and executes it as a script.",
    recommendation: "Set: X-Content-Type-Options: nosniff",
    missingSeverity: "medium",
    missingScore: -10,
    presentScore: 8,
    validate: (v) => ({ ok: v.toLowerCase() === "nosniff" }),
  },
  {
    header: "referrer-policy",
    title: "Referrer Policy",
    description: "Controls how much referrer information is sent with requests.",
    attackEnabled: "Without a restrictive referrer policy, URLs with sensitive parameters (wallet addresses, tokens, nonces) are leaked in the Referer header to every third-party resource loaded on the page.",
    recommendation: "Set: Referrer-Policy: no-referrer or strict-origin-when-cross-origin",
    missingSeverity: "medium",
    missingScore: -8,
    presentScore: 6,
    validate: (v) => ({
      ok: ["no-referrer", "strict-origin", "strict-origin-when-cross-origin"].includes(v.toLowerCase()),
      note: v.toLowerCase() === "unsafe-url" ? "unsafe-url leaks full URLs to all third parties" : undefined,
    }),
  },
  {
    header: "permissions-policy",
    title: "Permissions Policy",
    description: "Restricts which browser features (camera, microphone, clipboard, etc.) the page can use.",
    attackEnabled: "Without this header, malicious scripts injected via XSS can silently access the clipboard (capturing copied wallet addresses/keys), camera, or geolocation.",
    recommendation: "Set: Permissions-Policy: clipboard-read=(), clipboard-write=(self), camera=(), microphone=(), geolocation=()",
    missingSeverity: "medium",
    missingScore: -8,
    presentScore: 6,
  },
  {
    header: "cross-origin-opener-policy",
    title: "Cross-Origin Opener Policy (COOP)",
    description: "Isolates the browsing context from cross-origin windows.",
    attackEnabled: "Without COOP, a malicious site opened from your dApp (e.g. via window.open) retains a reference to your window object and can read/manipulate your page.",
    recommendation: "Set: Cross-Origin-Opener-Policy: same-origin",
    missingSeverity: "medium",
    missingScore: -6,
    presentScore: 5,
  },
  {
    header: "cross-origin-embedder-policy",
    title: "Cross-Origin Embedder Policy (COEP)",
    description: "Required to enable powerful features (SharedArrayBuffer) in a cross-origin-isolated context.",
    attackEnabled: "Without COEP, Spectre-class attacks can read memory across origin boundaries, potentially leaking private key material from memory.",
    recommendation: "Set: Cross-Origin-Embedder-Policy: require-corp",
    missingSeverity: "low",
    missingScore: -4,
    presentScore: 4,
  },
  {
    header: "cross-origin-resource-policy",
    title: "Cross-Origin Resource Policy (CORP)",
    description: "Prevents other origins from reading this resource via a browser request.",
    attackEnabled: "Without CORP, resources (scripts, data) from your server can be loaded by malicious third-party pages, enabling side-channel attacks.",
    recommendation: "Set: Cross-Origin-Resource-Policy: same-origin",
    missingSeverity: "low",
    missingScore: -3,
    presentScore: 3,
  },
  {
    header: "cache-control",
    title: "Cache-Control on Sensitive Endpoints",
    description: "Controls how responses are cached by browsers and intermediaries.",
    attackEnabled: "Sensitive API responses cached by the browser can be read by subsequent pages in the same session, or by a shared computer's next user.",
    recommendation: "Set: Cache-Control: no-store, no-cache on all authenticated API endpoints",
    missingSeverity: "low",
    missingScore: -3,
    presentScore: 3,
  },
];

function gradeFromScore(score: number): HeadersScanResult["grade"] {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  if (score >= 30) return "D";
  return "F";
}

export async function checkSecurityHeaders(targetUrl: string): Promise<HeadersScanResult> {
  const start = Date.now();
  let normalizedUrl = targetUrl.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }
  const tlsEnabled = normalizedUrl.startsWith("https://");

  const resp = await fetch(normalizedUrl, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "QuantumAudit-SecurityScanner/1.0 (Security Audit; Contact: security@quantumaudit.io)",
    },
  });

  const responseTimeMs = Date.now() - start;
  const finalUrl = resp.url;
  const statusCode = resp.status;
  const serverBanner = resp.headers.get("server") ?? undefined;
  const poweredBy = resp.headers.get("x-powered-by") ?? undefined;

  const headerResults: HeaderResult[] = [];
  let baseScore = 50;

  for (const def of HEADER_DEFS) {
    const value = resp.headers.get(def.header) ?? undefined;
    const present = !!value;
    let severity: HeaderSeverity = present ? "pass" : def.missingSeverity;
    let note: string | undefined;

    if (present && def.validate && value) {
      const validation = def.validate(value);
      if (!validation.ok) {
        severity = def.missingSeverity === "critical" ? "high" : def.missingSeverity;
        note = validation.note;
      }
    }

    baseScore += present ? def.presentScore : def.missingScore;

    headerResults.push({
      header: def.header,
      present,
      value: value ? (note ? `${value} ⚠ ${note}` : value) : undefined,
      severity,
      title: def.title,
      description: def.description,
      attackEnabled: def.attackEnabled,
      recommendation: def.recommendation,
      score: present ? def.presentScore : def.missingScore,
    });
  }

  // CORS analysis
  const allowOrigin = resp.headers.get("access-control-allow-origin") ?? undefined;
  const allowCredentials = resp.headers.get("access-control-allow-credentials") ?? undefined;
  const allowMethods = resp.headers.get("access-control-allow-methods") ?? undefined;
  const wildcardWithCredentials = allowOrigin === "*" && allowCredentials === "true";
  let corsAnalysis: HeadersScanResult["corsAnalysis"] | undefined;
  if (allowOrigin) {
    let corsRisk = "No CORS risk detected";
    if (wildcardWithCredentials) {
      corsRisk = "CRITICAL: Wildcard CORS with credentials=true allows any website to make authenticated requests as the user.";
      baseScore -= 20;
    } else if (allowOrigin === "*") {
      corsRisk = "HIGH: Wildcard CORS allows any origin to read responses — avoid for authenticated endpoints.";
      baseScore -= 10;
    }
    corsAnalysis = { allowOrigin, allowCredentials: allowCredentials ?? undefined, allowMethods: allowMethods ?? undefined, wildcardWithCredentials, risk: corsRisk };
  }

  // Cookie analysis
  const cookieAnalysis: HeadersScanResult["cookieAnalysis"] = [];
  const setCookieHeaders = resp.headers.getSetCookie?.() ?? [];
  for (const cookieHeader of setCookieHeaders) {
    const name = cookieHeader.split("=")[0] ?? "unknown";
    const secure = /;\s*secure/i.test(cookieHeader);
    const httpOnly = /;\s*httponly/i.test(cookieHeader);
    const sameSiteMatch = cookieHeader.match(/;\s*samesite=([^;]+)/i);
    const sameSite = sameSiteMatch?.[1]?.trim();
    let risk = "";
    if (!secure) risk += "Missing Secure flag — cookie transmitted over HTTP. ";
    if (!httpOnly) risk += "Missing HttpOnly flag — accessible to JavaScript (XSS theft). ";
    if (!sameSite || sameSite.toLowerCase() === "none") risk += "Missing/None SameSite — CSRF attacks possible. ";
    cookieAnalysis.push({ name, secure, httpOnly, sameSite, risk: risk || "No issues detected" });
  }

  if (!tlsEnabled) baseScore -= 20;

  const clampedScore = Math.max(0, Math.min(100, baseScore));
  const criticalMissing = headerResults.filter(h => !h.present && h.severity === "critical").map(h => h.title);
  if (!tlsEnabled) criticalMissing.push("HTTPS/TLS not enabled — all data transmitted in plaintext");
  if (wildcardWithCredentials) criticalMissing.push("CORS wildcard with credentials=true — CRITICAL misconfiguration");

  return {
    url: targetUrl,
    finalUrl,
    statusCode,
    tlsEnabled,
    serverBanner,
    poweredBy,
    responseTimeMs,
    grade: gradeFromScore(clampedScore),
    score: clampedScore,
    headers: headerResults,
    corsAnalysis,
    cookieAnalysis,
    criticalMissing,
  };
}
