// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import {
  fetchWalletOutgoing,
  fetchNonceAndBalance,
  getChain,
  CHAINS,
  fullSignatureScan,
} from "@workspace/wallet-tx";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import {
  disableForScan,
  enableAfterScan,
  startAutonomousRunner,
} from "../lib/signature-miner/autonomous-runner";
import {
  pauseBatchWorker,
  resumeBatchWorker,
} from "../lib/scheme-auditor/batch-worker";

const router = Router();

// ── Background Scan Job Store ─────────────────────────────────────────────────
// Lives inside the API server process (a persistent Replit workflow).
// Jobs survive as long as the server is running — no external process needed.

type JobStatus = "pending" | "running" | "done" | "error";

interface ScanJob {
  id: string;
  address: string;
  chain: string;
  status: JobStatus;
  phase: string;
  progress: { enriched: number; total: number };
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
  log: string[];
}

const jobs = new Map<string, ScanJob>();

function jobLog(job: ScanJob, msg: string) {
  job.log.push(`[${new Date().toISOString()}] ${msg}`);
  if (job.log.length > 200) job.log.shift();
}

async function runScanJob(job: ScanJob) {
  job.status = "running";
  job.phase  = "fetching";
  jobLog(job, `Starting full signature scan for ${job.address} on ${job.chain}`);
  logger.info({ jobId: job.id, address: job.address, chain: job.chain }, "Background scan job started");

  // ── Disable all background scanners while this priority scan runs ───────────
  // disableForScan() atomically stops any currently-running AutonomousRunner AND
  // sets a flag that blocks startAutonomousRunner() from launching, closing the
  // race where the runner starts AFTER we check isRunning() but before we get
  // Blockscout bandwidth.  pauseBatchWorker() stops the 8-second batch tick.
  pauseBatchWorker();
  disableForScan();
  jobLog(job, "Background scanners disabled. Scan starting…");
  logger.info({ jobId: job.id }, "Background scanners disabled for priority wallet scan");

  // Throttle progress updates: only log to server every 50 pages or 500 enriched
  let lastLoggedPage = 0;
  let lastLoggedEnriched = 0;

  try {
    const result = await fullSignatureScan(
      job.address,
      job.chain,
      100_000, // enrichLimit — effectively unlimited
      50,      // batchSize
      12,      // concurrency
      (p) => { // onProgress
        // Update job object in real-time for the polling endpoint
        if (p.phase === "listing") {
          job.phase = "fetching";
          job.progress = { enriched: 0, total: p.listed };
          // Server log every 50 pages (~2500 txs)
          if (p.listed - lastLoggedPage >= 2500) {
            lastLoggedPage = p.listed;
            logger.info({ jobId: job.id, txsFetched: p.listed }, "Scan: fetching txs");
            jobLog(job, `Fetching… ${p.listed.toLocaleString()} txs so far`);
          }
        } else if (p.phase === "enriching") {
          job.phase = "enriching";
          job.progress = { enriched: p.enriched, total: p.total };
          // Server log every 500 enriched
          if (p.enriched - lastLoggedEnriched >= 500) {
            lastLoggedEnriched = p.enriched;
            logger.info({ jobId: job.id, enriched: p.enriched, total: p.total }, "Scan: enriching sigs");
            jobLog(job, `Enriching… ${p.enriched.toLocaleString()} / ${p.total.toLocaleString()} sigs`);
          }
        }
      },
      true,    // priority=true — yields semaphore to this scan, batch scanner backs off
    );

    job.phase       = "done";
    job.status      = "done";
    job.finishedAt  = Date.now();
    job.durationMs  = result.durationMs;
    job.progress    = { enriched: result.sigsEnriched ?? 0, total: result.totalTxsFetched ?? 0 };
    job.result      = {
      address:          result.address,
      chain:            result.chain,
      chainLabel:       result.chainLabel,
      nonce:            result.nonce,
      balanceEth:       result.balanceEth,
      totalTxsFetched:  result.totalTxsFetched,
      sigsAnalyzed:     result.sigsEnriched,
      nonceReuseFound:  result.nonceReuseFound,
      nonceReusePairs:  result.nonceReusePairs,
      rValueDuplicates: result.rValueDuplicates,
      sValueDuplicates: result.sValueDuplicates,
      weakKCandidates:  result.weakKCandidates,
      keyRecovered:     result.keyRecovered,
      summary:          result.summary,
      durationMs:       result.durationMs,
    };
    const msg = `Scan complete — ${result.sigsEnriched} sigs | r-dups=${(result.rValueDuplicates as unknown[]).length} | weakK=${(result.weakKCandidates as unknown[]).length}`;
    jobLog(job, msg);
    logger.info({ jobId: job.id, sigsEnriched: result.sigsEnriched, rDups: (result.rValueDuplicates as unknown[]).length }, "Background scan job complete");
  } catch (err) {
    job.status     = "error";
    job.finishedAt = Date.now();
    job.error      = (err as Error).message;
    jobLog(job, `ERROR: ${job.error}`);
    logger.error({ jobId: job.id, err: job.error }, "Background scan job error");
  } finally {
    // ── Re-enable background scanners ─────────────────────────────────────────
    enableAfterScan();   // clears _scanJobActive so runner can start again
    resumeBatchWorker(); // clears _batchPaused so batch tick resumes
    logger.info({ jobId: job.id }, "Background scanners re-enabled after wallet scan");
    startAutonomousRunner({ resumeFromSave: true }).catch(e => {
      logger.error({ err: String(e) }, "Failed to restart AutonomousRunner after scan");
    });
  }
}

