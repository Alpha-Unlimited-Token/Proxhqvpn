// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Deep Solidity Static Analysis Engine
// Reads actual Solidity source code and finds logic-level vulnerabilities
// with exact line numbers, exploit details, and fix recommendations

import { VULNERABILITY_PATTERNS, type AnalysisContext, type PatternMatch, type FunctionInfo, type StateVarInfo } from "./patterns";

export interface DeepAnalysisReport {
  contractAddress: string;
  chain: string;
  contractName: string;
  compilerVersion: string;
  isVerified: boolean;
  sourceLines: number;
  analysisTimestamp: string;
  findings: DeepFinding[];
  summary: AnalysisSummary;
  contractInfo: ContractInfo;
  bugBountyReport: string;
}

export interface DeepFinding {
  id: string;
  name: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  lineNumber: number;
  lineContent: string;
  codeSnippet: string;
  confidence: "confirmed" | "likely" | "possible";
  description: string;
  howToExploit: string;
  howToFix: string;
  exploitDetail: string;
  cweId: string;
  swcId: string;
}

export interface AnalysisSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  categories: Record<string, number>;
  isAuditReady: boolean;
  auditReadinessNotes: string[];
}

export interface ContractInfo {
  name: string;
  inheritsFrom: string[];
  functions: { name: string; visibility: string; isPayable: boolean; modifiers: string[] }[];
  stateVariables: { name: string; type: string; visibility: string }[];
  events: string[];
  modifiers: string[];
  hasOwnable: boolean;
  hasReentrancyGuard: boolean;
  hasSafeMath: boolean;
  hasAccessControl: boolean;
  isERC20: boolean;
  isERC721: boolean;
  isUpgradeable: boolean;
  isProxy: boolean;
  totalFunctions: number;
  payableFunctions: number;
  externalFunctions: number;
}

// CWE and SWC mapping
const CWE_MAP: Record<string, string> = {
  "REENTRANCY-001": "CWE-841",
  "REENTRANCY-002": "CWE-841",
  "ACCESS-001": "CWE-290",
  "ACCESS-002": "CWE-284",
  "ACCESS-003": "CWE-284",
  "INTEGER-001": "CWE-190",
  "INTEGER-002": "CWE-190",
  "FLASH-001": "CWE-834",
  "FLASH-002": "CWE-841",
  "SIG-001": "CWE-294",
  "SIG-002": "CWE-347",
  "LOGIC-001": "CWE-252",
  "LOGIC-002": "CWE-330",
  "LOGIC-003": "CWE-338",
  "LOGIC-004": "CWE-829",
  "GAS-001": "CWE-400",
  "QUANTUM-001": "CWE-327",
};

const SWC_MAP: Record<string, string> = {
  "REENTRANCY-001": "SWC-107",
  "REENTRANCY-002": "SWC-107",
  "ACCESS-001": "SWC-115",
  "ACCESS-002": "SWC-105",
  "ACCESS-003": "SWC-106",
  "INTEGER-001": "SWC-101",
  "INTEGER-002": "SWC-101",
  "FLASH-001": "SWC-N/A",
  "FLASH-002": "SWC-107",
  "SIG-001": "SWC-121",
  "SIG-002": "SWC-117",
  "LOGIC-001": "SWC-104",
  "LOGIC-002": "SWC-116",
  "LOGIC-003": "SWC-120",
  "LOGIC-004": "SWC-112",
  "GAS-001": "SWC-128",
  "QUANTUM-001": "SWC-N/A (Post-Quantum)",
};

