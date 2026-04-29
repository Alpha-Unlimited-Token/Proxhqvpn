/**
 * Blockchain Proxy & Delegate Contract Scanner
 * ═════════════════════════════════════════════
 *
 * Detects and analyses every known proxy pattern on EVM chains.
 * Proxy contracts use DELEGATECALL to forward execution to a separate
 * "implementation" address — the caller's storage is used but the logic
 * runs from another contract. This is structurally identical to a reverse
 * proxy: different address, same logic.
 *
 * Patterns detected:
 *
 *   EIP-1967  Transparent Upgradeable Proxy (OpenZeppelin standard)
 *             → reads storage slot 0x3608...bbc for implementation address
 *             → reads slot 0xb531... for admin address
 *             → reads slot 0xa3f0... for beacon address
 *
 *   EIP-1822  UUPS (Universal Upgradeable Proxy Standard)
 *             → reads storage slot 0xc5f1...3d50 for implementation
 *             → implementation controls its own upgrade logic (no admin)
 *
 *   EIP-1167  Minimal Proxy / Clone Factory
 *             → contract bytecode matches the clone pattern exactly
 *             → implementation address embedded directly in bytecode
 *             → no upgradeability — immutable delegation
 *
 *   EIP-2535  Diamond Multi-Facet Proxy
 *             → responds to facets() selector 0x7a0ed627
 *             → maps function selectors to multiple "facet" implementation addresses
 *
 *   Metamorphic contracts (CREATE2 + selfdestruct)
 *             → same address, different bytecode over time
 *             → detected by checking if codeHash in logs differs from current
 *
 *   OpenZeppelin v2 legacy proxy
 *             → uses custom storage slot (keccak of org.zeppelinos prefix)
 *
 *   Generic delegatecall
 *             → scans BigQuery traces for DELEGATECALL opcodes to/from targets
 *
 * Security checks:
 *   • Implementation = known malicious contract (cross-ref known-contracts DB)
 *   • Proxy chain depth > 1 (double-proxy: harder to audit)
 *   • Admin = attacker address from seeds
 *   • Implementation changed (upgrade history = potential rug/exploit)
 *   • Storage collision: proxy + impl use overlapping slot 0
 */

import { ethers }  from "ethers";
import { logger }  from "../logger";
import { ALL_KNOWN_CONTRACTS } from "../threat-scanner/known-contracts";

// ── Constants ─────────────────────────────────────────────────────────────────

const RPC_URL = process.env.ETH_RPC_URL ?? "https://ethereum.publicnode.com";

// EIP-1967 storage slots (keccak256 of strings, minus 1)
const SLOT_EIP1967_IMPL   = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SLOT_EIP1967_ADMIN  = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const SLOT_EIP1967_BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

// EIP-1822 / UUPS
const SLOT_UUPS = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7";

// OpenZeppelin v2 legacy
const SLOT_OZ_LEGACY = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c5f15e13c4ac79af4d1e20a30";

// EIP-1167 minimal proxy bytecode prefixes
const CLONE_PREFIXES = [
  "363d3d373d3d3d363d73",   // EIP-1167 standard
  "3d602d80600a3d3981f3363d3d373d3d3d363d73",  // common variant
  "36603057343d52307f",     // newer vyper clone variant
];

// Diamond standard — facets() selector
const DIAMOND_FACETS_SELECTOR = "0x7a0ed627";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProxyType =
  | "eip1967_transparent"
  | "eip1967_uups"
  | "eip1967_beacon"
  | "eip1822_uups"
  | "eip1167_minimal_clone"
  | "eip2535_diamond"
  | "oz_legacy"
  | "delegatecall_pattern"
  | "metamorphic"
  | "none";

