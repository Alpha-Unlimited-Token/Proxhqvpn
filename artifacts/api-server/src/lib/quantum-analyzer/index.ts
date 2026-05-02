// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { analyzeSolidity, type AnalysisFinding } from "./solidity-analyzer";
import { analyzeRust } from "./rust-analyzer";
import { analyzeBitcoinScript, analyzeGenericEvm, analyzeProtocol } from "./generic-analyzer";

export type { AnalysisFinding };

export interface ScanCodeResult {
  findings: AnalysisFinding[];
  parseError: string | null;
  contractNames: string[];
  functionCount: number;
  lineCount: number;
  language: string;
  analyzedWith: string;
}

// Detect language from code content and chain
function detectLanguage(code: string, chain: string): "solidity" | "rust" | "vyper" | "bitcoin_script" | "generic" {
  const lower = code.toLowerCase().trim();

  // Solidity detection
  if (
    lower.includes("pragma solidity") ||
    lower.includes("contract ") ||
    lower.includes("function ") && (lower.includes("public") || lower.includes("external")) ||
    lower.includes("mapping(") ||
    lower.includes("msg.sender") ||
    lower.includes("emit ") ||
    lower.includes("modifier ")
  ) {
    return "solidity";
  }

  // Rust/Solana detection
  if (
    lower.includes("use anchor_lang") ||
    lower.includes("use solana_program") ||
    lower.includes("#[program]") ||
    lower.includes("fn process_instruction") ||
    (chain === "solana" && (lower.includes("fn ") || lower.includes("pub mod ")))
  ) {
    return "rust";
  }

  // Bitcoin Script detection
  if (
    lower.includes("op_checksig") ||
    lower.includes("op_multisig") ||
    lower.includes("op_return") ||
    lower.includes("op_hash160") ||
    lower.includes("op_if") ||
    chain === "bitcoin"
  ) {
    return "bitcoin_script";
  }

  // Vyper
  if (lower.includes("@external") || lower.includes("@internal") || lower.includes("def __init__")) {
    return "vyper"; // Fall through to generic EVM
  }

  return "generic";
}

export function analyzeCode(code: string, chain: string, scanType: string): ScanCodeResult {
  const language = detectLanguage(code, chain);

  if (language === "solidity") {
    const result = analyzeSolidity(code);
    return {
      findings: result.findings,
      parseError: result.parseError,
      contractNames: result.contractNames,
      functionCount: result.functionCount,
      lineCount: result.lineCount,
      language: "Solidity",
      analyzedWith: "Solidity AST Parser + 12-detector static analysis engine",
    };
  }

  if (language === "rust") {
    const result = analyzeRust(code);
    return {
      findings: result.findings,
      parseError: null,
      contractNames: [],
      functionCount: result.functionCount,
      lineCount: result.lineCount,
      language: "Rust (Solana)",
      analyzedWith: "Solana program pattern analyzer (8 detectors)",
    };
  }

  if (language === "bitcoin_script") {
    const result = analyzeBitcoinScript(code);
    return {
      findings: result.findings,
      parseError: null,
      contractNames: [],
      functionCount: 0,
      lineCount: result.lineCount,
      language: "Bitcoin Script",
      analyzedWith: "Bitcoin Script opcode analyzer (6 detectors)",
    };
  }

  // Protocol / consensus scan or generic EVM
  if (scanType === "protocol" || scanType === "consensus" || scanType === "cryptography") {
    const result = analyzeProtocol(code, chain);
    return {
      findings: result.findings,
      parseError: null,
      contractNames: [],
      functionCount: 0,
      lineCount: result.lineCount,
      language: "Protocol/Consensus Layer",
      analyzedWith: "Protocol + consensus quantum threat analyzer",
    };
  }

  // Fallback: generic EVM bytecode / solidity-like
  const result = analyzeGenericEvm(code);
  return {
    findings: result.findings,
    parseError: null,
    contractNames: [],
    functionCount: 0,
    lineCount: result.lineCount,
    language: language === "vyper" ? "Vyper" : "Generic EVM",
    analyzedWith: "Generic EVM pattern analyzer (5 detectors)",
  };
}