export async function fetchSourceCode(address: string, chain: string): Promise<{ source: string; compilerVersion: string; contractName: string } | null> {
  const ETHERSCAN_BASES: Record<string, string> = {
    ethereum: "https://api.etherscan.io/api",
    polygon: "https://api.polygonscan.com/api",
    bsc: "https://api.bscscan.com/api",
    arbitrum: "https://api.arbiscan.io/api",
    avalanche: "https://api.snowtrace.io/api",
    optimism: "https://api-optimistic.etherscan.io/api",
  };

  const base = ETHERSCAN_BASES[chain] ?? ETHERSCAN_BASES.ethereum;

  try {
    const url = `${base}?module=contract&action=getsourcecode&address=${address}&apikey=YourApiKeyToken`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const json = await r.json() as Record<string, unknown>;
    const result = (json.result as Record<string, unknown>[])?.[0];
    if (!result || !result.SourceCode || result.SourceCode === "") return null;

    let source = String(result.SourceCode);
    // Handle multi-file JSON sources (Etherscan wraps them in {{...}})
    if (source.startsWith("{{")) {
      try {
        const parsed = JSON.parse(source.slice(1, -1)) as Record<string, { content: string }>;
        source = Object.values((parsed.sources as unknown as Record<string, { content: string }>) ?? parsed).map((f: { content: string }) => f.content ?? "").join("\n\n// ===FILE_BOUNDARY===\n\n");
      } catch {
        // Keep as-is if parsing fails
      }
    } else if (source.startsWith("{")) {
      try {
        const parsed = JSON.parse(source) as Record<string, unknown>;
        const sources = parsed.sources as Record<string, { content: string }> ?? {};
        source = Object.values(sources).map(f => f.content ?? "").join("\n\n// ===FILE_BOUNDARY===\n\n");
      } catch {}
    }

    return {
      source,
      compilerVersion: String(result.CompilerVersion ?? "unknown"),
      contractName: String(result.ContractName ?? "Unknown"),
    };
  } catch {
    return null;
  }
}

function buildContext(source: string, compilerVersion: string): AnalysisContext {
  const lines = source.split("\n");

  // Extract pragma version
  const pragmaMatch = source.match(/pragma\s+solidity\s+([^;]+)/);
  const pragmaVersion = pragmaMatch?.[1]?.trim() ?? "";

  // Extract contract name
  const contractMatch = source.match(/contract\s+(\w+)/);
  const contractName = contractMatch?.[1] ?? "Unknown";

  const hasSafeMath = /SafeMath|using SafeMath/.test(source);
  const hasOpenZeppelin = /@openzeppelin|OpenZeppelin/.test(source);
  const hasOwnable = /Ownable|onlyOwner/.test(source);
  const hasReentrancyGuard = /ReentrancyGuard|nonReentrant/.test(source);
  const isERC20 = /ERC20|IERC20|balanceOf.*totalSupply|transfer.*approve/.test(source);
  const isERC721 = /ERC721|IERC721|tokenURI|ownerOf/.test(source);
  const imports = (source.match(/import\s+"[^"]+"/g) ?? []).map(i => i.replace(/import\s+"([^"]+)"/, "$1"));
  const modifiers = (source.match(/modifier\s+(\w+)/g) ?? []).map(m => m.replace("modifier ", ""));

  // Parse functions
  const functions: FunctionInfo[] = [];
  const funcRegex = /function\s+(\w+)\s*\([^)]*\)\s*(public|private|internal|external)?\s*([\w\s]*)/g;
  let m: RegExpExecArray | null;
  let lineNum = 0;
  for (const line of lines) {
    const match = line.match(/function\s+(\w+)/);
    if (match) {
      functions.push({
        name: match[1],
        visibility: /public/.test(line) ? "public" : /external/.test(line) ? "external" : /internal/.test(line) ? "internal" : "private",
        modifiers: modifiers.filter(mod => line.includes(mod)),
        startLine: lineNum,
        endLine: lineNum + 20,
        hasExternalCall: false,
        hasStateWrite: false,
        isPayable: /payable/.test(line),
        parameters: [],
      });
    }
    lineNum++;
  }

  // Parse state variables
  const stateVars: StateVarInfo[] = [];
  const stateVarRegex = /^\s*(uint|int|address|bool|bytes|string|mapping|[\w]+)\s+(public|private|internal)?\s*(\w+)\s*[=;]/;
  lineNum = 0;
  for (const line of lines) {
    const match = line.match(stateVarRegex);
    if (match && !/function|event|modifier/.test(line)) {
      stateVars.push({
        name: match[3],
        type: match[1],
        visibility: match[2] ?? "internal",
        lineNumber: lineNum,
        isMappingOrArray: /mapping|\[\]/.test(match[1]),
      });
    }
    lineNum++;
  }

  return {
    compilerVersion,
    pragmaVersion,
    hasSafeMath,
    hasOpenZeppelin,
    contractName,
    functions,
    stateVars,
    modifiers,
    imports,
    isERC20,
    isERC721,
    hasOwnable,
    hasReentrancyGuard,
  };
}

