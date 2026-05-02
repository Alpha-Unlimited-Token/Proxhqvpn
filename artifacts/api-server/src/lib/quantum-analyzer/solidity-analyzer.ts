// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import * as parser from "@solidity-parser/parser";
import type { ASTNode } from "@solidity-parser/parser";

export interface AnalysisFinding {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  category:
    | "reentrancy" | "overflow" | "access_control" | "quantum_crypto"
    | "weak_randomness" | "front_running" | "denial_of_service"
    | "logic_error" | "consensus_attack" | "signature_malleability"
    | "hash_collision" | "elliptic_curve" | "timestamp_dependence"
    | "gas_limit" | "other";
  isQuantumRelated: boolean;
  cweId: string;
  cvssScore: number;
  affectedCode: string | null;
  lineNumber: number | null;
  recommendation: string;
  references: string[];
}

// ─── Visitor helpers ──────────────────────────────────────────────────────────

function visit(node: any, visitors: Record<string, (n: any) => void>): void {
  if (!node || typeof node !== "object") return;
  if (visitors[node.type]) visitors[node.type](node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) child.forEach(c => visit(c, visitors));
    else if (child && typeof child === "object" && child.type) visit(child, visitors);
  }
}

function getLine(node: any): number | null {
  return node?.loc?.start?.line ?? null;
}

function extractSnippet(code: string, line: number | null, context = 3): string {
  if (!line) return "";
  const lines = code.split("\n");
  const start = Math.max(0, line - context - 1);
  const end = Math.min(lines.length, line + context);
  return lines.slice(start, end).join("\n").trim().substring(0, 400);
}

// ─── Individual detectors ─────────────────────────────────────────────────────

function detectReentrancy(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  visit(ast, {
    FunctionDefinition(fn: any) {
      const stateWrites: number[] = [];
      const externalCalls: number[] = [];

      visit(fn, {
        ExpressionStatement(stmt: any) {
          const expr = stmt.expression;
          // Detect external calls: address.call{}, .transfer(), .send()
          if (
            expr?.type === "FunctionCall" &&
            (
              expr.expression?.memberName === "call" ||
              expr.expression?.memberName === "transfer" ||
              expr.expression?.memberName === "send" ||
              expr.expression?.memberName === "delegatecall" ||
              expr.expression?.memberName === "staticcall"
            )
          ) {
            externalCalls.push(getLine(stmt) ?? 0);
          }
          // Detect state writes after external calls (assignment to storage variable)
          if (
            expr?.type === "BinaryOperation" && expr.operator === "=" ||
            expr?.type === "StateVariableDeclarationStatement"
          ) {
            stateWrites.push(getLine(stmt) ?? 0);
          }
        },
        // Detect balances[msg.sender] = 0 style state updates
        BinaryOperation(node: any) {
          if (node.operator === "-=" || node.operator === "+=") {
            stateWrites.push(getLine(node) ?? 0);
          }
        },
      });

      // If external call appears BEFORE a state write — reentrancy
      for (const callLine of externalCalls) {
        const writesAfterCall = stateWrites.filter(w => w > callLine);
        if (writesAfterCall.length > 0) {
          findings.push({
            title: `Reentrancy Vulnerability in \`${fn.name ?? "anonymous"}\``,
            description: `Function \`${fn.name ?? "anonymous"}\` makes an external call (line ${callLine}) before updating contract state (line ${writesAfterCall[0]}). This allows a malicious contract to re-enter and drain funds or manipulate state before the original call completes.`,
            severity: "critical",
            category: "reentrancy",
            isQuantumRelated: false,
            cweId: "CWE-841",
            cvssScore: 9.8,
            affectedCode: extractSnippet(code, callLine),
            lineNumber: callLine,
            recommendation: "Apply the Checks-Effects-Interactions pattern: update all state variables before making external calls. Use OpenZeppelin's ReentrancyGuard modifier as a defense-in-depth measure.",
            references: [
              "https://swcregistry.io/docs/SWC-107",
              "https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard",
            ],
          });
          break; // one finding per function
        }
      }
    },
  });

  return findings;
}

