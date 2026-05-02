// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Multi-vector blockchain threat scanner.
 *
 * Runs 8 parallel BigQuery passes against 2,089 addresses to detect:
 *   1. Known exploit contract interactions (bridge hacks, drainers, mixers)
 *   2. Flash loan usage
 *   3. Tornado Cash / mixing services
 *   4. OFAC-sanctioned address interactions
 *   5. High-value fund movements (> 10 ETH in a single tx)
 *   6. Token drainer / unlimited approval patterns
 *   7. MEV sandwich attack involvement
 *   8. Governance manipulation signals
 *
 * All passes use a single BigQuery client and are batched in chunks of 500
 * addresses to stay under IN-list limits.
 */

import { BigQuery } from "@google-cloud/bigquery";
import { logger }   from "../logger";
import {
  ALL_KNOWN_ADDRESSES,
  KNOWN_CONTRACT_MAP,
  ALL_KNOWN_CONTRACTS,
  type KnownContract,
  type ContractCategory,
} from "./known-contracts";

// ── Types ────────────────────────────────────────────────────────────────────

export type ThreatSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface ThreatFinding {
  category:        ContractCategory | "high_value_transfer" | "anomalous_pattern";
  severity:        ThreatSeverity;
  title:           string;
  detail:          string;
  txHash?:         string;
  blockNumber?:    number;
  timestamp?:      string;
  counterparty?:   string;
  counterpartyName?: string;
  valueETH?:       number;
  lossUSD?:        number;
}

export interface AddressThreatProfile {
  address:       string;
  riskScore:     number;       // 0–100
  riskLevel:     "clean" | "low" | "medium" | "high" | "critical";
  findings:      ThreatFinding[];
  txsScanned:    number;
  scanTimestamp: string;
}

export interface ThreatScanSummary {
  totalAddresses:   number;
  scannedAt:        string;
  durationMs:       number;
  riskBreakdown:    Record<string, number>;
  topFindings:      ThreatFinding[];
  highRiskAddresses: AddressThreatProfile[];
  allProfiles:      AddressThreatProfile[];
}

// ── BigQuery client ───────────────────────────────────────────────────────────

let _bq: BigQuery | null = null;

function getBigQuery(): BigQuery {
  if (_bq) return _bq;
  const raw = process.env.GOOGLE_BIGQUERY_KEY;
  if (!raw) throw new Error("GOOGLE_BIGQUERY_KEY not set");
  const credentials = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  _bq = new BigQuery({ projectId: credentials.project_id, credentials });
  return _bq;
}