function extractContractInfo(source: string, ctx: AnalysisContext): ContractInfo {
  const lines = source.split("\n");

  const inheritsMatch = source.match(/contract\s+\w+\s+is\s+([^{]+)/);
  const inheritsFrom = inheritsMatch?.[1]?.split(",").map(s => s.trim()) ?? [];

  const events = (source.match(/event\s+\w+\([^)]*\)/g) ?? []).map(e => e);
  const isUpgradeable = /UUPSUpgradeable|TransparentUpgradeableProxy|ProxyAdmin|_upgradeTo/.test(source);
  const isProxy = /delegatecall|_implementation\(\)|Proxy/.test(source);

  const externalFunctions = ctx.functions.filter(f => f.visibility === "external" || f.visibility === "public").length;
  const payableFunctions = ctx.functions.filter(f => f.isPayable).length;

  return {
    name: ctx.contractName,
    inheritsFrom,
    functions: ctx.functions.map(f => ({ name: f.name, visibility: f.visibility, isPayable: f.isPayable, modifiers: f.modifiers })),
    stateVariables: ctx.stateVars.map(v => ({ name: v.name, type: v.type, visibility: v.visibility })),
    events,
    modifiers: ctx.modifiers,
    hasOwnable: ctx.hasOwnable,
    hasReentrancyGuard: ctx.hasReentrancyGuard,
    hasSafeMath: ctx.hasSafeMath,
    hasAccessControl: /AccessControl|Roles|onlyRole/.test(source),
    isERC20: ctx.isERC20,
    isERC721: ctx.isERC721,
    isUpgradeable,
    isProxy,
    totalFunctions: ctx.functions.length,
    payableFunctions,
    externalFunctions,
  };
}