function detectUncheckedMath(ast: any, code: string, pragmaVersion: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  // Overflow is checked by default in Solidity >=0.8.0
  const isOldSolidity = pragmaVersion && (
    pragmaVersion.includes("0.4.") ||
    pragmaVersion.includes("0.5.") ||
    pragmaVersion.includes("0.6.") ||
    pragmaVersion.includes("0.7.")
  );

  if (!isOldSolidity) {
    // Still check for `unchecked {}` blocks in 0.8+
    visit(ast, {
      UncheckedStatement(node: any) {
        const line = getLine(node);
        findings.push({
          title: "Arithmetic in `unchecked` Block",
          description: "Arithmetic operations inside an `unchecked` block bypass Solidity 0.8.x overflow/underflow protection. If the unchecked block is not carefully audited, integer wraparound can cause critical accounting errors.",
          severity: "high",
          category: "overflow",
          isQuantumRelated: false,
          cweId: "CWE-190",
          cvssScore: 7.8,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Document every `unchecked` block with a proof that overflow cannot occur. Prefer removing `unchecked` unless gas optimization is critical and the invariant is provably safe.",
          references: ["https://swcregistry.io/docs/SWC-101", "https://docs.soliditylang.org/en/v0.8.0/control-structures.html#checked-or-unchecked-arithmetic"],
        });
      },
    });
    return findings;
  }

  // Old Solidity — flag all arithmetic operations
  const arithmeticOps = ["+", "-", "*", "**"];
  const flaggedLines = new Set<number>();
  visit(ast, {
    BinaryOperation(node: any) {
      if (arithmeticOps.includes(node.operator)) {
        const line = getLine(node);
        if (line && !flaggedLines.has(line)) {
          flaggedLines.add(line);
          findings.push({
            title: "Integer Overflow/Underflow Risk (Solidity < 0.8)",
            description: `Arithmetic operation '${node.operator}' at line ${line} is unchecked. In Solidity versions before 0.8.0, integer arithmetic silently wraps around on overflow/underflow, which can lead to token minting exploits or fund manipulation.`,
            severity: "high",
            category: "overflow",
            isQuantumRelated: false,
            cweId: "CWE-190",
            cvssScore: 8.1,
            affectedCode: extractSnippet(code, line),
            lineNumber: line,
            recommendation: "Use OpenZeppelin SafeMath library or upgrade to Solidity >=0.8.0 where overflow checks are built in.",
            references: ["https://swcregistry.io/docs/SWC-101"],
          });
        }
      }
    },
  });

  return findings.slice(0, 2); // Limit to first 2 to avoid noise
}

function detectAccessControl(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  visit(ast, {
    FunctionDefinition(fn: any) {
      if (fn.visibility !== "public" && fn.visibility !== "external") return;
      if (fn.stateMutability === "view" || fn.stateMutability === "pure") return;

      const modifiers = (fn.modifiers ?? []).map((m: any) => m.name?.toLowerCase?.() ?? "");
      const hasAccessControl = modifiers.some(m =>
        ["onlyowner", "onlyadmin", "onlyrole", "requiresauth", "authorized",
          "hasrole", "onlygovernance", "restricted"].includes(m) ||
        m.startsWith("only") || m.startsWith("require") || m.includes("auth")
      );

      // Check for require(msg.sender == ...) in the function body
      let hasRequireSender = false;
      visit(fn.body, {
        FunctionCall(call: any) {
          const name = call.expression?.name ?? call.expression?.namePath ?? "";
          if (name === "require" || name === "assert") {
            const arg = call.arguments?.[0];
            visit(arg, {
              BinaryOperation(op: any) {
                const left = op.left?.expression?.memberName ?? op.left?.name ?? "";
                const right = op.right?.expression?.memberName ?? op.right?.name ?? "";
                if (left === "sender" || right === "sender") hasRequireSender = true;
              },
            });
          }
        },
      });

      // Flag functions that write state but have no access control
      let writesState = false;
      visit(fn.body, {
        ExpressionStatement(stmt: any) {
          const expr = stmt.expression;
          if (
            expr?.type === "BinaryOperation" && expr.operator === "=" ||
            expr?.operator === "+=" || expr?.operator === "-=" ||
            expr?.operator === "*=" || expr?.type === "UnaryOperation"
          ) writesState = true;
        },
        StateVariableDeclarationStatement() { writesState = true; },
      });

      if (writesState && !hasAccessControl && !hasRequireSender) {
        const line = getLine(fn);
        findings.push({
          title: `Missing Access Control on \`${fn.name ?? "anonymous"}\``,
          description: `The public/external function \`${fn.name ?? "anonymous"}\` modifies contract state but has no access control modifiers (e.g. onlyOwner, hasRole) and no require(msg.sender == ...) guard. Any caller can invoke this function.`,
          severity: "critical",
          category: "access_control",
          isQuantumRelated: false,
          cweId: "CWE-284",
          cvssScore: 9.1,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Add an onlyOwner, onlyAdmin, or role-based access control modifier from OpenZeppelin's AccessControl. Alternatively, add an explicit require(msg.sender == authorizedAddress, \"Unauthorized\") check.",
          references: ["https://swcregistry.io/docs/SWC-105", "https://docs.openzeppelin.com/contracts/4.x/access-control"],
        });
      }
    },
  });

  return findings;
}

