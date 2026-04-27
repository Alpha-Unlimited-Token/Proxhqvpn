// Vulnerability pattern definitions for Solidity static analysis
// Each pattern includes regex, line-level detection, and full exploit context

export interface VulnPattern {
  id: string;
  name: string;
  category: "reentrancy" | "access-control" | "integer" | "flash-loan" | "signature" | "oracle" | "logic" | "gas" | "quantum";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  howToExploit: string;
  howToFix: string;
  detectInLine: (line: string, lineNum: number, allLines: string[], ctx: AnalysisContext) => PatternMatch | null;
  detectInBlock?: (source: string, ctx: AnalysisContext) => PatternMatch[];
}

export interface PatternMatch {
  patternId: string;
  lineNumber: number;
  lineContent: string;
  endLine?: number;
  codeSnippet: string;
  confidence: "confirmed" | "likely" | "possible";
  exploitDetail: string;
}

export interface AnalysisContext {
  compilerVersion: string;
  pragmaVersion: string;
  hasSafeMath: boolean;
  hasOpenZeppelin: boolean;
  contractName: string;
  functions: FunctionInfo[];
  stateVars: StateVarInfo[];
  modifiers: string[];
  imports: string[];
  isERC20: boolean;
  isERC721: boolean;
  hasOwnable: boolean;
  hasReentrancyGuard: boolean;
}

export interface FunctionInfo {
  name: string;
  visibility: string;
  modifiers: string[];
  startLine: number;
  endLine: number;
  hasExternalCall: boolean;
  hasStateWrite: boolean;
  isPayable: boolean;
  parameters: string[];
}

export interface StateVarInfo {
  name: string;
  type: string;
  visibility: string;
  lineNumber: number;
  isMappingOrArray: boolean;
}

