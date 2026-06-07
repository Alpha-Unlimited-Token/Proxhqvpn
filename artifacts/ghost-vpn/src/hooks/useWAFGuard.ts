// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// useWAFGuard — Client-side WAF input inspector.
// Detects injection/XSS/command patterns in form inputs in real-time,
// bridges to the backend WAF analyzer, and optionally reports to GhostTrap.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface WAFThreat {
  type: string;
  vector: string;
  payload: string;
  anomalyScore: number;
  timestamp: string;
}

// ── Client-side pattern registry (mirrors backend but runs instantly, no round-trip) ──
const CLIENT_PATTERNS: Array<{ re: RegExp; type: string; vector: string; score: number }> = [
  // SQL Injection
  { re: /union\s+(?:all\s+)?select/i,           type: "sql_injection",   vector: "UNION SELECT",              score: 40 },
  { re: /'\s*(?:or|and)\s+['"]?\d/i,            type: "sql_injection",   vector: "Boolean injection",         score: 35 },
  { re: /;\s*(?:drop|delete|insert|update)\s/i, type: "sql_injection",   vector: "Destructive SQL",           score: 45 },
  { re: /\bsleep\s*\(\d/i,                      type: "sql_injection",   vector: "Time-based blind (SLEEP)",  score: 40 },
  { re: /waitfor\s+delay/i,                     type: "sql_injection",   vector: "WAITFOR DELAY (MSSQL)",     score: 40 },
  { re: /information_schema\s*\.\s*tables/i,    type: "sql_injection",   vector: "Schema enumeration",        score: 35 },
  { re: /xp_cmdshell/i,                         type: "sql_injection",   vector: "xp_cmdshell RCE",           score: 50 },
  { re: /load_file\s*\(/i,                      type: "sql_injection",   vector: "LOAD_FILE()",               score: 40 },
  // XSS
  { re: /<script[\s>]/i,                        type: "xss",             vector: "<script> tag",              score: 35 },
  { re: /javascript\s*:/i,                      type: "xss",             vector: "javascript: URI",           score: 35 },
  { re: /on\w+\s*=/i,                           type: "xss",             vector: "Event handler (on*=)",      score: 30 },
  { re: /eval\s*\(/i,                           type: "xss",             vector: "eval() call",               score: 30 },
  { re: /document\.cookie/i,                   type: "xss",             vector: "Cookie theft",              score: 35 },
  { re: /<svg[^>]*on\w+/i,                     type: "xss",             vector: "SVG event injection",       score: 35 },
  // Command Injection
  { re: /;\s*(?:ls|cat|id|whoami|wget|curl|bash|sh)\b/i, type: "cmd_injection", vector: "Shell chaining",   score: 45 },
  { re: /\|\s*(?:ls|cat|id|whoami|bash|sh)\b/i,          type: "cmd_injection", vector: "Pipe injection",    score: 45 },
  { re: /\$\([^)]+\)/,                                    type: "cmd_injection", vector: "Command sub $()",  score: 40 },
  { re: /`[^`]+`/,                                        type: "cmd_injection", vector: "Backtick injection",score: 40 },
  // Path Traversal
  { re: /\.\.(\/|%2f)/i,                       type: "path_traversal",  vector: "Directory traversal",      score: 30 },
  { re: /\/etc\/passwd/i,                       type: "path_traversal",  vector: "/etc/passwd",              score: 40 },
  { re: /\/proc\/self/i,                        type: "path_traversal",  vector: "/proc/self",               score: 35 },
  // SSTI
  { re: /\{\{.*\}\}|\$\{.*\}/,                 type: "ssti",            vector: "Template syntax",           score: 25 },
  { re: /__class__|__mro__|__import__/,         type: "ssti",            vector: "Python class traversal",    score: 45 },
  // Log4Shell
  { re: /\$\{jndi:/i,                          type: "log4shell",       vector: "JNDI injection",            score: 50 },
  // SSRF
  { re: /169\.254\.169\.254/,                  type: "ssrf",            vector: "AWS metadata SSRF",         score: 50 },
  { re: /gopher:\/\/|dict:\/\//i,              type: "ssrf",            vector: "Gopher/Dict SSRF",          score: 45 },
  // Prototype Pollution
  { re: /__proto__|constructor\[prototype\]/,  type: "prototype_poll",  vector: "__proto__ injection",       score: 30 },
];

function detectClientSide(value: string): { type: string; vector: string; score: number } | null {
  if (!value || value.length < 3) return null;
  for (const p of CLIENT_PATTERNS) {
    if (p.re.test(value)) return { type: p.type, vector: p.vector, score: p.score };
  }
  return null;
}

// ── Throttle: only report same IP/pattern once every 10s to backend ───────────
const reportedCache = new Map<string, number>();
function shouldReport(key: string): boolean {
  const now = Date.now();
  const last = reportedCache.get(key) ?? 0;
  if (now - last > 10000) { reportedCache.set(key, now); return true; }
  return false;
}

async function reportToBackend(value: string, fieldName: string): Promise<WAFThreat | null> {
  try {
    const res = await fetch("/api/waf/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "POST",
        path: `/frontend-input/${fieldName}`,
        headers: {},
        body: value.substring(0, 2000),
        sourceIp: "frontend",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      blocked: boolean; anomalyScore: number; threatLevel: string;
      hits: Array<{ name: string; attackType: string; severity: string }>;
    };
    if (data.hits.length > 0) {
      // Also create a connection queue entry for admin review
      fetch("/api/firewall/connection-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: "frontend-input",
          detectedFrom: "waf",
          attackType: data.hits[0]?.attackType ?? "unknown",
          anomalyScore: data.anomalyScore,
          payload: value.substring(0, 500),
          reason: `Frontend WAF: ${data.hits[0]?.name} in field "${fieldName}"`,
        }),
      }).catch(() => {});
      return {
        type:         data.hits[0]?.attackType ?? "unknown",
        vector:       data.hits[0]?.name ?? "unknown",
        payload:      value.substring(0, 200),
        anomalyScore: data.anomalyScore,
        timestamp:    new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface UseWAFGuardReturn {
  checkInput:   (value: string, fieldName?: string) => void;
  lastThreat:   WAFThreat | null;
  threatCount:  number;
  isMonitoring: boolean;
  clearThreats: () => void;
}

export function useWAFGuard(opts?: { silent?: boolean; autoReport?: boolean }): UseWAFGuardReturn {
  const [lastThreat, setLastThreat]   = useState<WAFThreat | null>(null);
  const [threatCount, setThreatCount] = useState(0);
  const reportTimeout                 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const checkInput = useCallback((value: string, fieldName = "input") => {
    if (!value) return;

    // 1. Instant client-side check (no latency)
    const clientHit = detectClientSide(value);
    if (clientHit) {
      const threat: WAFThreat = {
        type:         clientHit.type,
        vector:       clientHit.vector,
        payload:      value.substring(0, 200),
        anomalyScore: clientHit.score,
        timestamp:    new Date().toISOString(),
      };
      setLastThreat(threat);
      setThreatCount(c => c + 1);

      if (!opts?.silent) {
        const label = clientHit.type.replace(/_/g, " ").toUpperCase();
        toast.error(`⚠ Attack pattern intercepted: ${label}`, {
          description: `Vector: ${clientHit.vector} · Score: ${clientHit.score}`,
          duration: 6000,
        });
      }

      // 2. Async backend report (debounced 600ms to avoid flooding)
      if (opts?.autoReport !== false) {
        clearTimeout(reportTimeout.current);
        const cacheKey = `${clientHit.type}:${value.substring(0, 30)}`;
        reportTimeout.current = setTimeout(async () => {
          if (shouldReport(cacheKey)) {
            await reportToBackend(value, fieldName);
          }
        }, 600);
      }
    }
  }, [opts?.silent, opts?.autoReport]);

  const clearThreats = useCallback((): void => {
    setLastThreat(null);
    setThreatCount(0);
  }, []);

  return { checkInput, lastThreat, threatCount, isMonitoring: true, clearThreats };
}