function detectWeakRandomness(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  const WEAK_SOURCES = new Set([
    "blockhash", "block.timestamp", "block.difficulty",
    "block.number", "block.gaslimit", "now",
  ]);

  visit(ast, {
    MemberAccess(node: any) {
      const full = `${node.expression?.name ?? ""}.${node.memberName}`;
      if (WEAK_SOURCES.has(full) || WEAK_SOURCES.has(node.memberName)) {
        const line = getLine(node);
        findings.push({
          title: "Predictable Randomness Source",
          description: `\`${full}\` is used as a source of randomness. Miners and validators can manipulate block values (timestamp, difficulty, blockhash) to influence outcomes in their favor. This breaks any lottery, NFT mint, or game mechanic relying on this value.`,
          severity: "high",
          category: "weak_randomness",
          isQuantumRelated: false,
          cweId: "CWE-338",
          cvssScore: 7.5,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Use Chainlink VRF (Verifiable Random Function) for on-chain randomness. Alternatively, implement a commit-reveal scheme where participants commit a hash of their secret, then reveal it in a later block.",
          references: [
            "https://swcregistry.io/docs/SWC-120",
            "https://docs.chain.link/vrf",
          ],
        });
      }
    },
    Identifier(node: any) {
      if (node.name === "now" || node.name === "blockhash") {
        const line = getLine(node);
        findings.push({
          title: "Predictable On-Chain Randomness (`now` / `blockhash`)",
          description: `\`${node.name}\` is a manipulable block property. Validators on Proof-of-Stake networks can reorder or skip blocks to influence this value.`,
          severity: "high",
          category: "weak_randomness",
          isQuantumRelated: false,
          cweId: "CWE-338",
          cvssScore: 7.2,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Replace with Chainlink VRF. For time-gating, use a minimum time delta combined with a commit-reveal scheme.",
          references: ["https://swcregistry.io/docs/SWC-116"],
        });
      }
    },
  });

  // Deduplicate by lineNumber
  const seen = new Set<number>();
  return findings.filter(f => {
    if (!f.lineNumber || seen.has(f.lineNumber)) return false;
    seen.add(f.lineNumber);
    return true;
  });
}

function detectTxOrigin(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  visit(ast, {
    MemberAccess(node: any) {
      if (node.expression?.name === "tx" && node.memberName === "origin") {
        const line = getLine(node);
        findings.push({
          title: "Authentication via `tx.origin` (Phishing Risk)",
          description: "`tx.origin` returns the original external account that initiated the transaction, not the immediate caller. If a user is tricked into calling a malicious contract, `tx.origin` still points to the user's address, bypassing access control and enabling phishing attacks.",
          severity: "high",
          category: "access_control",
          isQuantumRelated: false,
          cweId: "CWE-287",
          cvssScore: 8.0,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Replace `tx.origin` with `msg.sender` for all authorization checks. Never use `tx.origin` as an authentication mechanism.",
          references: ["https://swcregistry.io/docs/SWC-115"],
        });
      }
    },
  });
  return findings;
}

function detectSelfDestruct(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  visit(ast, {
    FunctionCall(node: any) {
      const name = node.expression?.name ?? "";
      if (name === "selfdestruct" || name === "suicide") {
        const line = getLine(node);
        findings.push({
          title: "Unprotected `selfdestruct` Call",
          description: `\`${name}()\` permanently destroys the contract and forwards all ETH to the specified address. If this function is reachable without strict access control, an attacker can destroy the contract and steal all funds.`,
          severity: "critical",
          category: "access_control",
          isQuantumRelated: false,
          cweId: "CWE-284",
          cvssScore: 9.5,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Ensure `selfdestruct` is behind a strict onlyOwner or multi-sig check. Consider removing it entirely — it is deprecated in newer EVM versions and a significant attack surface.",
          references: ["https://swcregistry.io/docs/SWC-106"],
        });
      }
    },
  });
  return findings;
}

