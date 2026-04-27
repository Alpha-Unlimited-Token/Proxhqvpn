import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  scanJobsTable, vulnerabilitiesTable, quantumAnalysesTable, quantumThreatsTable
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { RunBlockchainScanBody, ListScansQueryParams, GetScanParams, GetScanReportParams, ListVulnerabilitiesQueryParams } from "@workspace/api-zod";
import { analyzeCode } from "../lib/quantum-analyzer";

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
  return {
    id: v.id, scanId: v.scanId, title: v.title, description: v.description,
    severity: v.severity, category: v.category, isQuantumRelated: v.isQuantumRelated,
    cweId: v.cweId, cvssScore: v.cvssScore, affectedCode: v.affectedCode,
    lineNumber: v.lineNumber, recommendation: v.recommendation,
    references: v.references ?? [],
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

export default router;