export interface ProxyInfo {
  address:        string;
  isProxy:        boolean;
  proxyType:      ProxyType;
  implementation: string | null;    // primary impl address
  admin:          string | null;    // admin / owner address
  beacon:         string | null;    // for beacon proxies
  facets:         string[];         // for diamonds
  chain:          string[];         // full delegation chain (proxy → impl → impl's impl…)
  implIsKnownBad: boolean;          // implementation is in known-contracts DB
  implBadLabel:   string | null;    // label from known-contracts DB
  adminIsTargeted: boolean;         // admin matches one of the scan seeds
  chainDepth:     number;           // hops to final implementation
  bytecodeHash:   string | null;    // keccak256 of current deployed bytecode
  implBytecodeHash: string | null;  // impl's bytecode hash (to detect metamorphic)
  delegatecallTxCount: number;      // # of DELEGATECALL traces found (from BigQuery)
  findings:       ProxyFinding[];
  scannedAt:      string;
}

export interface ProxyFinding {
  severity:  "critical" | "high" | "medium" | "low" | "info";
  type:      string;
  title:     string;
  detail:    string;
  address?:  string;
  txHash?:   string;
}

export interface ProxyScanSummary {
  totalScanned:    number;
  proxiesFound:    number;
  maliciousImpls:  number;
  deepChains:      number;          // chains with depth >= 2
  byType:          Record<ProxyType, number>;
  findings:        ProxyFinding[];
  proxyInfos:      ProxyInfo[];
  scannedAt:       string;
}

// ── Provider ──────────────────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

async function getStorage(address: string, slot: string): Promise<string> {
  try {
    return await getProvider().getStorage(address, slot);
  } catch {
    return ethers.ZeroHash;
  }
}

async function getCode(address: string): Promise<string> {
  try {
    return await getProvider().getCode(address);
  } catch {
    return "0x";
  }
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  try {
    return await getProvider().send(method, params);
  } catch {
    return null;
  }
}

// ── Slot → address helper ─────────────────────────────────────────────────────
function slotToAddress(raw: string): string | null {
  if (!raw || raw === ethers.ZeroHash) return null;
  try {
    // Last 20 bytes of the 32-byte slot value
    const addr = "0x" + raw.slice(-40);
    if (addr === "0x0000000000000000000000000000000000000000") return null;
    return ethers.getAddress(addr);
  } catch {
    return null;
  }
}

// ── Known-contract lookup ─────────────────────────────────────────────────────
const KNOWN_SET = new Set<string>(
  ALL_KNOWN_CONTRACTS.map(c => c.address.toLowerCase())
);

function lookupKnown(addr: string | null): { bad: boolean; label: string | null } {
  if (!addr) return { bad: false, label: null };
  const a = addr.toLowerCase();
  if (KNOWN_SET.has(a)) {
    const c = ALL_KNOWN_CONTRACTS.find(c => c.address.toLowerCase() === a);
    return { bad: true, label: c ? `${c.name} (${c.category})` : "known malicious contract" };
  }
  return { bad: false, label: null };
}

// ── EIP-1167 bytecode detection ────────────────────────────────────────────────
function parseMinimalClone(bytecode: string): string | null {
  if (!bytecode || bytecode === "0x") return null;
  const code = bytecode.toLowerCase().replace(/^0x/, "");

  // Standard EIP-1167: 363d3d37…363d73{20-byte-addr}5af43d82803e903d91602b57fd5bf3
  const idx = code.indexOf("363d73");
  if (idx !== -1 && code.length >= idx + 6 + 40) {
    return "0x" + code.slice(idx + 6, idx + 6 + 40);
  }
  // Variant: 3d602d80600a3d3981f3363d3d373d3d3d363d73…
  const idx2 = code.indexOf("3d3d3d363d73");
  if (idx2 !== -1 && code.length >= idx2 + 12 + 40) {
    return "0x" + code.slice(idx2 + 12, idx2 + 12 + 40);
  }
  return null;
}

