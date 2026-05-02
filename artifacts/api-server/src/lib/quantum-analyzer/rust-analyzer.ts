// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { AnalysisFinding } from "./solidity-analyzer";

// ─── Solana/Rust Static Analyzer ──────────────────────────────────────────────
// Uses regex + pattern matching on Rust source code for Solana programs

interface RustPattern {
  name: string;
  pattern: RegExp;
  title: string;
  description: string;
  severity: AnalysisFinding["severity"];
  category: AnalysisFinding["category"];
  isQuantumRelated: boolean;
  cweId: string;
  cvssScore: number;
  recommendation: string;
  references: string[];
}

const SOLANA_PATTERNS: RustPattern[] = [
  {
    name: "missing_signer_check",
    pattern: /fn\s+\w+\s*\([^)]*ctx\s*:\s*Context[^)]*\)[^{]*\{(?:[^}]|\{[^}]*\})*\}/gs,
    title: "Missing Signer Verification",
    description: "Solana instruction handler does not verify that the required accounts are signers. Without `#[account(signer)]` or manual `is_signer` checks, any account can be passed as an authority, allowing unauthorized state mutation.",
    severity: "high",
    category: "access_control",
    isQuantumRelated: false,
    cweId: "CWE-284",
    cvssScore: 8.0,
    recommendation: "Use Anchor's `#[account(signer)]` constraint or manually check `account.is_signer` before performing privileged operations. All authority accounts should have the `Signer` type in Anchor.",
    references: ["https://docs.rs/anchor-lang/latest/anchor_lang/", "https://github.com/coral-xyz/anchor"],
  },
  {
    name: "arbitrary_cpi",
    pattern: /invoke\s*\(\s*&[^,]+,\s*&\[/g,
    title: "Arbitrary CPI (Cross-Program Invocation) Risk",
    description: "The program performs a Cross-Program Invocation (CPI) using `invoke()`. If the target program ID is not validated against a known trusted address, an attacker can substitute a malicious program that executes arbitrary code.",
    severity: "critical",
    category: "access_control",
    isQuantumRelated: false,
    cweId: "CWE-829",
    cvssScore: 9.5,
    recommendation: "Validate the target program ID before invoking. Use `require_keys_eq!(cpi_program.key(), expected_program_id)`. Only invoke whitelisted, known program addresses.",
    references: ["https://docs.solana.com/developing/programming-model/calling-between-programs"],
  },
  {
    name: "missing_owner_check",
    pattern: /account\.owner(?!\s*==)/g,
    title: "Missing Account Owner Check",
    description: "Account owner is read but not validated against the expected program ID. Without `owner == expected_program_id`, a fake account owned by a different program can be passed in, leading to data corruption or privilege escalation.",
    severity: "high",
    category: "access_control",
    isQuantumRelated: false,
    cweId: "CWE-284",
    cvssScore: 7.8,
    recommendation: "Add `require_keys_eq!(account.owner, expected_program_id)` or use Anchor's `#[account(owner = program_id)]` constraint.",
    references: ["https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html"],
  },
  {
    name: "integer_arithmetic",
    pattern: /\b(u64|u128|i64|i128|u32)\b[^;]*[+\-\*][^;]*(?!checked_)/g,
    title: "Unchecked Integer Arithmetic (Potential Overflow)",
    description: "Arithmetic on integer types without using Rust's checked math methods. In release builds, Rust integer overflow wraps around silently (in debug mode it panics). Token transfer amounts, balance calculations, and timestamps are particularly dangerous.",
    severity: "high",
    category: "overflow",
    isQuantumRelated: false,
    cweId: "CWE-190",
    cvssScore: 7.5,
    recommendation: "Use checked arithmetic: `.checked_add()`, `.checked_sub()`, `.checked_mul()` and propagate the error. For token math, use saturating arithmetic or explicit overflow checks.",
    references: ["https://doc.rust-lang.org/std/primitive.u64.html#method.checked_add"],
  },
  {
    name: "ed25519_quantum",
    pattern: /ed25519|secp256k1|Keypair::generate|Pubkey::new|verify_signature/g,
    title: "Ed25519 / Secp256k1 Signature Scheme — Quantum Vulnerability",
    description: "This Solana program uses Ed25519 or secp256k1 cryptographic primitives. Both rely on the elliptic curve discrete logarithm problem (ECDLP), which Shor's algorithm can solve in polynomial time. A quantum computer with ~4,000 logical qubits can recover private keys from exposed public keys.",
    severity: "critical",
    category: "elliptic_curve",
    isQuantumRelated: true,
    cweId: "CWE-327",
    cvssScore: 9.5,
    recommendation: "Monitor Solana Foundation's post-quantum roadmap. Plan migration to CRYSTALS-Dilithium or SPHINCS+ hybrid signatures when protocol support is available. Implement address rotation policies for critical program authorities.",
    references: [
      "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf",
      "https://solana.com/developers",
    ],
  },
  {
    name: "hash_function",
    pattern: /keccak256|sha256|hash::/g,
    title: "Hash Function Usage — Grover's Algorithm Exposure",
    description: "SHA-256 and Keccak-256 hash functions used in this program provide only 128-bit post-quantum security (halved from 256-bit by Grover's algorithm). Commitment schemes and Merkle proofs built on these functions have reduced long-term security margins against quantum adversaries.",
    severity: "medium",
    category: "hash_collision",
    isQuantumRelated: true,
    cweId: "CWE-916",
    cvssScore: 5.9,
    recommendation: "For long-term critical commitments, use SHA-512 or SHAKE-256 with 512-bit output. Document quantum security assumptions in any protocol using Merkle trees or hash-based commitments.",
    references: ["https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"],
  },
  {
    name: "unsafe_block",
    pattern: /unsafe\s*\{/g,
    title: "Unsafe Rust Block",
    description: "The program contains `unsafe {}` blocks which bypass Rust's memory safety guarantees. In a Solana program, unsafe code that corrupts account data or violates memory invariants can cause the validator to crash or allow data manipulation.",
    severity: "high",
    category: "logic_error",
    isQuantumRelated: false,
    cweId: "CWE-787",
    cvssScore: 7.2,
    recommendation: "Eliminate unsafe blocks wherever possible. If unsafe is necessary, document the safety invariants maintained. Use `#[forbid(unsafe_code)]` at the crate level to prevent accidental unsafe usage.",
    references: ["https://doc.rust-lang.org/reference/unsafe-code.html"],
  },
  {
    name: "unvalidated_account_data",
    pattern: /try_from_slice\s*\(&[^)]+\.data\.borrow\(\)/g,
    title: "Unvalidated Account Data Deserialization",
    description: "Account data is deserialized with `try_from_slice` without prior owner or discriminator validation. An attacker can create a fake account with arbitrary data that passes deserialization, leading to type confusion or privilege escalation.",
    severity: "high",
    category: "logic_error",
    isQuantumRelated: false,
    cweId: "CWE-20",
    cvssScore: 7.5,
    recommendation: "Always validate account ownership and data discriminator before deserializing. Use Anchor's account discriminator system (`#[account]` macro) which automatically validates the 8-byte discriminator.",
    references: ["https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html"],
  },
];

function findPatternInCode(code: string, pattern: RegExp): Array<{ line: number; snippet: string }> {
  const matches: Array<{ line: number; snippet: string }> = [];
  const lines = code.split("\n");

  // Use line-by-line search for non-multiline patterns
  if (!pattern.flags.includes("s")) {
    lines.forEach((line, i) => {
      const singleLine = new RegExp(pattern.source, pattern.flags.replace("g", ""));
      if (singleLine.test(line)) {
        matches.push({
          line: i + 1,
          snippet: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 4)).join("\n").trim().substring(0, 300),
        });
      }
    });
  } else {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split("\n").length;
      matches.push({
        line: lineNum,
        snippet: match[0].substring(0, 300),
      });
      if (!pattern.flags.includes("g")) break;
    }
  }

  return matches;
}

export function analyzeRust(code: string): {
  findings: AnalysisFinding[];
  functionCount: number;
  lineCount: number;
} {
  const findings: AnalysisFinding[] = [];
  const lineCount = code.split("\n").length;

  // Count functions
  const fnMatches = code.match(/\bfn\s+\w+/g) ?? [];
  const functionCount = fnMatches.length;

  for (const p of SOLANA_PATTERNS) {
    const regex = new RegExp(p.pattern.source, p.pattern.flags);
    const hits = findPatternInCode(code, regex);

    if (hits.length > 0) {
      // Report first occurrence
      const first = hits[0];
      findings.push({
        title: p.title,
        description: p.description,
        severity: p.severity,
        category: p.category,
        isQuantumRelated: p.isQuantumRelated,
        cweId: p.cweId,
        cvssScore: p.cvssScore,
        affectedCode: first.snippet,
        lineNumber: first.line,
        recommendation: p.recommendation,
        references: p.references,
      });
    }
  }

  return { findings, functionCount, lineCount };
}
