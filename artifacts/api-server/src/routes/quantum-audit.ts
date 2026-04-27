import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  scanJobsTable, vulnerabilitiesTable, quantumAnalysesTable, quantumThreatsTable
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { RunBlockchainScanBody, ListScansQueryParams, GetScanParams, GetScanReportParams, ListVulnerabilitiesQueryParams } from "@workspace/api-zod";

const router = Router();

// ── Quantum vulnerability patterns per chain ──────────────────────────────────
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
    description: "Grover's algorithm provides a quadratic speedup for searching unsorted databases, effectively halving the security bits of any hash function used in proof-of-work, Merkle trees, or commitment schemes.",
    technicalDetail: "SHA-256 (used in Bitcoin PoW and Merkle trees) provides 128-bit post-quantum security with Grover's — down from 256-bit classical security. Keccak-256 (Ethereum) similarly drops to 128-bit. While still considered safe, this threatens future hash function parameters and any scheme relying on hash collision resistance at 128-bit security levels.",
    estimatedQubitsNeeded: 2000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2028-2032",
    mitigation: "Increase hash output sizes to 384 or 512 bits where feasible. Move to SHA-3 variants with larger outputs. Use post-quantum-secure hash functions like SHAKE-256 with 512-bit output for critical path operations.",
    pqcAlternatives: ["SHA-3-512", "SHAKE-256", "BLAKE3", "Haraka"],
    severity: "high" as const,
  },
  {
    name: "Shor's Algorithm — RSA/DH Key Exchange Compromise",
    algorithm: "shors" as const,
    affectedChains: ["ethereum", "generic"],
    description: "Any blockchain protocol or smart contract system using RSA or traditional Diffie-Hellman for key exchange, TLS session establishment, or oracle authentication is vulnerable to quantum key recovery.",
    technicalDetail: "Shor's algorithm factors large integers in O((log N)³) time, breaking RSA at any current key size. A 2048-bit RSA key requires ~4000 logical qubits to break. Ethereum smart contracts that call external APIs over TLS using RSA cipher suites are indirectly vulnerable — the TLS session can be decrypted retroactively ('harvest now, decrypt later' attack).",
    estimatedQubitsNeeded: 4000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2030-2035",
    mitigation: "Replace RSA/DH with CRYSTALS-Kyber for key encapsulation. Use TLS 1.3 with post-quantum cipher suites. Audit all oracle integrations for classical encryption dependencies.",
    pqcAlternatives: ["CRYSTALS-Kyber", "NTRU", "SABER", "McEliece"],
    severity: "high" as const,
  },
  {
    name: "Quantum Replay Attack on Hash-Time-Lock Contracts",
    algorithm: "hybrid" as const,
    affectedChains: ["bitcoin", "ethereum", "generic"],
    description: "Hash Time Lock Contracts (HTLCs) and payment channels expose preimage data that a quantum adversary could exploit before the timelock expires, enabling double-spend attacks on atomic swaps.",
    technicalDetail: "In an HTLC, the hash preimage is revealed on-chain when the recipient claims funds. A quantum attacker with Grover's speedup could attempt to find alternative preimage collisions or leverage exposed preimages to attack other linked HTLCs in the same atomic swap chain faster than the timelock allows.",
    estimatedQubitsNeeded: 1500,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2027-2030",
    mitigation: "Implement longer timelocks to exceed quantum attack window. Use larger hash outputs (SHA3-512). Transition to post-quantum commitment schemes based on lattice problems.",
    pqcAlternatives: ["Lattice-based commitments", "SHA3-512 HTLCs", "Quantum-safe payment channels"],
    severity: "medium" as const,
  },
  {
    name: "BQP-Complete Consensus Attack",
    algorithm: "bqp_complete" as const,
    affectedChains: ["ethereum", "solana", "avalanche", "polygon"],
    description: "Proof-of-stake consensus protocols relying on BLS signatures (used in Ethereum 2.0) face aggregate signature forgery via quantum algorithms operating in BQP complexity class.",
    technicalDetail: "BLS12-381 signatures aggregate efficiently for PoS validator voting, but the pairing-based cryptography underlying BLS is vulnerable to quantum attacks via algorithms like the quantum algorithm for discrete logarithm over extension fields. An attacker with ~10,000+ logical qubits could forge validator signatures and influence finality.",
    estimatedQubitsNeeded: 10000,
    currentlyFeasible: false,
    estimatedFeasibleYear: "2035-2040",
    mitigation: "Monitor NIST PQC standardization for pairing-friendly curve alternatives. Implement hybrid classical+PQC validator signatures as a transitional measure. Consider hash-based aggregate signatures.",
    pqcAlternatives: ["Hash-based aggregate signatures", "Lattice-based BLS alternatives", "CRYSTALS-Dilithium for validators"],
    severity: "medium" as const,
  },
];