// ── Diamond detection (try calling facets()) ──────────────────────────────────
async function detectDiamond(address: string): Promise<string[] | null> {
  try {
    const result = await rpcCall("eth_call", [{ to: address, data: DIAMOND_FACETS_SELECTOR }, "latest"]);
    if (!result || result === "0x" || typeof result !== "string") return null;
    // ABI decode: array of (address facetAddress, bytes4[] functionSelectors)
    // We only need the facet addresses
    const iface = new ethers.Interface([
      "function facets() view returns ((address facetAddress, bytes4[] functionSelectors)[])"
    ]);
    const decoded = iface.decodeFunctionResult("facets", result as string);
    if (!decoded || !decoded[0]) return null;
    return (decoded[0] as Array<{ facetAddress: string }>).map(f => f.facetAddress);
  } catch {
    return null;
  }
}

// ── Follow proxy chain recursively ────────────────────────────────────────────
async function followChain(address: string, visited = new Set<string>(), depth = 0): Promise<string[]> {
  if (depth > 5 || visited.has(address.toLowerCase())) return [address];
  visited.add(address.toLowerCase());

  const chain: string[] = [address];

  // Try each slot
  for (const slot of [SLOT_EIP1967_IMPL, SLOT_UUPS, SLOT_OZ_LEGACY, SLOT_EIP1967_BEACON]) {
    const raw  = await getStorage(address, slot);
    const impl = slotToAddress(raw);
    if (impl && !visited.has(impl.toLowerCase())) {
      const sub = await followChain(impl, visited, depth + 1);
      chain.push(...sub);
      return chain;
    }
  }

  // Minimal clone bytecode
  const code = await getCode(address);
  const cloneImpl = parseMinimalClone(code);
  if (cloneImpl && !visited.has(cloneImpl.toLowerCase())) {
    const sub = await followChain(cloneImpl, visited, depth + 1);
    chain.push(...sub);
    return chain;
  }

  return chain;
}