function detectTimestampDependence(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let found = false;
  visit(ast, {
    BinaryOperation(node: any) {
      if (found) return;
      // Check if block.timestamp is used in a condition
      const hasTimestamp = (n: any): boolean => {
        if (n?.type === "MemberAccess" && n.expression?.name === "block" && n.memberName === "timestamp") return true;
        if (n?.name === "now") return true;
        return false;
      };
      if (hasTimestamp(node.left) || hasTimestamp(node.right)) {
        const op = node.operator;
        if (["<", ">", "<=", ">=", "=="].includes(op)) {
          found = true;
          const line = getLine(node);
          findings.push({
            title: "Block Timestamp Dependence in Condition",
            description: `\`block.timestamp\` is used in a conditional check (operator \`${op}\`). Validators can shift the timestamp by up to 15 seconds on Ethereum mainnet, which can be exploited to satisfy or fail time-based conditions (e.g. early withdrawal, auction deadlines).`,
            severity: "medium",
            category: "timestamp_dependence",
            isQuantumRelated: false,
            cweId: "CWE-362",
            cvssScore: 5.3,
            affectedCode: extractSnippet(code, line),
            lineNumber: line,
            recommendation: "Avoid using `block.timestamp` for critical time gates. If time-based logic is required, use a minimum buffer of at least 15 minutes and document the acceptable manipulation window.",
            references: ["https://swcregistry.io/docs/SWC-116"],
          });
        }
      }
    },
  });
  return findings;
}

function detectDelegatecall(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  visit(ast, {
    FunctionCall(node: any) {
      if (node.expression?.memberName === "delegatecall") {
        const line = getLine(node);
        // Check if the target is user-controlled (argument is a variable rather than a hardcoded address)
        const target = node.expression?.expression;
        const isUserControlled = target?.type === "Identifier" && !["this", "address"].includes(target.name ?? "");
        findings.push({
          title: isUserControlled
            ? "User-Controlled `delegatecall` Target (Critical)"
            : "`delegatecall` Usage — Proxy Storage Collision Risk",
          description: isUserControlled
            ? `\`delegatecall\` is invoked with a user-supplied address (${target?.name}). An attacker can point this to a malicious contract that executes arbitrary code in the context of this contract, reading and writing its storage and draining funds.`
            : "`delegatecall` allows a called contract to modify the storage of this contract. If the called contract's storage layout differs, unintended variables will be overwritten (storage collision). This is a common proxy upgrade vulnerability.",
          severity: isUserControlled ? "critical" : "high",
          category: "logic_error",
          isQuantumRelated: false,
          cweId: "CWE-829",
          cvssScore: isUserControlled ? 9.9 : 8.2,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: isUserControlled
            ? "Never allow user-supplied addresses in `delegatecall`. Whitelist implementation addresses and validate them against an immutable registry."
            : "Ensure storage layout compatibility between proxy and implementation contracts. Use OpenZeppelin's TransparentUpgradeableProxy or UUPS pattern which handles storage slots safely.",
          references: [
            "https://swcregistry.io/docs/SWC-112",
            "https://docs.openzeppelin.com/contracts/4.x/api/proxy",
          ],
        });
      }
    },
  });
  return findings;
}

function detectGasLimitIssues(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  visit(ast, {
    ForStatement(node: any) {
      // Look for loops that iterate over a dynamic array (unbounded)
      const init = node.initExpression;
      const body = node.body;
      let hasArrayLength = false;
      visit(node.conditionExpression, {
        MemberAccess(m: any) {
          if (m.memberName === "length") hasArrayLength = true;
        },
      });
      if (hasArrayLength) {
        const line = getLine(node);
        findings.push({
          title: "Unbounded Loop Over Dynamic Array (DoS Risk)",
          description: "A `for` loop iterates up to an array's `.length` property. If the array grows large enough, the loop will exceed the block gas limit, causing all calls to revert. This is a denial-of-service vector if the array can be grown by external parties.",
          severity: "medium",
          category: "denial_of_service",
          isQuantumRelated: false,
          cweId: "CWE-400",
          cvssScore: 5.9,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Use pagination patterns: process N items per call and store progress. Cap array sizes via a maximum length check on push operations. Consider off-chain computation with on-chain verification.",
          references: ["https://swcregistry.io/docs/SWC-128"],
        });
      }
    },
  });
  return findings;
}