/**
 * POST /api/wallet/scan-job
 * Starts a background scan inside the API server process.
 * Returns immediately with a job ID — poll GET /api/wallet/scan-job/:id for status.
 *
 * Body: { address, chain? }
 */
router.post("/scan-job", (req, res) => {
  const address = String(req.body?.address ?? "");
  const chain   = String(req.body?.chain   ?? "ethereum");

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  const job: ScanJob = {
    id:        randomUUID(),
    address,
    chain,
    status:    "pending",
    phase:     "queued",
    progress:  { enriched: 0, total: 0 },
    startedAt: Date.now(),
    log:       [],
  };

  jobs.set(job.id, job);
  jobLog(job, `Job queued for ${address}`);

  // Fire-and-forget — runs inside the persistent server process
  void runScanJob(job);

  res.status(202).json({
    jobId:   job.id,
    address: job.address,
    chain:   job.chain,
    status:  job.status,
    poll:    `/api/wallet/scan-job/${job.id}`,
  });
});

/**
 * GET /api/wallet/scan-job/:id
 * Returns current status and result (if done) for a job.
 */
router.get("/scan-job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    jobId:       job.id,
    address:     job.address,
    chain:       job.chain,
    status:      job.status,
    phase:       job.phase,
    progress:    job.progress,
    startedAt:   job.startedAt,
    finishedAt:  job.finishedAt,
    durationMs:  job.durationMs,
    elapsedMs:   Date.now() - job.startedAt,
    result:      job.result ?? null,
    error:       job.error  ?? null,
    recentLog:   job.log.slice(-20),
  });
});

/**
 * GET /api/wallet/scan-jobs
 * Lists all jobs (summary — no full result payload).
 */
router.get("/scan-jobs", (_req, res) => {
  const list = [...jobs.values()].map(j => ({
    jobId:      j.id,
    address:    j.address,
    chain:      j.chain,
    status:     j.status,
    phase:      j.phase,
    progress:   j.progress,
    startedAt:  j.startedAt,
    finishedAt: j.finishedAt,
    durationMs: j.durationMs,
    elapsedMs:  Date.now() - j.startedAt,
  }));
  res.json({ jobs: list, count: list.length });
});

/**
 * DELETE /api/wallet/scan-job/:id
 * Removes a completed/errored job from the store.
 */
router.delete("/scan-job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status === "running") { res.status(409).json({ error: "Job is still running" }); return; }
  jobs.delete(req.params.id);
  res.json({ deleted: req.params.id });
});

// ── Existing routes ───────────────────────────────────────────────────────────

/**
 * GET /api/wallet/chains
 * Returns the list of supported chains.
 */
router.get("/chains", (_req, res) => {
  res.json(CHAINS.map(c => ({ id: c.id, label: c.label })));
});

/**
 * GET /api/wallet/nonce?address=0x...&chain=ethereum
 * Fast nonce + balance check — one RPC call per chain.
 */