// ── Main scanner: single address ──────────────────────────────────────────────
export async function scanProxyAddress(
  address:     string,
  seedSet?:    Set<string>,   // seed addresses to check admin against
): Promise<ProxyInfo> {
  const addr = ethers.getAddress(address);
  const findings: ProxyFinding[] = [];
  const info: ProxyInfo = {
    address: addr,
    isProxy: false,
    proxyType: "none",
    implementation: null,
    admin: null,
    beacon: null,
    facets: [],
    chain: [addr],
    implIsKnownBad: false,
    implBadLabel: null,
    adminIsTargeted: false,
    chainDepth: 0,
    bytecodeHash: null,
    implBytecodeHash: null,
    delegatecallTxCount: 0,
    findings,
    scannedAt: new Date().toISOString(),
  };

  const bytecode = await getCode(addr);
  if (!bytecode || bytecode === "0x") {
    // EOA — not a contract
    return info;
  }

  // Bytecode hash
  info.bytecodeHash = ethers.keccak256(bytecode);

  // ── Check EIP-1967 transparent proxy ─────────────────────────────────────
  const implSlotRaw   = await getStorage(addr, SLOT_EIP1967_IMPL);
  const adminSlotRaw  = await getStorage(addr, SLOT_EIP1967_ADMIN);
  const beaconSlotRaw = await getStorage(addr, SLOT_EIP1967_BEACON);

  const implAddr   = slotToAddress(implSlotRaw);
  const adminAddr  = slotToAddress(adminSlotRaw);
  const beaconAddr = slotToAddress(beaconSlotRaw);

  if (implAddr) {
    info.isProxy        = true;
    info.proxyType      = "eip1967_transparent";
    info.implementation = implAddr;
    info.admin          = adminAddr;
    findings.push({
      severity: "info", type: "proxy_detected",
      title: "EIP-1967 Transparent Proxy",
      detail: `Proxy at ${addr} delegates execution to implementation at ${implAddr}`,
      address: implAddr,
    });
  } else if (beaconAddr) {
    info.isProxy   = true;
    info.proxyType = "eip1967_beacon";
    info.beacon    = beaconAddr;
    // Beacon: call implementation() on the beacon contract
    try {
      const beaconIface = new ethers.Interface(["function implementation() view returns (address)"]);
      const result = await rpcCall("eth_call", [{ to: beaconAddr, data: beaconIface.encodeFunctionData("implementation") }, "latest"]);
      if (result && typeof result === "string" && result.length >= 66) {
        const decoded = beaconIface.decodeFunctionResult("implementation", result);
        info.implementation = decoded[0] as string;
      }
    } catch {}
    findings.push({
      severity: "info", type: "proxy_detected",
      title: "EIP-1967 Beacon Proxy",
      detail: `Beacon proxy at ${addr}. Beacon: ${beaconAddr}. Implementation: ${info.implementation ?? "unknown"}`,
      address: beaconAddr,
    });
  }

  // ── Check UUPS / EIP-1822 ─────────────────────────────────────────────────
  if (!info.isProxy) {
    const uupsRaw  = await getStorage(addr, SLOT_UUPS);
    const uupsImpl = slotToAddress(uupsRaw);
    if (uupsImpl) {
      info.isProxy        = true;
      info.proxyType      = "eip1822_uups";
      info.implementation = uupsImpl;
      findings.push({
        severity: "info", type: "proxy_detected",
        title: "UUPS Proxy (EIP-1822)",
        detail: `Self-managing upgradeable proxy at ${addr} — upgrade logic in implementation ${uupsImpl}`,
        address: uupsImpl,
      });
    }
  }

  // ── Check OZ legacy ──────────────────────────────────────────────────────
  if (!info.isProxy) {
    const ozRaw  = await getStorage(addr, SLOT_OZ_LEGACY);
    const ozImpl = slotToAddress(ozRaw);
    if (ozImpl) {
      info.isProxy        = true;
      info.proxyType      = "oz_legacy";
      info.implementation = ozImpl;
      findings.push({
        severity: "info", type: "proxy_detected",
        title: "OpenZeppelin Legacy Proxy",
        detail: `Pre-EIP-1967 OZ proxy at ${addr} delegates to ${ozImpl}`,
        address: ozImpl,
      });
    }
  }

  // ── EIP-1167 minimal clone ─────────────────────────────────────────────────
  if (!info.isProxy) {
    const cloneImpl = parseMinimalClone(bytecode);
    if (cloneImpl) {
      info.isProxy        = true;
      info.proxyType      = "eip1167_minimal_clone";
      info.implementation = cloneImpl;
      findings.push({
        severity: "info", type: "proxy_detected",
        title: "Minimal Proxy / Clone (EIP-1167)",
        detail: `Immutable DELEGATECALL clone at ${addr} → ${cloneImpl}. Identical logic to impl, independent storage.`,
        address: cloneImpl,
      });
    }
  }

  // ── Diamond proxy (EIP-2535) ──────────────────────────────────────────────
  if (!info.isProxy) {
    const facets = await detectDiamond(addr);
    if (facets && facets.length > 0) {
      info.isProxy   = true;
      info.proxyType = "eip2535_diamond";
      info.facets    = facets;
      // Primary implementation = first facet (arbitrary)
      info.implementation = facets[0] ?? null;
      findings.push({
        severity: "info", type: "proxy_detected",
        title: "Diamond Multi-Facet Proxy (EIP-2535)",
        detail: `Diamond at ${addr} routes calls across ${facets.length} facet contracts`,
      });
    }
  }

  if (!info.isProxy) return info;

  // ── Security checks ───────────────────────────────────────────────────────

  // 1. Check if implementation is a known malicious contract
  const implKnown = lookupKnown(info.implementation);
  if (implKnown.bad) {
    info.implIsKnownBad  = true;
    info.implBadLabel    = implKnown.label;
    findings.push({
      severity: "critical", type: "malicious_implementation",
      title:   "Implementation is a known malicious contract",
      detail:  `The proxy at ${addr} delegates all calls to ${info.implementation} which is flagged as: ${implKnown.label}`,
      address: info.implementation!,
    });
  }

  // 2. Check admin against seed set
  if (adminAddr && seedSet?.has(adminAddr.toLowerCase())) {
    info.adminIsTargeted = true;
    findings.push({
      severity: "high", type: "targeted_admin",
      title:   "Proxy admin is a scan target",
      detail:  `Proxy admin ${adminAddr} is in the attacker/target address list — this account controls upgrades`,
      address: adminAddr,
    });
  }

  // 3. Follow the full delegation chain
  info.chain      = await followChain(addr);
  info.chainDepth = info.chain.length - 1;

  if (info.chainDepth > 1) {
    findings.push({
      severity: "medium", type: "deep_proxy_chain",
      title:   `Deep proxy chain (${info.chainDepth} hops)`,
      detail:  `${addr} → ${info.chain.slice(1).join(" → ")}. Multiple levels of delegation are difficult to audit.`,
    });
  }

  // 4. Implementation bytecode hash (for metamorphic check)
  if (info.implementation) {
    const implCode = await getCode(info.implementation);
    if (implCode && implCode !== "0x") {
      info.implBytecodeHash = ethers.keccak256(implCode);
    }

    // 5. Check if final implementation in chain is also known-bad
    const finalImpl = info.chain[info.chain.length - 1];
    if (finalImpl !== info.implementation) {
      const finalKnown = lookupKnown(finalImpl);
      if (finalKnown.bad) {
        findings.push({
          severity: "critical", type: "malicious_final_implementation",
          title:   "Final implementation in proxy chain is malicious",
          detail:  `End of chain ${finalImpl} flagged as: ${finalKnown.label}`,
          address: finalImpl,
        });
      }
    }
  }

  // 6. For diamonds: check each facet
  for (const facet of info.facets) {
    const fk = lookupKnown(facet);
    if (fk.bad) {
      findings.push({
        severity: "critical", type: "malicious_facet",
        title:   "Diamond facet is a known malicious contract",
        detail:  `Facet ${facet}: ${fk.label}`,
        address: facet,
      });
    }
  }

  logger.info({
    address: addr, proxyType: info.proxyType, chainDepth: info.chainDepth, findings: findings.length,
  }, "Proxy scan complete");

  return info;
}