export const VULNERABILITY_PATTERNS: VulnPattern[] = [
  // ═══════════════════════════════════════════════════════
  // REENTRANCY
  // ═══════════════════════════════════════════════════════
  {
    id: "REENTRANCY-001",
    name: "Classic Reentrancy (call before state update)",
    category: "reentrancy",
    severity: "critical",
    description: "An external .call{value:} is made before updating the sender's balance/state. An attacker can recursively call back into this function before the state is updated, draining all funds.",
    howToExploit: `Deploy a malicious contract with a fallback/receive function that calls back into withdraw().
The attacker's balance is still non-zero when the callback fires because the state update
hasn't happened yet. Repeat until the contract is drained.

Attack contract example:
  receive() external payable {
    if (address(victim).balance >= amount) {
      victim.withdraw(amount);  // recursive call — still passes balance check
    }
  }`,
    howToFix: "Use the Checks-Effects-Interactions pattern: update all state variables BEFORE making any external call. Or add OpenZeppelin's ReentrancyGuard modifier.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/\.call\{value:|\.transfer\(|\.send\(/.test(line)) return null;
      // Look back 10 lines — if there's no state update between mapping access and this call, flag it
      const prior = allLines.slice(Math.max(0, lineNum - 10), lineNum).join("\n");
      const hasBalanceRead = /balances\[|balance\[|userBalance|deposits\[/.test(prior);
      const hasStateUpdate = /balances\[.*\] =|balances\[.*\] -=|delete balances/.test(prior);
      if (hasBalanceRead && !hasStateUpdate) {
        return {
          patternId: "REENTRANCY-001",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(Math.max(0, lineNum - 5), lineNum + 2).map((l, i) => `${lineNum - 5 + i + 1}: ${l}`).join("\n"),
          confidence: "likely",
          exploitDetail: "External call detected after balance read but before balance update. Classic reentrancy setup.",
        };
      }
      return null;
    },
  },
  {
    id: "REENTRANCY-002",
    name: "Cross-function Reentrancy",
    category: "reentrancy",
    severity: "critical",
    description: "State shared between two functions allows reentrancy through a different entry point. An attacker can re-enter via function B while function A's external call is in progress.",
    howToExploit: `Function A reads state → makes external call → attacker's fallback calls function B
which uses the same state variable (not yet updated by A). Both functions share the
same mapping/state but neither has a reentrancy lock.`,
    howToFix: "Add nonReentrant modifier from OpenZeppelin ReentrancyGuard to ALL functions that read/write shared state.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!ctx.hasReentrancyGuard && /\.call\{value:|\.call\(/.test(line)) {
        return {
          patternId: "REENTRANCY-002",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(Math.max(0, lineNum - 2), lineNum + 2).map((l, i) => `${lineNum - 2 + i + 1}: ${l}`).join("\n"),
          confidence: "possible",
          exploitDetail: "No ReentrancyGuard detected in contract. Any external call without reentrancy protection is a potential cross-function reentrancy vector.",
        };
      }
      return null;
    },
  },

  // ═══════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ═══════════════════════════════════════════════════════
  {
    id: "ACCESS-001",
    name: "tx.origin Authentication Bypass",
    category: "access-control",
    severity: "critical",
    description: "Using tx.origin for authentication instead of msg.sender. tx.origin is the original transaction initiator, not the immediate caller. A malicious contract can trick a user into calling it, then use their tx.origin to pass authorization checks in your contract.",
    howToExploit: `Deploy a phishing contract that victims call (e.g., a fake token sale).
When victim calls phishingContract.attack(), it calls target.privilegedFunction().
In target: require(tx.origin == owner) passes because tx.origin is still the victim/owner,
even though the immediate caller is the malicious contract.`,
    howToFix: "Replace all tx.origin checks with msg.sender. Never use tx.origin for authorization.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/tx\.origin/.test(line)) return null;
      return {
        patternId: "ACCESS-001",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 2), lineNum + 3).map((l, i) => `${lineNum - 2 + i + 1}: ${l}`).join("\n"),
        confidence: "confirmed",
        exploitDetail: "tx.origin used for authentication. A phishing contract can bypass this by tricking the owner into calling the phisher, which then calls your contract — tx.origin will still be the owner's address.",
      };
    },
  },
  {
    id: "ACCESS-002",
    name: "Missing Access Control on Critical Function",
    category: "access-control",
    severity: "critical",
    description: "A function that transfers funds, mints tokens, or changes ownership has public/external visibility with no access control modifier (no onlyOwner, no require, no role check).",
    howToExploit: `Call the function directly from any address. No authentication required.
Example: token.mint(attackerAddress, 1000000000 * 10**18) — unlimited token minting.`,
    howToFix: "Add onlyOwner modifier or Roles-based access control from OpenZeppelin. Add require(msg.sender == owner) at minimum.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/function\s+/.test(line)) return null;
      const isCritical = /mint|burn|withdraw|transfer|setOwner|changeOwner|initialize|upgrade|pause|unpause|destroy|selfdestruct/i.test(line);
      const isPublic = /public|external/.test(line);
      const hasModifier = /onlyOwner|onlyAdmin|onlyRole|requireAdmin|onlyMinter|nonReentrant/.test(line);
      const hasRequire = allLines.slice(lineNum + 1, lineNum + 5).join("").includes("require(msg.sender");
      if (isCritical && isPublic && !hasModifier && !hasRequire) {
        return {
          patternId: "ACCESS-002",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(lineNum, lineNum + 6).map((l, i) => `${lineNum + i + 1}: ${l}`).join("\n"),
          confidence: "likely",
          exploitDetail: `Critical function "${line.match(/function\s+(\w+)/)?.[1] ?? "unknown"}" has no access control modifier detected. Anyone can call this function.`,
        };
      }
      return null;
    },
  },
  {
    id: "ACCESS-003",
    name: "Unprotected Self-Destruct",
    category: "access-control",
    severity: "critical",
    description: "selfdestruct() is called inside a function that may be accessible to unauthorized parties. If triggered, it permanently destroys the contract and sends all ETH to the specified address.",
    howToExploit: `Call the function containing selfdestruct and pass your address as recipient.
The entire contract balance is sent to you and the contract code is erased from the blockchain.
Any funds locked in the contract (liquidity pools, user deposits) are lost.`,
    howToFix: "Remove selfdestruct if not needed. If needed, protect with onlyOwner and a time-lock.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/selfdestruct|suicide\(/.test(line)) return null;
      // Check if there's an access control check within the enclosing function (10 lines back)
      const priorBlock = allLines.slice(Math.max(0, lineNum - 15), lineNum).join("\n");
      const hasGuard = /onlyOwner|require\(msg\.sender|Ownable|isOwner/.test(priorBlock);
      return {
        patternId: "ACCESS-003",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 3), lineNum + 2).map((l, i) => `${lineNum - 3 + i + 1}: ${l}`).join("\n"),
        confidence: hasGuard ? "possible" : "confirmed",
        exploitDetail: hasGuard
          ? "selfdestruct present but access control guard detected. Verify the guard cannot be bypassed."
          : "selfdestruct with no access control detected. Anyone can destroy the contract and steal all ETH.",
      };
    },
  },

  // ═══════════════════════════════════════════════════════
  // INTEGER VULNERABILITIES
  // ═══════════════════════════════════════════════════════
  {
    id: "INTEGER-001",
    name: "Integer Overflow / Underflow (pre-Solidity 0.8)",
    category: "integer",
    severity: "high",
    description: "Solidity versions before 0.8.0 do not check for arithmetic overflow/underflow. A uint256 that overflows wraps around to 0; one that underflows from 0 wraps to 2^256-1 (a huge number). This allows attackers to manipulate token balances and bypass balance checks.",
    howToExploit: `balances[attacker] = 0
balances[attacker] -= 1  // underflows to 2^256-1 ≈ 115 quattuordecillion tokens
attacker now has an astronomically large balance and can drain the contract.`,
    howToFix: "Upgrade to Solidity 0.8+. For older contracts, use OpenZeppelin's SafeMath library for all arithmetic.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (ctx.hasSafeMath) return null;
      const isOldCompiler = ctx.pragmaVersion && parseFloat(ctx.pragmaVersion.replace(/[^0-9.]/g, "")) < 0.8;
      if (!isOldCompiler) return null;
      if (!/[\+\-\*]=|balances\[.*\]\s*[\+\-\*]/.test(line) || /SafeMath/.test(line)) return null;
      return {
        patternId: "INTEGER-001",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 1), lineNum + 3).map((l, i) => `${lineNum - 1 + i + 1}: ${l}`).join("\n"),
        confidence: "confirmed",
        exploitDetail: `Solidity ${ctx.pragmaVersion} detected (pre-0.8). Arithmetic operation without SafeMath is vulnerable to overflow/underflow. Attacker can manipulate this value to wrap around.`,
      };
    },
  },
  {
    id: "INTEGER-002",
    name: "Unchecked Block Arithmetic (Solidity 0.8+)",
    category: "integer",
    severity: "medium",
    description: "Code inside an unchecked{} block bypasses Solidity 0.8's overflow protection. If the arithmetic inside can be influenced by user input, overflow/underflow attacks are possible.",
    howToExploit: "Provide input values that cause the arithmetic inside unchecked{} to overflow or underflow, bypassing the intended range checks.",
    howToFix: "Only use unchecked{} for operations that are mathematically impossible to overflow (e.g., loop counters you control). Never use unchecked{} on user-provided values.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/unchecked\s*\{/.test(line)) return null;
      const block = allLines.slice(lineNum, lineNum + 8).join("\n");
      const hasUserInput = /msg\.value|msg\.sender|_amount|_value|_to|calldata|memory/.test(block);
      if (!hasUserInput) return null;
      return {
        patternId: "INTEGER-002",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(lineNum, lineNum + 8).map((l, i) => `${lineNum + i + 1}: ${l}`).join("\n"),
        confidence: "likely",
        exploitDetail: "unchecked{} block appears to operate on user-supplied values. Overflow protection is disabled here — verify this is safe.",
      };
    },
  },

  // ═══════════════════════════════════════════════════════
  // FLASH LOAN / PRICE ORACLE
  // ═══════════════════════════════════════════════════════
  {
    id: "FLASH-001",
    name: "Price Oracle Manipulation (Same-Block Spot Price)",
    category: "flash-loan",
    severity: "critical",
    description: "The contract reads a price from a DEX (Uniswap, Curve, etc.) spot price in the same transaction where it makes financial decisions based on that price. Flash loans allow an attacker to borrow millions, manipulate the DEX price in the same block, trigger your contract's price-dependent logic at the manipulated price, profit, then repay the flash loan — all atomically.",
    howToExploit: `1. Flash loan 10M USDC (free via Aave/Uniswap)
2. Dump into the DEX pool to crash the price your contract reads
3. Call your contract's collateral/liquidation function at the manipulated price
4. Profit from the mispriced liquidation or collateral withdrawal
5. Repay flash loan — all in one transaction`,
    howToFix: "Use a TWAP (Time-Weighted Average Price) oracle with at least a 30-minute window (Uniswap v3 TWAP). Use Chainlink price feeds instead of DEX spot prices. Never use getReserves() for pricing.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/getReserves\(\)|token0\(\)|token1\(\)|getAmountsOut|price0CumulativeLast|slot0\(\)/.test(line)) return null;
      return {
        patternId: "FLASH-001",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 2), lineNum + 4).map((l, i) => `${lineNum - 2 + i + 1}: ${l}`).join("\n"),
        confidence: "likely",
        exploitDetail: "DEX spot price read detected. This is manipulable via flash loans in the same block. If this price is used for collateral valuation, liquidation thresholds, or fund distribution, a flash loan attacker can drain the contract.",
      };
    },
  },
  {
    id: "FLASH-002",
    name: "Flash Loan Attack Vector (No Reentrancy Guard on Lending)",
    category: "flash-loan",
    severity: "high",
    description: "A flash loan function or any function that temporarily changes contract state during a loan is missing a reentrancy guard. An attacker can re-enter mid-loan and exploit the temporary state where the contract believes it owns more assets than it actually does.",
    howToExploit: "Take out a flash loan, then during the loan callback re-enter the lending contract's deposit or accounting functions before the loan is recorded as outstanding.",
    howToFix: "Add nonReentrant to all flash loan related functions. Track outstanding loan amount in storage and validate on every call.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/flashLoan|flashBorrow|executeFlash/.test(line)) return null;
      const hasGuard = /nonReentrant|ReentrancyGuard/.test(line) || ctx.hasReentrancyGuard;
      if (!hasGuard) {
        return {
          patternId: "FLASH-002",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(lineNum, lineNum + 5).map((l, i) => `${lineNum + i + 1}: ${l}`).join("\n"),
          confidence: "likely",
          exploitDetail: "Flash loan function detected without nonReentrant guard. Susceptible to reentrancy during flash loan execution.",
        };
      }
      return null;
    },
  },

  // ═══════════════════════════════════════════════════════
  // SIGNATURE VULNERABILITIES
  // ═══════════════════════════════════════════════════════
  {
    id: "SIG-001",
    name: "Signature Replay Attack (Missing Nonce)",
    category: "signature",
    severity: "critical",
    description: "The contract verifies an ECDSA signature but does not include a nonce in the signed message. A valid signature can be replayed multiple times (on the same or different chains) to perform the same authorized action repeatedly.",
    howToExploit: `1. Get a legitimate signed authorization (e.g., for one withdrawal of 1 ETH)
2. Call the withdrawal function with that same signature 100 times
3. Each call passes verification because there's no nonce to invalidate the signature
4. Drain the contract with one stolen/intercepted signature`,
    howToFix: "Include a nonce in the signed message hash. Increment/invalidate the nonce after each use. Also include chainId and contract address in the hash to prevent cross-chain replay.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/ecrecover\(|ECDSA\.recover\(/.test(line)) return null;
      const surrounding = allLines.slice(Math.max(0, lineNum - 15), lineNum + 5).join("\n");
      const hasNonce = /nonce|_nonce|nonces\[/.test(surrounding);
      const hasChainId = /chainId|block\.chainid|getChainId/.test(surrounding);
      if (!hasNonce) {
        return {
          patternId: "SIG-001",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(Math.max(0, lineNum - 5), lineNum + 3).map((l, i) => `${lineNum - 5 + i + 1}: ${l}`).join("\n"),
          confidence: "likely",
          exploitDetail: `ecrecover/ECDSA.recover detected without nonce in surrounding code. ${!hasChainId ? "Also missing chainId — cross-chain replay possible." : ""} Any valid signature can be reused indefinitely.`,
        };
      }
      return null;
    },
  },
  {
    id: "SIG-002",
    name: "Malleable Signature (Missing s-value Check)",
    category: "signature",
    severity: "medium",
    description: "ECDSA signatures have two valid forms for each signing operation (due to the symmetric nature of the elliptic curve). Without checking that s is in the lower half of the curve order, an attacker can produce a second valid signature for the same message without knowing the private key.",
    howToExploit: "Given signature (r, s, v), compute (r, curve_order - s, 1 - (v-27)) which is also a valid signature. If the contract uses the signature as a unique identifier or for deduplication, both forms pass but appear as different signatures.",
    howToFix: "Use OpenZeppelin's ECDSA.recover which includes the s-value check. Or manually check: require(uint256(s) <= 0x7FFFFFFF...)",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/ecrecover\(/.test(line) || /ECDSA\.recover/.test(line)) return null;
      return {
        patternId: "SIG-002",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 1), lineNum + 3).map((l, i) => `${lineNum - 1 + i + 1}: ${l}`).join("\n"),
        confidence: "possible",
        exploitDetail: "Raw ecrecover() used instead of OpenZeppelin ECDSA.recover(). Raw ecrecover does not check for signature malleability (high s-value). Use ECDSA.recover from OpenZeppelin which includes this check.",
      };
    },
  },

  // ═══════════════════════════════════════════════════════
  // LOGIC VULNERABILITIES
  // ═══════════════════════════════════════════════════════
  {
    id: "LOGIC-001",
    name: "Unchecked Return Value from Low-Level Call",
    category: "logic",
    severity: "high",
    description: "A low-level .call() or .send() return value is not checked. If the external call fails silently (returns false), the contract continues execution assuming success. This can lead to double-spend, inconsistent state, or loss of funds.",
    howToExploit: "Deploy a contract that causes the target .call() to fail (e.g., a receive() that always reverts). The calling contract doesn't notice and marks the action as complete without the funds being transferred.",
    howToFix: "Always check the return value: (bool success, ) = addr.call{value: amount}(''); require(success, 'Transfer failed'). Or use OpenZeppelin's Address.sendValue().",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/.\.call\{|\.call\(/.test(line)) return null;
      const hasReturnCheck = /\(bool\s+\w+|bool\s+success|require\(success|if\s*\(!success/.test(line) ||
        /require\(success|assert\(success/.test(allLines[lineNum + 1] ?? "");
      if (!hasReturnCheck) {
        return {
          patternId: "LOGIC-001",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(Math.max(0, lineNum - 1), lineNum + 3).map((l, i) => `${lineNum - 1 + i + 1}: ${l}`).join("\n"),
          confidence: "likely",
          exploitDetail: ".call() return value not checked. If this call fails, the contract continues as if it succeeded. This could allow an attacker to trigger silent failures and exploit inconsistent state.",
        };
      }
      return null;
    },
  },
  {
    id: "LOGIC-002",
    name: "Timestamp Dependence",
    category: "logic",
    severity: "medium",
    description: "The contract uses block.timestamp for a critical decision (randomness, deadline check, reward distribution). Miners can manipulate block.timestamp by up to ~900 seconds (15 minutes) in either direction.",
    howToExploit: "If the contract uses block.timestamp as a source of randomness, a miner can adjust their timestamp within the allowed range to ensure a favorable outcome. If used for deadline checks, a miner can shift timestamp to include or exclude a transaction.",
    howToFix: "For randomness: use Chainlink VRF. For deadlines: block.timestamp is acceptable for windows > 15 minutes. Never use it for security-critical randomness or tight timing windows.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/block\.timestamp/.test(line)) return null;
      const isCritical = /random|seed|winner|lottery|reward|dividend|if\s*\(block\.timestamp/.test(line);
      if (!isCritical) return null;
      return {
        patternId: "LOGIC-002",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 1), lineNum + 3).map((l, i) => `${lineNum - 1 + i + 1}: ${l}`).join("\n"),
        confidence: "likely",
        exploitDetail: "block.timestamp used in critical logic. Miners can manipulate this value ±900 seconds. If this affects randomness or a financial decision, it is exploitable by a miner colluding with the attacker.",
      };
    },
  },
  {
    id: "LOGIC-003",
    name: "Weak On-Chain Randomness",
    category: "logic",
    severity: "critical",
    description: "Randomness derived from block.difficulty, blockhash, block.timestamp, or any combination thereof is predictable. All of these values are either known before the transaction or controllable by miners.",
    howToExploit: `Compute the 'random' value off-chain before submitting your transaction.
keccak256(abi.encodePacked(block.difficulty, block.timestamp, msg.sender))
All inputs are known at transaction submission time. Submit only winning transactions.`,
    howToFix: "Use Chainlink VRF v2 for verifiable randomness. Never use block variables for randomness in any game, lottery, NFT mint order, or reward distribution.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/keccak256|blockhash|block\.prevrandao|block\.difficulty/.test(line)) return null;
      const surroundings = allLines.slice(Math.max(0, lineNum - 3), lineNum + 3).join("\n");
      const isRandomness = /random|seed|winner|lucky|roll|flip|mint.*order|select/.test(surroundings);
      if (!isRandomness) return null;
      return {
        patternId: "LOGIC-003",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 3), lineNum + 3).map((l, i) => `${lineNum - 3 + i + 1}: ${l}`).join("\n"),
        confidence: "confirmed",
        exploitDetail: "On-chain pseudo-random number generation detected. All inputs (block.difficulty, blockhash, timestamp, msg.sender) are known or manipulable. An attacker can predict the outcome before submitting the transaction.",
      };
    },
  },
  {
    id: "LOGIC-004",
    name: "Delegatecall to User-Controlled Address",
    category: "logic",
    severity: "critical",
    description: "delegatecall executes code from another contract in the context of the calling contract's storage. If the target address is user-supplied or upgradeable without proper access control, an attacker can supply a malicious contract that reads or overwrites any storage slot — including the owner variable and token balances.",
    howToExploit: `Deploy malicious contract with:
  function pwn() external {
    assembly { sstore(0, caller()) }  // overwrite storage slot 0 (usually 'owner')
  }
Call target.delegatecall(abi.encodeWithSelector(Malicious.pwn.selector))
You are now the owner.`,
    howToFix: "Never delegatecall to user-supplied addresses. Lock implementation addresses behind a timelocked governance mechanism.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/delegatecall/.test(line)) return null;
      const priorCode = allLines.slice(Math.max(0, lineNum - 10), lineNum).join("\n");
      const isDynamic = /\w+\.delegatecall|_impl|implementation|target|addr/.test(line);
      const isFixed = /"0x[0-9a-fA-F]{40}"/.test(line);
      if (isDynamic && !isFixed) {
        return {
          patternId: "LOGIC-004",
          lineNumber: lineNum + 1,
          lineContent: line.trim(),
          codeSnippet: allLines.slice(Math.max(0, lineNum - 3), lineNum + 3).map((l, i) => `${lineNum - 3 + i + 1}: ${l}`).join("\n"),
          confidence: "likely",
          exploitDetail: "delegatecall to a non-hardcoded address. If the target address can be influenced by an attacker (via upgrades, parameters, or storage manipulation), they can execute arbitrary code in your contract's storage context.",
        };
      }
      return null;
    },
  },

  // ═══════════════════════════════════════════════════════
  // GAS / DOS
  // ═══════════════════════════════════════════════════════
  {
    id: "GAS-001",
    name: "Unbounded Loop — Gas Exhaustion DoS",
    category: "gas",
    severity: "high",
    description: "A loop iterates over a dynamic array or mapping that grows with user input. An attacker can add enough entries to make the loop exceed the block gas limit, permanently bricking the function.",
    howToExploit: "Add thousands of entries to the array through legitimate user actions. Once the array is large enough, any call to the looping function fails with out-of-gas, locking all funds that require this function to release.",
    howToFix: "Use pull-payment patterns instead of pushing to all users in a loop. Or implement pagination — process N entries per transaction and track progress in storage.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/for\s*\(/.test(line)) return null;
      const isOverDynamic = /\.length|\.length\s*-\s*1/.test(line);
      const isDynamic = /\w+\.length/.test(line) && !/^\s*\/\//.test(line);
      if (!isDynamic) return null;
      return {
        patternId: "GAS-001",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(lineNum, lineNum + 5).map((l, i) => `${lineNum + i + 1}: ${l}`).join("\n"),
        confidence: "possible",
        exploitDetail: "Loop over dynamic-length array/mapping. If this array can be grown by external users, an attacker can fill it until this loop exceeds block gas limit, permanently preventing function execution.",
      };
    },
  },

  // ═══════════════════════════════════════════════════════
  // QUANTUM SPECIFIC
  // ═══════════════════════════════════════════════════════
  {
    id: "QUANTUM-001",
    name: "ECDSA Signature Verification (secp256k1 — Quantum Vulnerable)",
    category: "quantum",
    severity: "critical",
    description: "This contract uses ECDSA signature verification (ecrecover or ECDSA.recover) which relies on the secp256k1 elliptic curve. Shor's Algorithm running on a sufficiently powerful quantum computer can solve the Elliptic Curve Discrete Logarithm Problem for secp256k1, breaking all ECDSA signatures and key pairs.",
    howToExploit: "Quantum attacker: recover the private key from any exposed public key using Shor's Algorithm (O(n³) time on quantum hardware). Sign arbitrary transactions as the victim. Bypass all ecrecover-based authentication.",
    howToFix: "Migrate to CRYSTALS-Dilithium (NIST FIPS 204) or FALCON (NIST FIPS 206) post-quantum signature schemes. Note: these are not yet supported natively by the EVM — requires off-chain verification or a ZK-proof layer.",
    detectInLine: (line, lineNum, allLines, ctx) => {
      if (!/ecrecover\(|ECDSA\.recover\(|ECDSA\.tryRecover/.test(line)) return null;
      return {
        patternId: "QUANTUM-001",
        lineNumber: lineNum + 1,
        lineContent: line.trim(),
        codeSnippet: allLines.slice(Math.max(0, lineNum - 2), lineNum + 3).map((l, i) => `${lineNum - 2 + i + 1}: ${l}`).join("\n"),
        confidence: "confirmed",
        exploitDetail: "secp256k1 ECDSA verification on-chain. Quantum computers running Shor's Algorithm (est. 2030–2035) can derive the signer's private key from their public key, breaking all signature-based authentication in this contract.",
      };
    },
  },
];