router.get("/nonce", async (req, res) => {
  const address = String(req.query.address ?? "");
  const chainId = String(req.query.chain ?? "ethereum");

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  const chain = getChain(chainId);
  const data  = await fetchNonceAndBalance(address, chain.rpcUrl, chainId);
  res.json({ address, chain: chainId, ...data });
});

/**
 * GET /api/wallet/outgoing?address=0x...&chain=ethereum&enrichSigs=false
 * Full outgoing transaction history with optional signature enrichment.
 */
router.get("/outgoing", async (req, res) => {
  const address     = String(req.query.address ?? "");
  const chainId     = String(req.query.chain ?? "ethereum");
  const enrichSigs  = req.query.enrichSigs === "true";
  const enrichLimit = Math.min(parseInt(String(req.query.enrichLimit ?? "200")), 1000);

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  try {
    const summary = await fetchWalletOutgoing(address, chainId, {
      alchemyKey:  process.env.ALCHEMY_API_KEY,
      enrichSigs,
      enrichLimit,
    });

    res.json({
      address:      summary.address,
      chain:        summary.chain,
      chainLabel:   summary.chainLabel,
      nonce:        summary.nonce,
      balanceEth:   summary.balanceEth,
      totalFetched: summary.totalFetched,
      source:       summary.source,
      error:        summary.error ?? null,
      outgoingTxs:  summary.outgoingTxs.map(tx => ({
        hash:        tx.hash,
        blockNumber: tx.blockNumber,
        timestamp:   tx.timestamp,
        to:          tx.to,
        valueEth:    tx.valueEth,
        asset:       tx.asset,
        category:    tx.category,
        nonce:       tx.nonce,
        r:           tx.r,
        s:           tx.s,
        v:           tx.v,
      })),
    });
  } catch (err) {
    req.log?.error(err, "wallet/outgoing error");
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/wallet/signature-scan
 * Synchronous full scan — blocks until complete.
 * For long-running wallets (33k+ txs) prefer POST /api/wallet/scan-job instead.
 */
router.post("/signature-scan", async (req, res) => {
  const address     = String(req.body?.address ?? "");
  const chainId     = String(req.body?.chain ?? "ethereum");
  const enrichLimit = Math.min(parseInt(String(req.body?.enrichLimit ?? "50000")), 100_000);
  const batchSize   = Math.min(parseInt(String(req.body?.batchSize   ?? "50")), 100);
  const concurrency = Math.min(parseInt(String(req.body?.concurrency ?? "10")), 20);

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  try {
    const result = await fullSignatureScan(address, chainId, enrichLimit, batchSize, concurrency);
    res.json({
      address:          result.address,
      chain:            result.chain,
      chainLabel:       result.chainLabel,
      nonce:            result.nonce,
      balanceEth:       result.balanceEth,
      source:           result.source,
      totalTxsFetched:  result.totalTxsFetched,
      sigsAnalyzed:     result.sigsEnriched,
      nonceReuseFound:  result.nonceReuseFound,
      nonceReusePairs:  result.nonceReusePairs,
      rValueDuplicates: result.rValueDuplicates,
      sValueDuplicates: result.sValueDuplicates,
      weakKCandidates:  result.weakKCandidates,
      keyRecovered:     result.keyRecovered,
      summary:          result.summary,
      durationMs:       result.durationMs,
      error:            result.error,
    });
  } catch (err) {
    req.log?.error(err, "wallet/signature-scan error");
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/wallet/multi-chain?address=0x...
 * Checks nonce on ALL supported chains — quick reachability check.
 */
router.get("/multi-chain", async (req, res) => {
  const address = String(req.query.address ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  const results = await Promise.allSettled(
    CHAINS.map(async chain => {
      const { nonce, balanceEth } = await fetchNonceAndBalance(address, chain.rpcUrl, chain.id);
      return { chain: chain.id, label: chain.label, nonce, balanceEth, active: nonce > 0 };
    }),
  );

  const chains = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { chain: CHAINS[i].id, label: CHAINS[i].label, nonce: 0, balanceEth: 0, active: false, error: r.reason?.message },
  );

  res.json({ address, chains, activeChains: chains.filter(c => c.active).map(c => c.chain) });
});

export default router;
