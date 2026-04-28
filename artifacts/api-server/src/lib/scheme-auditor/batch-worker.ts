/**
 * Autonomous Batch Scan Worker
 * ─────────────────────────────
 * Runs as a background loop on the API server.
 * Picks up pending batch jobs, processes targets in chunks, stores results
 * in the database, and auto-generates full ProxHQ reports on completion.
 *
 * Access: HEAD ADMIN ONLY.  Never exposed to other users.
 */

import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { batchScanJobsTable, batchScanResultsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { adaptiveScan } from "./adaptive-scan";
import { detectChain } from "./chain-detector";
import { logger } from "../logger";

// ── Constants ────────────────────────────────────────────────────────────────
const REPORTS_ROOT   = path.join(process.cwd(), "..", "..", "proxhq-reports");
const JOBS_DIR       = path.join(REPORTS_ROOT, "jobs");
const REPORTS_DIR    = path.join(REPORTS_ROOT, "reports");
const CHUNK_SIZE     = 3;          // targets per processing tick
const CONCURRENCY    = 1;          // serial within a chunk to avoid rate limiting
const POLL_INTERVAL  = 8_000;      // ms between worker polls
const SCAN_TIMEOUT   = 5 * 60_000; // 5 min max per single target

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDirs() {
  fs.mkdirSync(JOBS_DIR,    { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

async function runConcurrent<T>(
  items: string[],
  concurrency: number,
  fn: (item: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// Extract private-key-related fields from any raw scan result
function extractKeyMaterial(raw: unknown): {
  recoveredPrivateKey: string | null;
  recoveredNonceK: string | null;
  sharedRValue: string | null;
} {
  const none = { recoveredPrivateKey: null, recoveredNonceK: null, sharedRValue: null };
  if (!raw || typeof raw !== "object") return none;
  const r = raw as Record<string, unknown>;

  // ── New WalletScanResult format ──
  // nonceReusePairs[].recovery.{ privateKey, nonceK } + nonceReusePairs[].sharedR
  const pairs = (r.nonceReusePairs ?? []) as Array<Record<string, unknown>>;
  for (const pair of pairs) {
    const rec = pair.recovery as Record<string, unknown> | undefined;
    if (rec?.success && rec?.privateKey) {
      return {
        recoveredPrivateKey: String(rec.privateKey),
        recoveredNonceK:     rec.nonceK ? String(rec.nonceK) : null,
        sharedRValue:        pair.sharedR ? String(pair.sharedR) : null,
      };
    }
  }

  // ── Legacy flat top-level fields ──
  if (r.privateKey || r.recoveredPrivateKey) {
    return {
      recoveredPrivateKey: String(r.privateKey ?? r.recoveredPrivateKey),
      recoveredNonceK:     r.nonceK ? String(r.nonceK) : null,
      sharedRValue:        r.sharedR ?? r.r ? String(r.sharedR ?? r.r) : null,
    };
  }

  // ── Legacy reuseDetected format ──
  const legacyPairs = (r.reuseDetected ?? []) as Array<Record<string, unknown>>;
  for (const pair of legacyPairs) {
    const rec = pair.recovery as Record<string, unknown> | undefined;
    if (rec?.privateKey || pair.recoveredPrivateKey) {
      return {
        recoveredPrivateKey: String(rec?.privateKey ?? pair.recoveredPrivateKey),
        recoveredNonceK:     rec?.nonceK ? String(rec.nonceK) : null,
        sharedRValue:        pair.sharedR ? String(pair.sharedR) : null,
      };
    }
  }

  return none;
}

// ── Report Generation ────────────────────────────────────────────────────────
async function generateReport(jobId: number, jobName: string, sourceName: string | null) {
  ensureDirs();

  // Pull all results from DB
  const results = await db
    .select()
    .from(batchScanResultsTable)
    .where(eq(batchScanResultsTable.jobId, jobId));

  const ts        = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName  = (jobName + "-" + ts).replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir       = path.join(REPORTS_DIR, safeName);
  fs.mkdirSync(dir, { recursive: true });

  const vulnerable = results.filter(r => r.hasVulnerability);
  const errors     = results.filter(r => r.scanError);
  const clean      = results.filter(r => !r.hasVulnerability && !r.scanError);

  // ── 1. Human-readable report (summary.txt) ──────────────────────────────
  const lines: string[] = [
    "=".repeat(72),
    "  PROXHQ VPN — CRYPTOGRAPHIC SECURITY SCAN REPORT",
    `  Job: ${jobName}`,
    `  Source: ${sourceName ?? "manual input"}`,
    `  Generated: ${new Date().toISOString()}`,
    "  CLASSIFICATION: CONFIDENTIAL — HEAD ADMIN EYES ONLY",
    "=".repeat(72),
    "",
    "EXECUTIVE SUMMARY",
    "-".repeat(40),
    `  Total Targets Scanned : ${results.length}`,
    `  Vulnerable            : ${vulnerable.length}`,
    `  Clean                 : ${clean.length}`,
    `  Errors                : ${errors.length}`,
    "",
  ];

  if (vulnerable.length === 0) {
    lines.push("  ✓ NO VULNERABILITIES FOUND — All targets appear cryptographically sound.", "");
  } else {
    lines.push(
      `  ⚠  ${vulnerable.length} VULNERABILITY INSTANCE(S) DETECTED`,
      "     See FINDINGS section below for full details including recovered key material.",
      "",
    );
  }

  // ── 2. Findings with private key material ───────────────────────────────
  if (vulnerable.length > 0) {
    lines.push("=".repeat(72));
    lines.push("FINDINGS — CRITICAL VULNERABILITIES");
    lines.push("=".repeat(72));
    lines.push("");

    for (let i = 0; i < vulnerable.length; i++) {
      const v   = vulnerable[i];
      const raw = v.rawResult as Record<string, unknown> | null;

      lines.push(`Finding #${i + 1}`);
      lines.push("-".repeat(40));
      lines.push(`  TARGET              : ${v.target}`);
      lines.push(`  CHAIN               : ${v.displayName ?? v.detectedChain ?? "Unknown"}`);
      lines.push(`  SIGNATURE SCHEME    : ${v.schemeLabel ?? "Unknown"}`);
      lines.push(`  VULNERABILITY COUNT : ${v.vulnerabilityCount}`);
      lines.push(`  SCAN TIME           : ${v.execMs}ms`);
      lines.push(`  SCANNED AT          : ${v.scannedAt?.toISOString()}`);
      lines.push("");

      if (v.recoveredPrivateKey) {
        lines.push("  ⚠  PRIVATE KEY SUCCESSFULLY RECOVERED ⚠");
        lines.push(`     PRIVATE KEY (hex) : ${v.recoveredPrivateKey}`);
        if (v.recoveredNonceK) {
          lines.push(`     NONCE k (hex)     : ${v.recoveredNonceK}`);
        }
        if (v.sharedRValue) {
          lines.push(`     Shared R value    : ${v.sharedRValue}`);
        }
        lines.push("");
        lines.push("  Mathematical basis:");
        lines.push("     k = (s1 - s2) * modInverse(z1 - z2, n) mod n");
        lines.push("     d = (s1*k - z1) * modInverse(r, n) mod n");
        lines.push("     Private key d derived from reused nonce k across two transactions.");
        lines.push("");
      }

      // Nonce reuse pairs
      const pairs = (raw?.nonceReusePairs ?? raw?.reuseDetected ?? []) as Array<Record<string, unknown>>;
      if (pairs.length > 0) {
        lines.push("  Nonce Reuse / Key Image Pairs:");
        for (const pair of pairs) {
          const rec = pair.recovery as Record<string, unknown> | undefined;
          lines.push(`    • Shared R / Key Image : ${pair.sharedR ?? pair.keyImage ?? pair.r ?? "N/A"}`);
          if (pair.tx1 ?? pair.txHash1) lines.push(`      TX 1: ${pair.tx1 ?? pair.txHash1}`);
          if (pair.tx2 ?? pair.txHash2) lines.push(`      TX 2: ${pair.tx2 ?? pair.txHash2}`);
          if (rec?.privateKey) lines.push(`      Recovered Key: ${rec.privateKey}`);
          if (rec?.addressMatches !== undefined) lines.push(`      Address matches derived key: ${rec.addressMatches}`);
        }
        lines.push("");
      }

      lines.push("=".repeat(72));
      lines.push("");
    }
  }

  // ── 3. Errors section ───────────────────────────────────────────────────
  if (errors.length > 0) {
    lines.push("SCAN ERRORS");
    lines.push("-".repeat(40));
    for (const e of errors) {
      lines.push(`  ${e.target}`);
      lines.push(`    Error: ${e.scanError}`);
    }
    lines.push("");
  }

  lines.push("END OF REPORT");
  lines.push("=".repeat(72));

  fs.writeFileSync(path.join(dir, "report.txt"), lines.join("\n"), "utf8");

  // ── 4. CSV export ───────────────────────────────────────────────────────
  const csvHeaders = [
    "Target","Chain","Scheme","Vulnerable","VulnCount",
    "RecoveredPrivateKey","RecoveredNonceK","SharedR",
    "Error","ExecMs","ScannedAt"
  ];
  const csvRows = results.map(r => [
    r.target,
    r.displayName ?? r.detectedChain ?? "",
    r.schemeLabel ?? "",
    r.hasVulnerability ? "YES" : "NO",
    r.vulnerabilityCount,
    r.recoveredPrivateKey ?? "",
    r.recoveredNonceK ?? "",
    r.sharedRValue ?? "",
    r.scanError ?? "",
    r.execMs ?? "",
    r.scannedAt?.toISOString() ?? "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

  fs.writeFileSync(
    path.join(dir, "results.csv"),
    [csvHeaders.join(","), ...csvRows].join("\n"),
    "utf8",
  );

  // ── 5. Full JSON export ─────────────────────────────────────────────────
  const jsonPayload = {
    jobId, jobName, sourceName,
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      vulnerable: vulnerable.length,
      clean: clean.length,
      errors: errors.length,
    },
    findings: vulnerable.map(v => ({
      target:             v.target,
      chain:              v.displayName ?? v.detectedChain,
      scheme:             v.schemeLabel,
      vulnerabilityCount: v.vulnerabilityCount,
      recoveredPrivateKey: v.recoveredPrivateKey,
      recoveredNonceK:    v.recoveredNonceK,
      sharedRValue:       v.sharedRValue,
      scannedAt:          v.scannedAt,
      rawResult:          v.rawResult,
    })),
    allResults: results.map(v => ({
      target:             v.target,
      chain:              v.displayName ?? v.detectedChain,
      scheme:             v.schemeLabel,
      hasVulnerability:   v.hasVulnerability,
      vulnerabilityCount: v.vulnerabilityCount,
      recoveredPrivateKey: v.recoveredPrivateKey,
      error:              v.scanError,
      execMs:             v.execMs,
      scannedAt:          v.scannedAt,
    })),
  };

  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify(jsonPayload, null, 2), "utf8");

  logger.info({ jobId, dir, vulnerable: vulnerable.length }, "ProxHQ report saved");
  return dir;
}

// ── Worker ───────────────────────────────────────────────────────────────────
let workerRunning = false;

async function tick() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    // Find a running job first, then oldest pending
    const [job] = await db
      .select()
      .from(batchScanJobsTable)
      .where(inArray(batchScanJobsTable.status, ["running", "pending"]))
      .orderBy(batchScanJobsTable.id)
      .limit(1);

    if (!job) return;

    // Mark as running if pending
    if (job.status === "pending") {
      await db.update(batchScanJobsTable)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(batchScanJobsTable.id, job.id));
    }

    // Load target list
    if (!job.targetsFile || !fs.existsSync(job.targetsFile)) {
      await db.update(batchScanJobsTable)
        .set({ status: "failed", lastError: "Target file missing" })
        .where(eq(batchScanJobsTable.id, job.id));
      return;
    }

    const allTargets = fs.readFileSync(job.targetsFile, "utf8")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length >= 10);

    const cursor = job.cursor;
    if (cursor >= allTargets.length) {
      // Job is done — generate report
      const dir = await generateReport(job.id, job.name, job.sourceName);
      await db.update(batchScanJobsTable)
        .set({ status: "completed", completedAt: new Date(), reportDir: dir })
        .where(eq(batchScanJobsTable.id, job.id));
      logger.info({ jobId: job.id }, "Batch job completed");
      return;
    }

    // Process next chunk
    const chunk = allTargets.slice(cursor, cursor + CHUNK_SIZE);
    logger.info({ jobId: job.id, cursor, chunkTargets: chunk }, "Batch tick — scanning chunk");

    const chunkResults = await runConcurrent(chunk, Math.min(CONCURRENCY, chunk.length), async (target) => {
      const t0 = Date.now();
      logger.info({ target }, "Scanning target...");
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Scan timeout after ${SCAN_TIMEOUT / 1000}s`)), SCAN_TIMEOUT)
        );
        const r = await Promise.race([adaptiveScan(target), timeoutPromise]);
        const { recoveredPrivateKey, recoveredNonceK, sharedRValue } = extractKeyMaterial(r.result);
        return {
          jobId:              job.id,
          target,
          detectedChain:      r.detectedChain?.chain ?? null,
          displayName:        r.detectedChain?.displayName ?? null,
          schemeLabel:        r.detectedChain?.schemeLabel ?? null,
          signatureScheme:    r.detectedChain?.signatureScheme ?? null,
          hasVulnerability:   r.hasVulnerability,
          vulnerabilityCount: r.vulnerabilityCount,
          recoveredPrivateKey,
          recoveredNonceK,
          sharedRValue,
          scanError:          null as string | null,
          execMs:             Date.now() - t0,
          rawResult:          r.result as Record<string, unknown>,
        };
      } catch (e) {
        const candidates = detectChain(target);
        const chain = candidates[0] ?? null;
        return {
          jobId:              job.id,
          target,
          detectedChain:      chain?.chain ?? null,
          displayName:        chain?.displayName ?? null,
          schemeLabel:        chain?.schemeLabel ?? null,
          signatureScheme:    chain?.signatureScheme ?? null,
          hasVulnerability:   false,
          vulnerabilityCount: 0,
          recoveredPrivateKey: null as string | null,
          recoveredNonceK:    null as string | null,
          sharedRValue:       null as string | null,
          scanError:          String(e),
          execMs:             Date.now() - t0,
          rawResult:          null,
        };
      }
    });

    // Batch-insert results
    if (chunkResults.length > 0) {
      await db.insert(batchScanResultsTable).values(chunkResults);
    }

    const vulnInChunk  = chunkResults.filter(r => r.hasVulnerability).length;
    const errInChunk   = chunkResults.filter(r => r.scanError).length;
    const cleanInChunk = chunkResults.length - vulnInChunk - errInChunk;
    const newCursor    = cursor + chunk.length;

    await db.update(batchScanJobsTable).set({
      cursor:         newCursor,
      completedCount: job.completedCount + chunk.length,
      vulnerableCount: job.vulnerableCount + vulnInChunk,
      cleanCount:     job.cleanCount + cleanInChunk,
      errorCount:     job.errorCount + errInChunk,
      status:         newCursor >= allTargets.length ? "running" : "running", // stays running
    }).where(eq(batchScanJobsTable.id, job.id));

  } catch (err) {
    logger.error({ err }, "Batch worker error");
  } finally {
    workerRunning = false;
  }
}

export function startBatchWorker() {
  ensureDirs();
  logger.info({ interval: POLL_INTERVAL, chunkSize: CHUNK_SIZE }, "Batch worker started");
  setInterval(tick, POLL_INTERVAL);
  // Kick off immediately
  setTimeout(tick, 3000);
}

// ── Job creation helpers (called from index.ts and routes) ───────────────────
export function getReportsRoot() { return REPORTS_ROOT; }
export function getJobsDir()    { return JOBS_DIR; }
export function getReportsDir() { return REPORTS_DIR; }

export async function createBatchJob(params: {
  name: string;
  sourceName?: string;
  targets: string[];
}): Promise<number> {
  ensureDirs();
  const { name, sourceName, targets } = params;
  const deduped = [...new Set(targets.filter(t => t.length >= 10))];

  // Insert job record first to get the ID
  const [job] = await db.insert(batchScanJobsTable).values({
    name,
    sourceName: sourceName ?? null,
    status: "pending",
    totalTargets: deduped.length,
  }).returning({ id: batchScanJobsTable.id });

  // Write target list to disk
  const targetsFile = path.join(JOBS_DIR, `job-${job.id}.txt`);
  fs.writeFileSync(targetsFile, deduped.join("\n"), "utf8");

  // Update job with file path
  await db.update(batchScanJobsTable)
    .set({ targetsFile })
    .where(eq(batchScanJobsTable.id, job.id));

  logger.info({ jobId: job.id, name, total: deduped.length }, "Batch job created");
  return job.id;
}