function detectHardcodedSecrets(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  // Detect hardcoded address literals that look like private keys or secrets
  // Also detect hardcoded addresses used for privileged roles
  const SUSPICIOUS_PATTERNS = [
    /private.?key/i, /secret/i, /password/i, /seed/i, /mnemonic/i,
  ];

  const lines = code.split("\n");
  lines.forEach((line, i) => {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(line) && (line.includes("=") || line.includes(":"))) {
        findings.push({
          title: "Potential Hardcoded Secret in Contract",
          description: `Line ${i + 1} appears to contain a hardcoded secret or sensitive identifier. Hardcoded secrets in contract source code are permanently visible to all blockchain participants and attackers.`,
          severity: "critical",
          category: "access_control",
          isQuantumRelated: false,
          cweId: "CWE-798",
          cvssScore: 9.0,
          affectedCode: line.trim().substring(0, 200),
          lineNumber: i + 1,
          recommendation: "Never embed secrets in contract code. Use off-chain secrets with cryptographic proofs, or store configurable values as state variables set via constructor or authorized admin functions.",
          references: ["https://swcregistry.io/docs/SWC-136"],
        });
        break;
      }
    }
  });

  return findings;
}

function detectQuantumCryptoVulnerabilities(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  // Check for ecrecover (ECDSA signature recovery) — directly uses secp256k1
  let usesEcrecover = false;
  visit(ast, {
    FunctionCall(node: any) {
      const name = node.expression?.name ?? node.expression?.namePath ?? "";
      if (name === "ecrecover") {
        usesEcrecover = true;
        const line = getLine(node);
        findings.push({
          title: "ECDSA Signature Recovery (`ecrecover`) — Quantum Critical",
          description: "`ecrecover` relies on the secp256k1 elliptic curve, which is broken by Shor's algorithm on a sufficiently powerful quantum computer (~4000 logical qubits). An attacker with a quantum computer can recover the signer's private key from any signature produced with this scheme, enabling arbitrary transaction forgery.",
          severity: "critical",
          category: "elliptic_curve",
          isQuantumRelated: true,
          cweId: "CWE-327",
          cvssScore: 9.5,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Migrate signature verification to a post-quantum scheme. For on-chain use, consider SPHINCS+ or CRYSTALS-Dilithium when EVM support is available. As an interim measure, use EIP-4337 account abstraction to gate signatures behind upgradeable validator contracts that can be swapped when PQC is standardized.",
          references: [
            "https://eips.ethereum.org/EIPS/eip-4337",
            "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf",
            "https://swcregistry.io/docs/SWC-117",
          ],
        });
      }
    },
  });

  // Check for keccak256 in commitment schemes
  let keccakUseCount = 0;
  visit(ast, {
    FunctionCall(node: any) {
      const name = node.expression?.name ?? "";
      if (name === "keccak256" || name === "sha256" || name === "ripemd160") {
        keccakUseCount++;
      }
    },
  });

  if (keccakUseCount > 0) {
    findings.push({
      title: `Hash Function Usage (${keccakUseCount} occurrence${keccakUseCount > 1 ? "s" : ""}) — Grover's Algorithm Exposure`,
      description: `This contract uses ${keccakUseCount} hash operation${keccakUseCount > 1 ? "s" : ""} (keccak256/sha256/ripemd160). Grover's algorithm provides a quadratic quantum speedup over brute-force hash preimage search, effectively halving the security bits of any hash function. Keccak-256 drops from 256-bit to 128-bit post-quantum security. While still considered safe for most uses today, commitment schemes, Merkle proofs, and password hashing using these functions have reduced long-term security margins.`,
      severity: "medium",
      category: "hash_collision",
      isQuantumRelated: true,
      cweId: "CWE-916",
      cvssScore: 5.9,
      affectedCode: null,
      lineNumber: null,
      recommendation: "For long-term security: use SHA3-512 or SHAKE-256 with 512-bit outputs where feasible, doubling post-quantum security back to 256 bits. Critical commitment schemes should document their post-quantum security assumptions and include migration paths.",
      references: [
        "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
        "https://csrc.nist.gov/publications/detail/sp/800-208/final",
      ],
    });
  }

  // Check for signature malleability (ECDSA without checking s value)
  if (usesEcrecover) {
    let checksSValue = false;
    visit(ast, {
      BinaryOperation(node: any) {
        // Look for s <= 0x7f... style checks
        if (node.right?.number?.startsWith?.("0x7f") || node.right?.number?.startsWith?.("0x7F")) {
          checksSValue = true;
        }
      },
    });

    if (!checksSValue) {
      findings.push({
        title: "ECDSA Signature Malleability (Missing s-value Check)",
        description: "The contract uses `ecrecover` but does not check that the signature's `s` value is in the lower half of the elliptic curve order (s <= secp256k1n / 2). ECDSA signatures are malleable — given a valid signature (r, s), the signature (r, -s mod n) is also valid, producing a different hash but recovering the same signer. This can break signature-based replay protection.",
        severity: "medium",
        category: "signature_malleability",
        isQuantumRelated: false,
        cweId: "CWE-347",
        cvssScore: 6.5,
        affectedCode: null,
        lineNumber: null,
        recommendation: "Add a check: `require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0)`. Better yet, use OpenZeppelin's ECDSA library which handles this automatically.",
        references: [
          "https://swcregistry.io/docs/SWC-117",
          "https://docs.openzeppelin.com/contracts/4.x/api/utils#ECDSA",
        ],
      });
    }
  }

  return findings;
}

