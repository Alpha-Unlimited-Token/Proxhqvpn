// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, real, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";

export const scanStatusEnum = pgEnum("scan_status", ["pending", "running", "complete", "failed"]);
export const blockchainChainEnum = pgEnum("blockchain_chain", ["ethereum", "bitcoin", "solana", "polygon", "avalanche", "arbitrum", "bsc", "generic"]);
export const scanTypeEnum = pgEnum("scan_type", ["smart_contract", "protocol", "consensus", "cryptography", "all"]);
export const auditSeverityEnum = pgEnum("audit_severity", ["critical", "high", "medium", "low", "informational"]);
export const vulnCategoryEnum = pgEnum("vuln_category", [
  "reentrancy", "overflow", "access_control", "quantum_crypto", "weak_randomness",
  "front_running", "denial_of_service", "logic_error", "consensus_attack",
  "signature_malleability", "hash_collision", "elliptic_curve",
  "timestamp_dependence", "gas_limit", "other"
]);
export const quantumAlgorithmEnum = pgEnum("quantum_algorithm", ["shors", "grovers", "hybrid", "bqp_complete"]);
export const quantumRiskEnum = pgEnum("quantum_risk", ["critical", "high", "medium", "low", "safe"]);

export const scanJobsTable = pgTable("scan_jobs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  chain: blockchainChainEnum("chain").notNull(),
  scanType: scanTypeEnum("scan_type").notNull(),
  code: text("code"),
  contractAddress: text("contract_address"),
  includeQuantumAnalysis: boolean("include_quantum_analysis").notNull().default(true),
  status: scanStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  totalFindings: integer("total_findings").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  quantumRiskScore: real("quantum_risk_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const vulnerabilitiesTable = pgTable("vulnerabilities", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull().references(() => scanJobsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: auditSeverityEnum("severity").notNull(),
  category: vulnCategoryEnum("category").notNull(),
  isQuantumRelated: boolean("is_quantum_related").notNull().default(false),
  cweId: text("cwe_id"),
  cvssScore: real("cvss_score"),
  affectedCode: text("affected_code"),
  lineNumber: integer("line_number"),
  recommendation: text("recommendation").notNull(),
  references: text("references").array(),
});

export const quantumAnalysesTable = pgTable("quantum_analyses", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull().references(() => scanJobsTable.id, { onDelete: "cascade" }),
  overallRisk: quantumRiskEnum("overall_risk").notNull(),
  riskScore: real("risk_score").notNull(),
  ellipticCurveVulnerable: boolean("elliptic_curve_vulnerable").notNull().default(false),
  hashFunctionVulnerable: boolean("hash_function_vulnerable").notNull().default(false),
  signatureSchemeVulnerable: boolean("signature_scheme_vulnerable").notNull().default(false),
  estimatedBreakYear: text("estimated_break_year"),
  shorsAlgorithmApplicable: boolean("shors_algorithm_applicable").notNull().default(false),
  groversAlgorithmApplicable: boolean("grovers_algorithm_applicable").notNull().default(false),
  pqcRecommendations: text("pqc_recommendations").array(),
  threatSummary: text("threat_summary").notNull(),
});

// ── Autonomous Batch Scanner (Head Admin Only) ────────────────────────────────
export const batchScanJobsTable = pgTable("batch_scan_jobs", {
  id:               serial("id").primaryKey(),
  name:             text("name").notNull(),
  sourceName:       text("source_name"),           // original filename(s)
  status:           text("status").notNull().default("pending"), // pending | running | paused | completed | cancelled | failed
  totalTargets:     integer("total_targets").notNull().default(0),
  completedCount:   integer("completed_count").notNull().default(0),
  vulnerableCount:  integer("vulnerable_count").notNull().default(0),
  cleanCount:       integer("clean_count").notNull().default(0),
  errorCount:       integer("error_count").notNull().default(0),
  cursor:           integer("cursor").notNull().default(0),     // next target index to process
  targetsFile:      text("targets_file"),           // path to on-disk target list file
  reportDir:        text("report_dir"),             // path to saved report directory
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  startedAt:        timestamp("started_at"),
  completedAt:      timestamp("completed_at"),
  lastError:        text("last_error"),
});

export const batchScanResultsTable = pgTable("batch_scan_results", {
  id:                 serial("id").primaryKey(),
  jobId:              integer("job_id").notNull().references(() => batchScanJobsTable.id, { onDelete: "cascade" }),
  target:             text("target").notNull(),
  detectedChain:      text("detected_chain"),
  displayName:        text("display_name"),
  schemeLabel:        text("scheme_label"),
  signatureScheme:    text("signature_scheme"),
  hasVulnerability:   boolean("has_vulnerability").notNull().default(false),
  vulnerabilityCount: integer("vulnerability_count").notNull().default(0),
  sharedRValue:       text("shared_r_value"),
  scanError:          text("scan_error"),
  execMs:             integer("exec_ms"),
  scannedAt:          timestamp("scanned_at").notNull().defaultNow(),
  rawResult:          jsonb("raw_result"),
});

export const quantumThreatsTable = pgTable("quantum_threats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  algorithm: quantumAlgorithmEnum("algorithm").notNull(),
  affectedChains: text("affected_chains").array().notNull(),
  description: text("description").notNull(),
  technicalDetail: text("technical_detail").notNull(),
  estimatedQubitsNeeded: integer("estimated_qubits_needed"),
  currentlyFeasible: boolean("currently_feasible").notNull().default(false),
  estimatedFeasibleYear: text("estimated_feasible_year"),
  mitigation: text("mitigation").notNull(),
  pqcAlternatives: text("pqc_alternatives").array().notNull(),
  severity: auditSeverityEnum("severity").notNull(),
});