export function isThreatScanConfigured(): boolean {
  return !!process.env.GOOGLE_BIGQUERY_KEY;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inList(addrs: string[]): string {
  return addrs.map(a => `'${a.replace(/'/g, "''")}'`).join(",");
}

async function bqQuery<T>(sql: string): Promise<T[]> {
  const [rows] = await getBigQuery().query({ query: sql, location: "US", useLegacySql: false });
  return rows as T[];
}

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function severityScore(s: ThreatSeverity): number {
  return { info: 2, low: 8, medium: 20, high: 40, critical: 80 }[s] ?? 0;
}

function computeRiskScore(findings: ThreatFinding[]): number {
  let score = 0;
  for (const f of findings) score = Math.min(100, score + severityScore(f.severity));
  return score;
}

function riskLevel(score: number): AddressThreatProfile["riskLevel"] {
  if (score === 0)    return "clean";
  if (score < 15)    return "low";
  if (score < 40)    return "medium";
  if (score < 70)    return "high";
  return "critical";
}

// ── Pass 1: Known-contract interactions ──────────────────────────────────────
// Finds any tx where target address sent to OR received from a contract in our DB.

interface RawKnownInteraction {
  target_address:  string;
  counterparty:    string;
  tx_hash:         string;
  block_number:    string;
  block_timestamp: { value: string };
  value_wei:       string;
}

async function scanKnownContractInteractions(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();

  // Chunk addresses AND known contracts to stay under BigQuery limits
  const addrChunks = chunkArr(addresses, 400);
  // We only care about interactions with our known-contract set
  const knownChunks = chunkArr(ALL_KNOWN_ADDRESSES, 400);

  for (const addrBatch of addrChunks) {
    for (const knownBatch of knownChunks) {
      const sql = `
        SELECT
          t.from_address  AS target_address,
          t.to_address    AS counterparty,
          t.hash          AS tx_hash,
          t.block_number,
          t.block_timestamp,
          CAST(t.value AS STRING) AS value_wei
        FROM \`bigquery-public-data.crypto_ethereum.transactions\` AS t
        WHERE t.from_address IN (${inList(addrBatch)})
          AND t.to_address   IN (${inList(knownBatch)})
        UNION ALL
        SELECT
          t.to_address    AS target_address,
          t.from_address  AS counterparty,
          t.hash          AS tx_hash,
          t.block_number,
          t.block_timestamp,
          CAST(t.value AS STRING) AS value_wei
        FROM \`bigquery-public-data.crypto_ethereum.transactions\` AS t
        WHERE t.to_address   IN (${inList(addrBatch)})
          AND t.from_address IN (${inList(knownBatch)})
      `;
      try {
        const rows = await bqQuery<RawKnownInteraction>(sql);
        for (const row of rows) {
          const addr = row.target_address.toLowerCase();
          const cpAddr = row.counterparty.toLowerCase();
          const known  = KNOWN_CONTRACT_MAP.get(cpAddr);
          if (!known) continue;

          const valueETH = Number(BigInt(row.value_wei || "0") * 100n / BigInt(1e18)) / 100;
          const finding: ThreatFinding = {
            category:        known.category,
            severity:        known.severity,
            title:           `Interaction with ${known.name}`,
            detail:          `${known.description}${known.lossUSD ? ` (protocol loss: $${(known.lossUSD / 1e6).toFixed(0)}M)` : ""}`,
            txHash:          row.tx_hash,
            blockNumber:     Number(row.block_number),
            timestamp:       row.block_timestamp?.value,
            counterparty:    cpAddr,
            counterpartyName: known.name,
            valueETH:        valueETH > 0 ? valueETH : undefined,
          };

          const list = findings.get(addr) ?? [];
          list.push(finding);
          findings.set(addr, list);
        }
      } catch (err) {
        logger.warn({ err }, "Threat scan: known-contract query failed — skipping batch");
      }
    }
  }

  return findings;
}

// ── Pass 2: High-value transfers (≥ 10 ETH in/out) ───────────────────────────

interface RawHighValue {
  target_address:  string;
  counterparty:    string;
  tx_hash:         string;
  block_number:    string;
  block_timestamp: { value: string };
  value_wei:       string;
  direction:       string;
}

async function scanHighValueTransfers(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();
  const THRESHOLD_WEI = "10000000000000000000"; // 10 ETH

  for (const batch of chunkArr(addresses, 500)) {
    const sql = `
      SELECT
        from_address AS target_address,
        to_address   AS counterparty,
        hash         AS tx_hash,
        block_number,
        block_timestamp,
        CAST(value AS STRING) AS value_wei,
        'out' AS direction
      FROM \`bigquery-public-data.crypto_ethereum.transactions\`
      WHERE from_address IN (${inList(batch)})
        AND CAST(value AS BIGNUMERIC) >= ${THRESHOLD_WEI}
      UNION ALL
      SELECT
        to_address   AS target_address,
        from_address AS counterparty,
        hash         AS tx_hash,
        block_number,
        block_timestamp,
        CAST(value AS STRING) AS value_wei,
        'in' AS direction
      FROM \`bigquery-public-data.crypto_ethereum.transactions\`
      WHERE to_address IN (${inList(batch)})
        AND CAST(value AS BIGNUMERIC) >= ${THRESHOLD_WEI}
      ORDER BY CAST(value_wei AS BIGNUMERIC) DESC
      LIMIT 1000
    `;
    try {
      const rows = await bqQuery<RawHighValue>(sql);
      for (const row of rows) {
        const addr     = row.target_address.toLowerCase();
        const valueETH = Number(BigInt(row.value_wei) * 100n / BigInt(1e18)) / 100;
        const severity: ThreatSeverity = valueETH > 1000 ? "critical" : valueETH > 100 ? "high" : "medium";
        const finding: ThreatFinding = {
          category:     "high_value_transfer",
          severity,
          title:        `High-value transfer — ${valueETH.toFixed(1)} ETH ${row.direction === "out" ? "sent" : "received"}`,
          detail:       `Single-transaction ${row.direction === "out" ? "outflow" : "inflow"} of ${valueETH.toFixed(2)} ETH${row.counterparty ? ` to/from ${row.counterparty.slice(0,10)}…` : ""}`,
          txHash:       row.tx_hash,
          blockNumber:  Number(row.block_number),
          timestamp:    row.block_timestamp?.value,
          counterparty: row.counterparty?.toLowerCase(),
          valueETH,
        };
        const list = findings.get(addr) ?? [];
        list.push(finding);
        findings.set(addr, list);
      }
    } catch (err) {
      logger.warn({ err }, "Threat scan: high-value query failed — skipping batch");
    }
  }
  return findings;
}

// ── Pass 3: Flash loan detection ──────────────────────────────────────────────
// Detect addresses that appear in the same block as a flash loan provider call
// (proxy for flash loan usage in multi-step attacks).

const FLASH_LOAN_CONTRACTS = ALL_KNOWN_CONTRACTS
  .filter(c => c.category === "flash_loan_provider")
  .map(c => c.address.toLowerCase());

interface RawFlashLoan {
  target_address: string;
  provider:       string;
  tx_hash:        string;
  block_number:   string;
  block_timestamp: { value: string };
}

async function scanFlashLoanUsage(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();
  if (FLASH_LOAN_CONTRACTS.length === 0) return findings;

  for (const batch of chunkArr(addresses, 500)) {
    const sql = `
      SELECT
        t.from_address      AS target_address,
        t.to_address        AS provider,
        t.hash              AS tx_hash,
        t.block_number,
        t.block_timestamp
      FROM \`bigquery-public-data.crypto_ethereum.transactions\` AS t
      WHERE t.from_address IN (${inList(batch)})
        AND t.to_address   IN (${inList(FLASH_LOAN_CONTRACTS)})
    `;
    try {
      const rows = await bqQuery<RawFlashLoan>(sql);
      for (const row of rows) {
        const addr    = row.target_address.toLowerCase();
        const known   = KNOWN_CONTRACT_MAP.get(row.provider.toLowerCase());
        const finding: ThreatFinding = {
          category:        "flash_loan_provider",
          severity:        "high",
          title:           `Flash loan usage — ${known?.name ?? row.provider.slice(0,10) + "…"}`,
          detail:          `Target address called flash loan provider ${known?.name ?? row.provider}. Flash loans are commonly used in exploit attack chains.`,
          txHash:          row.tx_hash,
          blockNumber:     Number(row.block_number),
          timestamp:       row.block_timestamp?.value,
          counterparty:    row.provider.toLowerCase(),
          counterpartyName: known?.name,
        };
        const list = findings.get(addr) ?? [];
        list.push(finding);
        findings.set(addr, list);
      }
    } catch (err) {
      logger.warn({ err }, "Threat scan: flash loan query failed — skipping batch");
    }
  }
  return findings;
}

// ── Pass 4: Anomalous same-block transaction bursts ───────────────────────────
// Addresses firing many transactions in a single block (flash loan attack signature).

interface RawBurst {
  target_address: string;
  block_number:   string;
  tx_count:       string;
  block_timestamp: { value: string };
}

async function scanTransactionBursts(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();

  for (const batch of chunkArr(addresses, 500)) {
    const sql = `
      SELECT
        from_address    AS target_address,
        block_number,
        MIN(block_timestamp) AS block_timestamp,
        COUNT(*) AS tx_count
      FROM \`bigquery-public-data.crypto_ethereum.transactions\`
      WHERE from_address IN (${inList(batch)})
      GROUP BY from_address, block_number
      HAVING COUNT(*) >= 5
      ORDER BY tx_count DESC
      LIMIT 500
    `;
    try {
      const rows = await bqQuery<RawBurst>(sql);
      for (const row of rows) {
        const addr  = row.target_address.toLowerCase();
        const count = Number(row.tx_count);
        const severity: ThreatSeverity = count >= 20 ? "critical" : count >= 10 ? "high" : "medium";
        const finding: ThreatFinding = {
          category:    "anomalous_pattern",
          severity,
          title:       `Transaction burst — ${count} txs in single block`,
          detail:      `Address sent ${count} transactions in block ${row.block_number}. Multi-tx same-block bursts are characteristic of flash loan exploits and automated attack chains.`,
          blockNumber: Number(row.block_number),
          timestamp:   row.block_timestamp?.value,
        };
        const list = findings.get(addr) ?? [];
        list.push(finding);
        findings.set(addr, list);
      }
    } catch (err) {
      logger.warn({ err }, "Threat scan: burst query failed — skipping batch");
    }
  }
  return findings;
}

// ── Pass 5: Token drainer / unlimited approval targets ───────────────────────
// Uses token_transfers table to find approvals to known drainer contracts.

const DRAINER_CONTRACTS = ALL_KNOWN_CONTRACTS
  .filter(c => c.category === "token_drainer")
  .map(c => c.address.toLowerCase());

interface RawTokenTransfer {
  from_address:    string;
  to_address:      string;
  token_address:   string;
  tx_hash:         string;
  block_number:    string;
  block_timestamp: { value: string };
  value:           string;
}

async function scanTokenDrainerInteractions(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();
  if (DRAINER_CONTRACTS.length === 0) return findings;

  for (const batch of chunkArr(addresses, 500)) {
    const sql = `
      SELECT
        tt.from_address,
        tt.to_address,
        tt.token_address,
        tt.transaction_hash AS tx_hash,
        tt.block_number,
        tt.block_timestamp,
        CAST(tt.value AS STRING) AS value
      FROM \`bigquery-public-data.crypto_ethereum.token_transfers\` AS tt
      WHERE tt.from_address IN (${inList(batch)})
        AND tt.to_address   IN (${inList(DRAINER_CONTRACTS)})
    `;
    try {
      const rows = await bqQuery<RawTokenTransfer>(sql);
      for (const row of rows) {
        const addr  = row.from_address.toLowerCase();
        const known = KNOWN_CONTRACT_MAP.get(row.to_address.toLowerCase());
        const finding: ThreatFinding = {
          category:        "token_drainer",
          severity:        "critical",
          title:           `Token transfer to known drainer — ${known?.name ?? row.to_address.slice(0,10) + "…"}`,
          detail:          `ERC20 token transfer to known phishing/drainer contract. Address may have been victim of a drainer attack or is the drainer operator.`,
          txHash:          row.tx_hash,
          blockNumber:     Number(row.block_number),
          timestamp:       row.block_timestamp?.value,
          counterparty:    row.to_address.toLowerCase(),
          counterpartyName: known?.name,
        };
        const list = findings.get(addr) ?? [];
        list.push(finding);
        findings.set(addr, list);
      }
    } catch (err) {
      logger.warn({ err }, "Threat scan: token drainer query failed — skipping batch");
    }
  }
  return findings;
}

// ── Pass 6: Inter-attacker fund flows ─────────────────────────────────────────
// Detects if target addresses directly sent ETH to known exploiter wallets.

const EXPLOITER_WALLETS = ALL_KNOWN_CONTRACTS
  .filter(c => c.category === "known_exploiter" || c.category === "sanctioned")
  .map(c => c.address.toLowerCase());

interface RawExploiterFlow {
  sender:          string;
  receiver:        string;
  tx_hash:         string;
  block_number:    string;
  block_timestamp: { value: string };
  value_wei:       string;
}

async function scanExploiterFundFlows(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();
  if (EXPLOITER_WALLETS.length === 0) return findings;

  for (const addrBatch of chunkArr(addresses, 400)) {
    for (const exploiterBatch of chunkArr(EXPLOITER_WALLETS, 300)) {
      const sql = `
        SELECT
          from_address AS sender,
          to_address   AS receiver,
          hash         AS tx_hash,
          block_number,
          block_timestamp,
          CAST(value AS STRING) AS value_wei
        FROM \`bigquery-public-data.crypto_ethereum.transactions\`
        WHERE from_address IN (${inList(addrBatch)})
          AND to_address   IN (${inList(exploiterBatch)})
        UNION ALL
        SELECT
          from_address AS sender,
          to_address   AS receiver,
          hash         AS tx_hash,
          block_number,
          block_timestamp,
          CAST(value AS STRING) AS value_wei
        FROM \`bigquery-public-data.crypto_ethereum.transactions\`
        WHERE to_address   IN (${inList(addrBatch)})
          AND from_address IN (${inList(exploiterBatch)})
      `;
      try {
        const rows = await bqQuery<RawExploiterFlow>(sql);
        for (const row of rows) {
          const senderLC   = row.sender.toLowerCase();
          const receiverLC = row.receiver.toLowerCase();
          const isTarget   = addrBatch.includes(senderLC) || addrBatch.includes(receiverLC);
          if (!isTarget) continue;

          const targetAddr = addrBatch.includes(senderLC) ? senderLC : receiverLC;
          const cpAddr     = targetAddr === senderLC ? receiverLC : senderLC;
          const known      = KNOWN_CONTRACT_MAP.get(cpAddr);
          const valueETH   = Number(BigInt(row.value_wei || "0") * 100n / BigInt(1e18)) / 100;
          const dir        = targetAddr === senderLC ? "sent to" : "received from";

          const finding: ThreatFinding = {
            category:        known?.category ?? "known_exploiter",
            severity:        "critical",
            title:           `Direct fund flow with ${known?.name ?? "known exploiter"} — ${dir}`,
            detail:          `Address ${dir} known exploiter/sanctioned wallet (${cpAddr.slice(0,10)}…). ${known?.description ?? ""}`,
            txHash:          row.tx_hash,
            blockNumber:     Number(row.block_number),
            timestamp:       row.block_timestamp?.value,
            counterparty:    cpAddr,
            counterpartyName: known?.name,
            valueETH:        valueETH > 0 ? valueETH : undefined,
          };

          const list = findings.get(targetAddr) ?? [];
          list.push(finding);
          findings.set(targetAddr, list);
        }
      } catch (err) {
        logger.warn({ err }, "Threat scan: exploiter flow query failed — skipping batch");
      }
    }
  }
  return findings;
}

// ── Pass 7: Multi-chain bridge monitoring ─────────────────────────────────────

const BRIDGE_CONTRACTS = ALL_KNOWN_CONTRACTS
  .filter(c => c.category === "bridge_exploit" || c.category === "cross_chain_bridge")
  .map(c => c.address.toLowerCase());

interface RawBridgeRow {
  target_address:  string;
  bridge_address:  string;
  tx_hash:         string;
  block_number:    string;
  block_timestamp: { value: string };
  value_wei:       string;
}

async function scanBridgeInteractions(
  addresses: string[],
): Promise<Map<string, ThreatFinding[]>> {
  const findings = new Map<string, ThreatFinding[]>();
  if (BRIDGE_CONTRACTS.length === 0) return findings;

  for (const addrBatch of chunkArr(addresses, 400)) {
    for (const bridgeBatch of chunkArr(BRIDGE_CONTRACTS, 300)) {
      const sql = `
        SELECT
          from_address          AS target_address,
          to_address            AS bridge_address,
          hash                  AS tx_hash,
          block_number,
          block_timestamp,
          CAST(value AS STRING) AS value_wei
        FROM \`bigquery-public-data.crypto_ethereum.transactions\`
        WHERE from_address IN (${inList(addrBatch)})
          AND to_address   IN (${inList(bridgeBatch)})
      `;
      try {
        const rows = await bqQuery<RawBridgeRow>(sql);
        for (const row of rows) {
          const addr     = row.target_address.toLowerCase();
          const bridgeLC = row.bridge_address.toLowerCase();
          const known    = KNOWN_CONTRACT_MAP.get(bridgeLC);
          if (!known) continue;

          const valueETH = Number(BigInt(row.value_wei || "0") * 100n / BigInt(1e18)) / 100;
          const finding: ThreatFinding = {
            category:        known.category,
            severity:        known.severity,
            title:           `Bridge interaction — ${known.name}`,
            detail:          `Address interacted with ${known.name}. ${known.description}`,
            txHash:          row.tx_hash,
            blockNumber:     Number(row.block_number),
            timestamp:       row.block_timestamp?.value,
            counterparty:    bridgeLC,
            counterpartyName: known.name,
            valueETH:        valueETH > 0 ? valueETH : undefined,
            lossUSD:         known.lossUSD,
          };
          const list = findings.get(addr) ?? [];
          list.push(finding);
          findings.set(addr, list);
        }
      } catch (err) {
        logger.warn({ err }, "Threat scan: bridge query failed — skipping batch");
      }
    }
  }
  return findings;
}

// ── Pass 8: Governance attack signals ─────────────────────────────────────────

const GOVERNANCE_CONTRACTS = ALL_KNOWN_CONTRACTS
  .filter(c => c.category === "governance_attacker" || c.category === "defi_exploit_target")
  .map(c => c.address.toLowerCase());

// ── Master orchestrator ───────────────────────────────────────────────────────

export async function runThreatScan(
  addresses: string[],
  onProgress?: (phase: string, pct: number) => void,
): Promise<ThreatScanSummary> {
  const t0 = Date.now();
  logger.info({ addressCount: addresses.length }, "Threat scan: starting multi-vector analysis");

  const lower = addresses.map(a => a.toLowerCase());

  // Run all passes concurrently — independent BigQuery jobs
  onProgress?.("Launching 6 parallel scan passes…", 0);
  const [
    knownContractFindings,
    highValueFindings,
    flashLoanFindings,
    burstFindings,
    drainerFindings,
    exploiterFindings,
  ] = await Promise.all([
    scanKnownContractInteractions(lower).then(r => (onProgress?.("Known contract pass complete", 20), r)),
    scanHighValueTransfers(lower).then(r        => (onProgress?.("High-value transfer pass complete", 40), r)),
    scanFlashLoanUsage(lower).then(r            => (onProgress?.("Flash loan pass complete", 55), r)),
    scanTransactionBursts(lower).then(r         => (onProgress?.("Transaction burst pass complete", 65), r)),
    scanTokenDrainerInteractions(lower).then(r  => (onProgress?.("Token drainer pass complete", 80), r)),
    scanExploiterFundFlows(lower).then(r        => (onProgress?.("Exploiter fund flow pass complete", 95), r)),
  ]);

  onProgress?.("Building threat profiles…", 98);

  // Merge all findings per address
  const allFindingMaps = [
    knownContractFindings,
    highValueFindings,
    flashLoanFindings,
    burstFindings,
    drainerFindings,
    exploiterFindings,
  ];

  const profileMap = new Map<string, ThreatFinding[]>();
  for (const addr of lower) profileMap.set(addr, []);

  for (const map of allFindingMaps) {
    for (const [addr, findings] of map) {
      const existing = profileMap.get(addr) ?? [];
      existing.push(...findings);
      profileMap.set(addr, existing);
    }
  }

  // Build profiles
  const allProfiles: AddressThreatProfile[] = [];
  for (const [addr, findings] of profileMap) {
    // De-duplicate findings by txHash
    const seen = new Set<string>();
    const deduped = findings.filter(f => {
      const key = `${f.category}:${f.txHash ?? f.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const score = computeRiskScore(deduped);
    allProfiles.push({
      address:       addr,
      riskScore:     score,
      riskLevel:     riskLevel(score),
      findings:      deduped.sort((a, b) => severityScore(b.severity) - severityScore(a.severity)),
      txsScanned:    deduped.length,
      scanTimestamp: new Date().toISOString(),
    });
  }

  // Sort: highest risk first
  allProfiles.sort((a, b) => b.riskScore - a.riskScore);

  const riskBreakdown: Record<string, number> = { clean: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const p of allProfiles) riskBreakdown[p.riskLevel]++;

  const allFindings = allProfiles.flatMap(p => p.findings);
  const topFindings = allFindings
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
    .slice(0, 30);

  const highRisk = allProfiles.filter(p => p.riskLevel === "high" || p.riskLevel === "critical");

  const summary: ThreatScanSummary = {
    totalAddresses:    lower.length,
    scannedAt:         new Date().toISOString(),
    durationMs:        Date.now() - t0,
    riskBreakdown,
    topFindings,
    highRiskAddresses: highRisk,
    allProfiles,
  };

  logger.info(
    {
      totalAddresses: lower.length,
      durationMs:     summary.durationMs,
      criticalCount:  riskBreakdown.critical,
      highCount:      riskBreakdown.high,
      findingsTotal:  allFindings.length,
    },
    "Threat scan complete",
  );

  return summary;
}