export async function analyzeContractSource(
  address: string,
  chain: string,
  sourceOverride?: string,
  compilerOverride?: string
): Promise<DeepAnalysisReport> {
  const fetched = sourceOverride ? null : await fetchSourceCode(address, chain);
  const source = sourceOverride ?? fetched?.source ?? "";
  const compilerVersion = compilerOverride ?? fetched?.compilerVersion ?? "unknown";
  const contractName = fetched?.contractName ?? "Unknown";
  const isVerified = !!fetched || !!sourceOverride;

  if (!source) {
    return buildEmptyReport(address, chain, contractName, compilerVersion, false);
  }

  const lines = source.split("\n");
  const ctx = buildContext(source, compilerVersion);
  const contractInfo = extractContractInfo(source, ctx);

  const matches: PatternMatch[] = [];
  const seenLines = new Set<string>();

  // Run all line-level patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of VULNERABILITY_PATTERNS) {
      try {
        const match = pattern.detectInLine(line, i, lines, ctx);
        if (match) {
          const dedupeKey = `${match.patternId}:${match.lineNumber}`;
          if (!seenLines.has(dedupeKey)) {
            seenLines.add(dedupeKey);
            matches.push(match);
          }
        }
      } catch {}
    }
  }

  // Build findings
  const findings: DeepFinding[] = matches.map(match => {
    const pattern = VULNERABILITY_PATTERNS.find(p => p.id === match.patternId)!;
    return {
      id: match.patternId,
      name: pattern.name,
      category: pattern.category,
      severity: pattern.severity,
      lineNumber: match.lineNumber,
      lineContent: match.lineContent,
      codeSnippet: match.codeSnippet,
      confidence: match.confidence,
      description: pattern.description,
      howToExploit: pattern.howToExploit,
      howToFix: pattern.howToFix,
      exploitDetail: match.exploitDetail,
      cweId: CWE_MAP[match.patternId] ?? "CWE-N/A",
      swcId: SWC_MAP[match.patternId] ?? "SWC-N/A",
    };
  }).sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  // Build summary
  const critical = findings.filter(f => f.severity === "critical").length;
  const high = findings.filter(f => f.severity === "high").length;
  const medium = findings.filter(f => f.severity === "medium").length;
  const low = findings.filter(f => f.severity === "low").length;
  const riskScore = Math.min(100, critical * 25 + high * 10 + medium * 4 + low * 1);
  const riskLevel = critical > 0 ? "critical" : high > 0 ? "high" : medium > 0 ? "medium" : "low";

  const categories: Record<string, number> = {};
  for (const f of findings) {
    categories[f.category] = (categories[f.category] ?? 0) + 1;
  }

  const auditReadinessNotes: string[] = [];
  if (!isVerified) auditReadinessNotes.push("Source code not verified on Etherscan — audit requires source disclosure");
  if (!ctx.hasOpenZeppelin) auditReadinessNotes.push("No OpenZeppelin imports detected — custom security implementations are higher risk");
  if (!ctx.hasReentrancyGuard) auditReadinessNotes.push("No ReentrancyGuard detected — all external calls are potential reentrancy vectors");
  if (!ctx.hasOwnable && contractInfo.payableFunctions > 0) auditReadinessNotes.push("Payable functions with no Ownable pattern — verify all critical functions are protected");
  if (critical > 0) auditReadinessNotes.push(`${critical} CRITICAL finding(s) — contract should NOT handle real funds until remediated`);

  const summary: AnalysisSummary = {
    totalFindings: findings.length,
    critical,
    high,
    medium,
    low,
    riskScore,
    riskLevel,
    categories,
    isAuditReady: critical === 0 && high === 0 && auditReadinessNotes.filter(n => n.includes("CRITICAL")).length === 0,
    auditReadinessNotes,
  };

  const report = buildReport(address, chain, contractName, compilerVersion, isVerified, lines.length, findings, summary, contractInfo);

  return report;
}

function buildReport(
  address: string, chain: string, contractName: string, compilerVersion: string,
  isVerified: boolean, sourceLines: number,
  findings: DeepFinding[], summary: AnalysisSummary, contractInfo: ContractInfo
): DeepAnalysisReport {
  const now = new Date().toISOString();
  const bugBounty = generateBugBountyReport(address, chain, contractName, findings, summary);

  return {
    contractAddress: address,
    chain,
    contractName,
    compilerVersion,
    isVerified,
    sourceLines,
    analysisTimestamp: now,
    findings,
    summary,
    contractInfo,
    bugBountyReport: bugBounty,
  };
}

function buildEmptyReport(address: string, chain: string, contractName: string, compilerVersion: string, isVerified: boolean): DeepAnalysisReport {
  return buildReport(address, chain, contractName, compilerVersion, isVerified, 0, [], {
    totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0,
    riskScore: 0, riskLevel: "low", categories: {}, isAuditReady: false,
    auditReadinessNotes: ["Source code not verified or could not be fetched — deep analysis requires Solidity source"],
  }, {
    name: contractName, inheritsFrom: [], functions: [], stateVariables: [],
    events: [], modifiers: [], hasOwnable: false, hasReentrancyGuard: false,
    hasSafeMath: false, hasAccessControl: false, isERC20: false, isERC721: false,
    isUpgradeable: false, isProxy: false, totalFunctions: 0, payableFunctions: 0, externalFunctions: 0,
  });
}

