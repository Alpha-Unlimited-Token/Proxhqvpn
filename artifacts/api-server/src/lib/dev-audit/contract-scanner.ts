// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Solidity Contract Static Analyzer
 * Detects the same vulnerability classes that attackers exploit in 2026:
 * reentrancy, signature replay, weak randomness, permit misconfigs,
 * tx.origin auth, ecrecover without zero-check, delegatecall, selfdestruct.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ContractFinding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  attackVector: string;
  line?: number;
  snippet?: string;
  remediation: string;
  cwe?: string;
  swc?: string;
}

export interface ContractScanResult {
  findingCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  riskScore: number;
  findings: ContractFinding[];
  linesScanned: number;
  detectedPatterns: string[];
}

interface Rule {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  attackVector: string;
  remediation: string;
  cwe?: string;
  swc?: string;
  pattern: RegExp;
  contextLines?: number;
}

const RULES: Rule[] = [
  {
    id: "REENTRANCY_001",
    severity: "critical",
    title: "Reentrancy Vulnerability",
    description: "External call followed by state mutation detected. An attacker can re-enter the function before the state update, draining the contract.",
    attackVector: "Attacker deploys a malicious fallback/receive function, triggers withdrawal, re-enters before balance update — the DAO hack pattern.",
    remediation: "Apply the Checks-Effects-Interactions pattern: validate → update state → external call. Use OpenZeppelin's `nonReentrant` modifier from `ReentrancyGuard`.",
    cwe: "CWE-841",
    swc: "SWC-107",
    pattern: /\.call\s*\{[^}]*\}\s*\([^)]*\)[\s\S]{0,300}(?:balance|amount|total)\s*[-=]/,
  },
  {
    id: "TXORIGIN_001",
    severity: "critical",
    title: "tx.origin Used for Authentication",
    description: "`tx.origin` is the original transaction signer, not the direct caller. A malicious intermediate contract can impersonate the owner.",
    attackVector: "Phishing attack: victim calls a malicious contract → malicious contract calls your contract → `tx.origin` is still the victim's address, bypassing the `require(tx.origin == owner)` check.",
    remediation: "Replace `tx.origin` with `msg.sender` for all authorization checks.",
    cwe: "CWE-290",
    swc: "SWC-115",
    pattern: /tx\.origin\s*(?:==|!=)/,
  },
  {
    id: "WEAKRNG_001",
    severity: "high",
    title: "Weak Randomness — Block Variables as Entropy",
    description: "`block.timestamp`, `block.number`, or `blockhash` used as randomness source. Miners can manipulate these values within a 900-second window.",
    attackVector: "A miner (or in PoS: a validator) can choose to include or exclude blocks and slightly adjust timestamps to bias outcomes in their favour in lottery/gambling contracts.",
    remediation: "Use Chainlink VRF (Verifiable Random Function) for on-chain randomness. Never use block variables as the sole entropy source.",
    cwe: "CWE-338",
    swc: "SWC-120",
    pattern: /(?:block\.timestamp|block\.number|blockhash)\s*(?:%|&|\+|-|\*|\/)/,
  },
  {
    id: "ECRECOVER_001",
    severity: "high",
    title: "ecrecover Without Zero-Address Check",
    description: "`ecrecover` returns `address(0)` for invalid signatures. If not checked, address(0) may match an unchecked `signer == address(0)` owner.",
    attackVector: "An attacker submits a malformed signature → `ecrecover` returns `address(0)` → if the contract stores `address(0)` as the default admin or has no zero-check, authentication is bypassed entirely.",
    remediation: "Always check `require(recovered != address(0), 'Invalid signature')` after calling `ecrecover`. Consider using OpenZeppelin's `ECDSA.recover` which throws on zero-address.",
    cwe: "CWE-354",
    swc: "SWC-122",
    pattern: /ecrecover\s*\([^)]+\)/,
  },
  {
    id: "SIGREPLAY_001",
    severity: "high",
    title: "Signature Replay Attack — Missing Nonce or Chain ID",
    description: "Signature verification does not include a nonce, chain ID, or contract address, allowing the same signature to be replayed on different transactions or networks.",
    attackVector: "Attacker captures a valid signed transaction and re-submits it later (or on another chain), executing the same action again — double-spending or repeated withdrawals.",
    remediation: "Include `nonce`, `block.chainid`, and the contract's own address in every signed digest. Track and invalidate used nonces in contract storage.",
    cwe: "CWE-294",
    swc: "SWC-121",
    pattern: /keccak256\s*\(\s*abi\.encode(?:Packed)?\s*\([^)]*\)\s*\)(?![\s\S]{0,200}(?:nonce|chainid|chainId|chain_id))/,
  },
  {
    id: "PERMIT_DEADLINE_001",
    severity: "high",
    title: "Permit With No Deadline Validation",
    description: "EIP-2612 `permit()` calls with `type(uint256).max` as deadline create indefinitely-valid approvals that can be used at any future time.",
    attackVector: "Drainer contracts trick users into signing `permit()` calls with max deadline (looks like a wallet connection approval). The drainer can execute the actual transfer hours or days later when the user has forgotten.",
    remediation: "Validate that `deadline` is not `type(uint256).max`. Set a maximum deadline window (e.g. 20 minutes) for UX-critical operations. Display the full permit parameters to users before signing.",
    cwe: "CWE-613",
    swc: "SWC-116",
    pattern: /type\s*\(\s*uint256\s*\)\s*\.max/,
  },
  {
    id: "DELEGATECALL_001",
    severity: "high",
    title: "Unprotected delegatecall",
    description: "`delegatecall` executes code in the calling contract's context. If the target address is user-controlled or upgradeable without access control, it can overwrite storage slots and change ownership.",
    attackVector: "Attacker passes a malicious implementation address to a function that uses `delegatecall`. The malicious code runs in the proxy's storage context, setting `owner = attacker`.",
    remediation: "Never allow user-controlled addresses in `delegatecall`. Restrict upgrade paths to a multisig with a timelock. Use OpenZeppelin's audited proxy patterns (TransparentProxy, UUPS).",
    cwe: "CWE-829",
    swc: "SWC-112",
    pattern: /\.delegatecall\s*\(/,
  },
  {
    id: "SELFDESTRUCT_001",
    severity: "high",
    title: "selfdestruct Present",
    description: "`selfdestruct` can permanently destroy the contract and force-send ETH to a target, breaking invariants in contracts that assume their balance cannot be forcibly increased.",
    attackVector: "An attacker who gains control of a contract with `selfdestruct` can destroy it and drain all funds. Even if access-controlled, the existence of `selfdestruct` makes the contract incompatible with EIP-4758 (post-Shanghai networks deprecated it).",
    remediation: "Remove `selfdestruct` and implement emergency withdrawal patterns using pull-payment instead. Note: `selfdestruct` behaviour changed in EIP-6780 — it only works in the same transaction it was created on most chains now.",
    cwe: "CWE-1236",
    swc: "SWC-106",
    pattern: /\bselfdestruct\s*\(/,
  },
  {
    id: "OVERFLOW_001",
    severity: "medium",
    title: "Unchecked Arithmetic (Pre-0.8 Pattern)",
    description: "Code uses explicit `SafeMath` bypasses or `unchecked` blocks around arithmetic that operates on user-supplied values, enabling overflow/underflow exploits.",
    attackVector: "Integer overflow: `uint8 x = 255; x += 1` wraps to 0. In token contracts this can mint unlimited tokens or drain balances by underflowing to `type(uint).max`.",
    remediation: "Use Solidity ≥0.8.0 which has built-in overflow protection. Audit all `unchecked {}` blocks to verify they cannot overflow on realistic inputs. Avoid `SafeMath` in ≥0.8.0 (redundant).",
    cwe: "CWE-190",
    swc: "SWC-101",
    pattern: /\bunchecked\s*\{[\s\S]{0,500}(?:[\+\-\*\/]=|[\+\-\*\/]{2})/,
  },
  {
    id: "ARBITRARYWRITE_001",
    severity: "high",
    title: "Arbitrary Storage Write via Assembly",
    description: "Inline `assembly` with `sstore` using a user-controlled slot can write to any storage slot, overwriting the owner, balances, or critical state variables.",
    attackVector: "Attacker provides a storage slot index pointing to the `owner` mapping. The `sstore` overwrites the owner with the attacker's address.",
    remediation: "Restrict all assembly blocks. Validate that slot indices in `sstore` calls cannot be influenced by user input. Consider disallowing assembly in audited surface areas.",
    cwe: "CWE-123",
    swc: "SWC-124",
    pattern: /assembly\s*\{[\s\S]{0,200}sstore\s*\(/,
  },
  {
    id: "FRONTRUN_001",
    severity: "medium",
    title: "Front-Running Susceptibility",
    description: "Approval-then-transferFrom pattern without atomic execution is vulnerable to ERC-20 approval front-running, where an attacker spends the old allowance before the new one is set.",
    attackVector: "Alice sets Bob's allowance to 10. Alice then reduces it to 5. Bob observes the pending tx in the mempool and front-runs with a spend of the original 10 before the reduction lands, then spends the new 5 — total 15.",
    remediation: "Use `increaseAllowance`/`decreaseAllowance` instead of `approve`. Or use Permit (EIP-2612) for one-shot approvals. Alternatively implement EIP-1967 allowance patterns with `permit()`.",
    cwe: "CWE-362",
    swc: "SWC-114",
    pattern: /function\s+approve\s*\([^)]+\)[\s\S]{0,100}(?:allowance|_approve)/,
  },
  {
    id: "ACCESSCONTROL_001",
    severity: "medium",
    title: "Missing Access Control on Sensitive Function",
    description: "Function names suggest sensitive operations (mint, burn, pause, setOwner, withdraw, upgrade) but no `onlyOwner`, `onlyRole`, or modifier guard is detected.",
    attackVector: "Anyone can call an unguarded mint function to create unlimited tokens, or call withdraw to drain the contract, or call upgrade to replace the implementation.",
    remediation: "Apply `onlyOwner` or OpenZeppelin `AccessControl` roles to all sensitive functions. Consider a multi-sig (Gnosis Safe) as the owner for production deployments.",
    cwe: "CWE-284",
    swc: "SWC-105",
    pattern: /function\s+(?:mint|burn|pause|unpause|setOwner|transferOwnership|withdraw|upgrade|initialize)\s*\([^)]*\)\s*(?:external|public)\s*(?!.*(?:onlyOwner|onlyRole|modifier|require\s*\(\s*msg\.sender))/,
  },
  {
    id: "TIMESTAMP_DEPEND_001",
    severity: "low",
    title: "Timestamp Dependence for Critical Logic",
    description: "`block.timestamp` used in time-critical logic. Validators can manipulate it within a ~12-second window.",
    attackVector: "Validator delays or advances `block.timestamp` by up to 12 seconds to cross a deadline boundary — triggering an expired lock prematurely or extending a window they shouldn't have.",
    remediation: "For deadlines, use a tolerance of at least 15 minutes. Do not use timestamp for security-critical decisions with sub-minute precision.",
    cwe: "CWE-829",
    swc: "SWC-116",
    pattern: /block\.timestamp\s*(?:<|>|<=|>=|==)/,
  },
  {
    id: "HARDCODED_ADDR_001",
    severity: "info",
    title: "Hardcoded Address Detected",
    description: "A hardcoded Ethereum address was found in the contract. This can be a centralization risk or a backdoor if the address is controlled by the developer.",
    attackVector: "If the hardcoded address is a developer-controlled EOA, it can be compromised. If it's an oracle or dependency, it cannot be updated if that contract is exploited.",
    remediation: "Parameterize addresses through the constructor or admin-controlled setter functions with appropriate timelocks. Document all hardcoded addresses and their purpose.",
    cwe: "CWE-798",
    swc: "SWC-132",
    pattern: /0x[0-9a-fA-F]{40}/,
  },
];

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 30,
  high: 15,
  medium: 7,
  low: 2,
  info: 0,
};

function extractSnippet(lines: string[], lineIdx: number, context = 2): string {
  const start = Math.max(0, lineIdx - context);
  const end = Math.min(lines.length - 1, lineIdx + context);
  return lines.slice(start, end + 1).join("\n");
}

function findLineNumber(source: string, matchIndex: number): number {
  return source.slice(0, matchIndex).split("\n").length;
}

export function scanContractSource(source: string): ContractScanResult {
  const lines = source.split("\n");
  const findings: ContractFinding[] = [];
  const detectedPatterns: string[] = [];
  const seenIds = new Set<string>();

  for (const rule of RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
    let match: RegExpExecArray | null;
    let foundForRule = false;
    while ((match = regex.exec(source)) !== null) {
      if (seenIds.has(rule.id + match.index)) continue;
      seenIds.add(rule.id + match.index);
      const lineNum = findLineNumber(source, match.index);
      const snippet = extractSnippet(lines, lineNum - 1, rule.contextLines ?? 2);
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        attackVector: rule.attackVector,
        line: lineNum,
        snippet,
        remediation: rule.remediation,
        cwe: rule.cwe,
        swc: rule.swc,
      });
      if (!foundForRule) {
        detectedPatterns.push(rule.title);
        foundForRule = true;
      }
    }
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let rawScore = 0;
  for (const f of findings) {
    counts[f.severity]++;
    rawScore += SEVERITY_WEIGHTS[f.severity];
  }

  findings.sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });

  return {
    findingCount: findings.length,
    ...counts,
    riskScore: Math.min(100, rawScore),
    findings,
    linesScanned: lines.length,
    detectedPatterns,
  };
}