// ── Vulnerability patterns database for scan simulation ──────────────────────
const VULN_PATTERNS: Record<string, Array<{
  title: string; description: string; severity: "critical" | "high" | "medium" | "low" | "informational";
  category: "reentrancy" | "overflow" | "access_control" | "quantum_crypto" | "weak_randomness" | "front_running" | "denial_of_service" | "logic_error" | "consensus_attack" | "signature_malleability" | "hash_collision" | "elliptic_curve" | "timestamp_dependence" | "gas_limit" | "other";
  isQuantumRelated: boolean; cweId: string; cvssScore: number; recommendation: string; refs: string[];
}>> = {
  ethereum: [
    { title: "Reentrancy Vulnerability", description: "External call made before state update, enabling recursive drain of contract funds.", severity: "critical", category: "reentrancy", isQuantumRelated: false, cweId: "CWE-841", cvssScore: 9.8, recommendation: "Apply checks-effects-interactions pattern. Use ReentrancyGuard mutex from OpenZeppelin.", refs: ["https://swcregistry.io/docs/SWC-107"] },
    { title: "ECDSA Private Key Exposure via Quantum Attack", description: "secp256k1 ECDSA signatures are vulnerable to Shor's algorithm. All addresses with exposed public keys (any address that has sent a transaction) are at risk once a sufficiently powerful quantum computer is available.", severity: "critical", category: "elliptic_curve", isQuantumRelated: true, cweId: "CWE-327", cvssScore: 9.5, recommendation: "Migrate to post-quantum signature scheme (CRYSTALS-Dilithium or SPHINCS+). Implement address rotation policy — never reuse addresses after spending.", refs: ["https://eips.ethereum.org/EIPS/eip-2938", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf"] },
    { title: "Integer Overflow in Token Arithmetic", description: "Unchecked arithmetic on uint256 values can wrap around, causing tokens to be minted or transferred in unexpected quantities.", severity: "high", category: "overflow", isQuantumRelated: false, cweId: "CWE-190", cvssScore: 8.1, recommendation: "Use Solidity 0.8.x built-in overflow checks or OpenZeppelin SafeMath for older versions.", refs: ["https://swcregistry.io/docs/SWC-101"] },
    { title: "Weak Pseudo-Random Number Generation", description: "Contract uses block.timestamp or blockhash as randomness source, both of which are predictable or manipulable by miners.", severity: "high", category: "weak_randomness", isQuantumRelated: false, cweId: "CWE-338", cvssScore: 7.5, recommendation: "Use Chainlink VRF or commit-reveal scheme for on-chain randomness.", refs: ["https://swcregistry.io/docs/SWC-120"] },
    { title: "SHA-256 Hash Security Reduction via Grover's Algorithm", description: "Keccak-256 used in this contract's commitment scheme provides only 128-bit post-quantum security (halved from 256-bit classical). Critical commitment data may be at risk from future quantum adversaries.", severity: "medium", category: "hash_collision", isQuantumRelated: true, cweId: "CWE-916", cvssScore: 5.9, recommendation: "Increase commitment hash size to 512 bits using SHA3-512 or SHAKE-256 for future-proofing against Grover's algorithm.", refs: ["https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"] },
    { title: "Access Control Missing on Critical Function", description: "Function modifying contract state has no access control modifier, allowing any address to invoke privileged operations.", severity: "critical", category: "access_control", isQuantumRelated: false, cweId: "CWE-284", cvssScore: 9.1, recommendation: "Add onlyOwner or role-based access control using OpenZeppelin AccessControl.", refs: ["https://swcregistry.io/docs/SWC-105"] },
  ],
  bitcoin: [
    { title: "P2PK Output Quantum Vulnerability", description: "Pay-to-Public-Key (P2PK) outputs expose the full public key on-chain, making them immediately vulnerable to Shor's algorithm-based key recovery. This includes all early coinbase outputs.", severity: "critical", category: "elliptic_curve", isQuantumRelated: true, cweId: "CWE-327", cvssScore: 9.8, recommendation: "Migrate funds from P2PK outputs to P2PKH or P2WPKH addresses immediately. Monitor NIST PQC standards for Bitcoin quantum-resistant upgrade path.", refs: ["https://en.bitcoin.it/wiki/Pay_to_Public_Key"] },
    { title: "Address Reuse Exposes Public Key", description: "Multiple transactions from the same address expose the public key in scriptsig, enabling quantum key recovery. Best practice is to use each address only once.", severity: "high", category: "elliptic_curve", isQuantumRelated: true, cweId: "CWE-327", cvssScore: 8.2, recommendation: "Implement HD wallet address derivation (BIP32/BIP44). Enforce single-use addresses. Migrate to Taproot (P2TR) outputs.", refs: ["https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki"] },
    { title: "SHA-256 Mining Vulnerability to Grover's Algorithm", description: "Bitcoin's proof-of-work uses double-SHA256. Grover's algorithm provides quadratic speedup in hash preimage search, giving quantum miners a significant competitive advantage and potentially centralizing mining power.", severity: "medium", category: "hash_collision", isQuantumRelated: true, cweId: "CWE-916", cvssScore: 6.5, recommendation: "Monitor for quantum mining hardware development. Network should consider PoW algorithm updates or difficulty adjustment mechanisms that account for quantum speedup.", refs: ["https://bitcoinmagazine.com/technical/bitcoin-quantum-computing"] },
  ],
  solana: [
    { title: "Ed25519 Signature Quantum Vulnerability", description: "Solana uses Ed25519 signatures which rely on the elliptic curve discrete logarithm problem. Shor's algorithm can solve this in polynomial time on a quantum computer.", severity: "critical", category: "elliptic_curve", isQuantumRelated: true, cweId: "CWE-327", cvssScore: 9.5, recommendation: "Plan migration to hybrid Ed25519 + post-quantum signature (CRYSTALS-Dilithium) as Solana's protocol evolves. Monitor Solana Foundation's quantum roadmap.", refs: ["https://docs.solana.com/developing/programming-model/transactions"] },
    { title: "Account Data Deserialization Without Bounds Check", description: "Program deserializes account data without validating expected size, risking out-of-bounds memory access and potential program crashes.", severity: "high", category: "overflow", isQuantumRelated: false, cweId: "CWE-125", cvssScore: 7.8, recommendation: "Use Anchor framework's account validation macros. Add explicit size checks before deserialization.", refs: ["https://doc.rust-lang.org/std/option/enum.Option.html"] },
    { title: "Missing Signer Check", description: "Instruction handler does not verify that required accounts are signers, allowing unsigned account manipulation.", severity: "high", category: "access_control", isQuantumRelated: false, cweId: "CWE-284", cvssScore: 8.0, recommendation: "Add `constraint = authority.key() == state.authority` in Anchor or check `is_signer` on all privileged accounts.", refs: ["https://docs.rs/anchor-lang/latest/anchor_lang/"] },
  ],
};

// ── Simulate a scan (run analysis) ───────────────────────────────────────────
async function simulateScan(scanId: number, chain: string, code: string | null | undefined, includeQuantum: boolean) {
  try {
    const patterns = VULN_PATTERNS[chain] ?? VULN_PATTERNS["ethereum"];
    const selected = patterns.slice(0, Math.floor(Math.random() * 3) + 3);

    const vulns = await db.insert(vulnerabilitiesTable).values(
      selected.map(p => ({
        scanId,
        title: p.title,
        description: p.description,
        severity: p.severity,
        category: p.category,
        isQuantumRelated: p.isQuantumRelated,
        cweId: p.cweId,
        cvssScore: p.cvssScore,
        recommendation: p.recommendation,
        references: p.refs,
        affectedCode: code ? code.substring(0, 200) : null,
        lineNumber: code ? Math.floor(Math.random() * 50) + 1 : null,
      }))
    ).returning();

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    const quantumRelated = vulns.filter(v => v.isQuantumRelated);
    vulns.forEach(v => {
      if (v.severity in counts) counts[v.severity as keyof typeof counts]++;
    });

    const quantumRiskScore = includeQuantum
      ? Math.min(100, quantumRelated.length * 25 + (counts.critical * 15))
      : 0;

    if (includeQuantum) {
      const ellipticVuln = vulns.some(v => v.category === "elliptic_curve");
      const hashVuln = vulns.some(v => v.category === "hash_collision");
      await db.insert(quantumAnalysesTable).values({
        scanId,
        overallRisk: quantumRiskScore > 75 ? "critical" : quantumRiskScore > 50 ? "high" : quantumRiskScore > 25 ? "medium" : "low",
        riskScore: quantumRiskScore,
        ellipticCurveVulnerable: ellipticVuln,
        hashFunctionVulnerable: hashVuln,
        signatureSchemeVulnerable: ellipticVuln,
        estimatedBreakYear: ellipticVuln ? "2030-2035" : null,
        shorsAlgorithmApplicable: ellipticVuln,
        groversAlgorithmApplicable: hashVuln,
        pqcRecommendations: ["CRYSTALS-Dilithium", "SPHINCS+", "CRYSTALS-Kyber", "SHA3-512"],
        threatSummary: ellipticVuln
          ? `This ${chain} codebase is critically vulnerable to post-quantum attacks. ECDSA/Ed25519 key recovery via Shor's algorithm represents an existential threat once quantum computers reach 4000+ logical qubits. Immediate migration planning to PQC standards is strongly recommended.`
          : `Low quantum risk detected. Standard hash functions used are quantum-resistant at current sizes, though migration to larger hash outputs is recommended for long-term security.`,
      });
    }

    await db.update(scanJobsTable).set({
      status: "complete",
      progress: 100,
      totalFindings: vulns.length,
      criticalCount: counts.critical,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      quantumRiskScore,
      completedAt: new Date(),
    }).where(eq(scanJobsTable.id, scanId));
  } catch (err) {
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

  // Run async (simulate 2s scan)
  setTimeout(() => simulateScan(scan.id, body.chain, body.code, body.includeQuantumAnalysis ?? true), 2000);
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
  const quantumVulns = vulns.filter(v => v.isQuantumRelated);
  const riskRating = scan.criticalCount > 0 ? "critical" : scan.highCount > 0 ? "high" : scan.mediumCount > 0 ? "medium" : "low";

  res.json({
    scanId: id,
    reportTitle: `Security Audit Report — ${scan.name}`,
    chain: scan.chain,
    executiveSummary: `This audit of ${scan.name} identified ${vulns.length} vulnerability findings across the ${scan.chain} ${scan.scanType.replace(/_/g, " ")} codebase. ${critical.length} critical and ${high.length} high severity issues require immediate remediation. ${quantumVulns.length > 0 ? `Additionally, ${quantumVulns.length} post-quantum vulnerabilities were identified with a quantum risk score of ${scan.quantumRiskScore.toFixed(1)}/100, indicating significant exposure to future quantum computing attacks.` : "No post-quantum vulnerabilities were detected."}`,
    riskRating,
    totalVulnerabilities: vulns.length,
    quantumRiskScore: scan.quantumRiskScore,
    sections: [
      { title: "Critical Findings", content: `${critical.length} critical severity vulnerabilities require immediate action before any production deployment.`, findings: critical.map(formatVuln) },
      { title: "High Severity Findings", content: `${high.length} high severity vulnerabilities should be addressed within the next development sprint.`, findings: high.map(formatVuln) },
      { title: "Post-Quantum Security Analysis", content: qa ? qa.threatSummary : "No quantum analysis performed.", findings: quantumVulns.map(formatVuln) },
      { title: "Medium & Low Findings", content: `${vulns.filter(v => v.severity === "medium" || v.severity === "low").length} medium/low severity issues noted for future remediation.`, findings: vulns.filter(v => v.severity === "medium" || v.severity === "low").map(formatVuln) },
    ],
    recommendations: [
      ...critical.map(v => v.recommendation),
      ...(qa ? qa.pqcRecommendations ?? [] : []),
    ].filter(Boolean).slice(0, 8),
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
  const avgQScore = completed.length > 0 ? completed.reduce((acc, s) => acc + s.quantumRiskScore, 0) / completed.length : 0;

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

  // Last 7 days vulnerability trend
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().split("T")[0], count: Math.floor(Math.random() * 3) };
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
    // Seed on first call
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