function detectUncheckedReturnValues(ast: any, code: string): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  visit(ast, {
    ExpressionStatement(node: any) {
      const expr = node.expression;
      // Detect bare .send() or .call() whose return value is not checked
      if (
        expr?.type === "FunctionCall" &&
        (expr.expression?.memberName === "send" ||
          (expr.expression?.memberName === "call" && !expr.expression?.expression?.type?.includes("Cast")))
      ) {
        const line = getLine(node);
        findings.push({
          title: `Unchecked Return Value of \`.${expr.expression?.memberName}()\``,
          description: `\`.${expr.expression?.memberName}()\` can fail silently — it returns \`false\` on failure instead of reverting. If the return value is not checked, ETH transfers may fail without the contract knowing, leading to accounting inconsistencies.`,
          severity: "medium",
          category: "logic_error",
          isQuantumRelated: false,
          cweId: "CWE-252",
          cvssScore: 6.2,
          affectedCode: extractSnippet(code, line),
          lineNumber: line,
          recommendation: "Always check the return value: `(bool success, ) = addr.call{value: amount}(\"\"); require(success, \"Transfer failed\");`. Better yet, use `.transfer()` (auto-reverts) or OpenZeppelin's Address.sendValue().",
          references: ["https://swcregistry.io/docs/SWC-104"],
        });
      }
    },
  });
  return findings;
}

// ─── Extract pragma version ───────────────────────────────────────────────────

function extractPragmaVersion(ast: any): string {
  let version = "";
  visit(ast, {
    PragmaDirective(node: any) {
      if (node.name === "solidity") version = node.value ?? "";
    },
  });
  return version;
}

// ─── Main Solidity analyzer ───────────────────────────────────────────────────

export function analyzeSolidity(code: string): {
  findings: AnalysisFinding[];
  parseError: string | null;
  contractNames: string[];
  functionCount: number;
  lineCount: number;
} {
  let ast: any;
  try {
    ast = parser.parse(code, { loc: true, range: true, tolerant: true });
  } catch (err: any) {
    return {
      findings: [],
      parseError: err?.message ?? "Failed to parse Solidity code",
      contractNames: [],
      functionCount: 0,
      lineCount: code.split("\n").length,
    };
  }

  const pragmaVersion = extractPragmaVersion(ast);

  // Collect contract names and function count
  const contractNames: string[] = [];
  let functionCount = 0;
  visit(ast, {
    ContractDefinition(node: any) {
      if (node.name) contractNames.push(node.name);
    },
    FunctionDefinition() { functionCount++; },
  });

  const allFindings: AnalysisFinding[] = [
    ...detectReentrancy(ast, code),
    ...detectUncheckedMath(ast, code, pragmaVersion),
    ...detectAccessControl(ast, code),
    ...detectWeakRandomness(ast, code),
    ...detectTxOrigin(ast, code),
    ...detectSelfDestruct(ast, code),
    ...detectTimestampDependence(ast, code),
    ...detectDelegatecall(ast, code),
    ...detectGasLimitIssues(ast, code),
    ...detectHardcodedSecrets(ast, code),
    ...detectQuantumCryptoVulnerabilities(ast, code),
    ...detectUncheckedReturnValues(ast, code),
  ];

  return {
    findings: allFindings,
    parseError: null,
    contractNames,
    functionCount,
    lineCount: code.split("\n").length,
  };
}