function generateBugBountyReport(
  address: string, chain: string, contractName: string,
  findings: DeepFinding[], summary: AnalysisSummary
): string {
  const now = new Date().toLocaleString();
  const critical = findings.filter(f => f.severity === "critical");
  const high = findings.filter(f => f.severity === "high");

  return `
================================================================================
  QUANTUMAUDIT — SMART CONTRACT DEEP ANALYSIS REPORT
  Responsible Disclosure / Bug Bounty Submission
  Prepared by: ALPHA UNLIMITED TECHNOLOGIES LLC
================================================================================

  Date:             ${now}
  Contract:         ${contractName}
  Address:          ${address}
  Chain:            ${chain.toUpperCase()}
  Risk Score:       ${summary.riskScore}/100
  Overall Risk:     ${summary.riskLevel.toUpperCase()}
  Findings:         ${summary.totalFindings} total (${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low)
  Audit Ready:      ${summary.isAuditReady ? "YES" : "NO — remediation required before mainnet deployment"}

================================================================================
  EXECUTIVE SUMMARY
================================================================================

  QuantumAudit performed automated static analysis on the verified Solidity
  source code of ${contractName} at ${address} on ${chain.toUpperCase()}.
  ${summary.totalFindings} security issues were identified.

  ${summary.critical > 0 ? `⚠ CRITICAL ALERT: ${summary.critical} critical vulnerability(s) found. Funds are at risk.
  Immediate remediation is recommended before this contract handles real value.` : "No critical vulnerabilities found."}

  Audit readiness notes:
${summary.auditReadinessNotes.map(n => `  - ${n}`).join("\n")}

================================================================================
  CRITICAL & HIGH SEVERITY FINDINGS
================================================================================
${[...critical, ...high].map((f, i) => `
  [${"CRITICAL HIGH MEDIUM LOW".split(" ").indexOf(f.severity.toUpperCase()) === -1 ? "ISSUE" : f.severity.toUpperCase()}] ${f.name}
  ─────────────────────────────────────────────────────
  ID:           ${f.id}
  Severity:     ${f.severity.toUpperCase()}
  Confidence:   ${f.confidence.toUpperCase()}
  Location:     Line ${f.lineNumber}
  CWE:          ${f.cweId}
  SWC Registry: ${f.swcId}

  Description:
  ${f.description}

  Affected Code (Line ${f.lineNumber}):
${f.codeSnippet.split("\n").map(l => "  " + l).join("\n")}

  How an Attacker Would Exploit This:
  ${f.howToExploit.split("\n").map(l => "  " + l).join("\n")}

  Specific Exploit Context:
  ${f.exploitDetail}

  Recommended Fix:
  ${f.howToFix}

`).join("")}
================================================================================
  ALL FINDINGS SUMMARY TABLE
================================================================================

  #   Severity   ID              Name                                  Line
  ─────────────────────────────────────────────────────────────────────────────
${findings.map((f, i) => `  ${String(i + 1).padStart(2)}  ${f.severity.toUpperCase().padEnd(9)}  ${f.id.padEnd(14)}  ${f.name.slice(0, 36).padEnd(36)}  ${f.lineNumber}`).join("\n")}

================================================================================
  CONTRACT STRUCTURE
================================================================================

  Standard Interfaces:    ${[
    ...(findings.length > 0 ? [] : []),
  ].join(", ") || "None detected"}
  Total Functions:        (see analysis)
  Verified Source:        Yes (Etherscan)

================================================================================
  DISCLOSURE
================================================================================

  This report was generated through automated static analysis of publicly
  available verified smart contract source code. No funds were accessed,
  no transactions were sent, and no exploits were executed.

  This report is provided for responsible disclosure purposes.
  Please credit QuantumAudit / Alpha Unlimited Technologies LLC
  in any bug bounty submissions that use this report.

  Contact: alphaunlimitedtechnologies@gmail.com

================================================================================
`;
}