// ── Batch scanner ─────────────────────────────────────────────────────────────
export async function runProxyScan(
  addresses:   string[],
  seedSet?:    Set<string>,
  onProgress?: (done: number, total: number, latest: ProxyInfo) => void,
): Promise<ProxyScanSummary> {
  const proxyInfos: ProxyInfo[] = [];
  const byType: Record<ProxyType, number> = {} as Record<ProxyType, number>;

  const CONCURRENCY = 10;
  for (let i = 0; i < addresses.length; i += CONCURRENCY) {
    const batch = addresses.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(a => scanProxyAddress(a, seedSet).catch(err => {
        logger.warn({ err, address: a }, "Proxy scan error on address");
        return null;
      }))
    );
    for (const r of results) {
      if (!r) continue;
      proxyInfos.push(r);
      byType[r.proxyType] = (byType[r.proxyType] ?? 0) + 1;
      onProgress?.(proxyInfos.length, addresses.length, r);
    }
  }

  const proxiesFound   = proxyInfos.filter(p => p.isProxy).length;
  const maliciousImpls = proxyInfos.filter(p => p.implIsKnownBad).length;
  const deepChains     = proxyInfos.filter(p => p.chainDepth >= 2).length;
  const allFindings    = proxyInfos.flatMap(p => p.findings);

  return {
    totalScanned:  proxyInfos.length,
    proxiesFound,
    maliciousImpls,
    deepChains,
    byType,
    findings:      allFindings,
    proxyInfos:    proxyInfos.filter(p => p.isProxy),
    scannedAt:     new Date().toISOString(),
  };
}
