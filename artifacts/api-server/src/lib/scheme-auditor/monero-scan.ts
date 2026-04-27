// Real Monero CLSAG key image reuse scanner
// Given a transaction hash OR a set of tx hashes:
//   - Fetches the transaction's block height
//   - Scans blocks BEFORE AND AFTER that block (configurable window, default ±15)
//   - For each block, fetches all transaction hashes
//   - For each transaction, extracts all key images from inputs
//   - Cross-references all key images for duplicates
//
// Key image I = x * H_p(P) — unique per UTXO, published on-chain with every spend
// Duplicate key image across two txs = mathematical proof of double-spend
// Also reveals: the true signer is the intersection of both ring member sets
//
// APIs: XMRChain explorer (public, no key required)

const XMRCHAIN = "https://xmrchain.net";
const MONERO_RPC_NODES = [
  "https://node.moneroworld.com:18089",
  "https://nodes.hashvault.pro:18081",
  "https://xmr-node.cakewallet.com:18081",
];

async function get(url: string): Promise<unknown> {
  const r = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "QuantumAudit/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

async function rpcPost(node: string, method: string, params: unknown): Promise<unknown> {
  const r = await fetch(`${node}/json_rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "QuantumAudit/1.0" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "0", method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const json = await r.json() as Record<string, unknown>;
  if (json.error) throw new Error(String((json.error as Record<string, unknown>).message ?? json.error));
  return json.result;
}

async function tryRpc<T>(method: string, params: unknown): Promise<T> {
  let lastErr: unknown;
  for (const node of MONERO_RPC_NODES) {
    try { return await rpcPost(node, method, params) as T; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function tryGetTransactionRpc(txHash: string): Promise<{ blockHeight: number; keyImages: string[] } | null> {
  try {
    const node = MONERO_RPC_NODES[0];
    const r = await fetch(`${node}/gettransactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "QuantumAudit/1.0" },
      body: JSON.stringify({ txs_hashes: [txHash], decode_as_json: true }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const json = await r.json() as Record<string, unknown>;
    const txs = json.txs as Record<string, unknown>[];
    if (!txs?.[0]) return null;
    const asJson = String(txs[0].as_json ?? "");
    if (!asJson) return null;
    const txData = JSON.parse(asJson) as Record<string, unknown>;
    const vin = (txData.vin as Record<string, unknown>[]) ?? [];
    const keyImages = vin
      .map(inp => String((inp.key as Record<string, unknown>)?.k_image ?? ""))
      .filter(ki => ki.length === 64);
    const blockHeight = Number(txs[0].block_height ?? txs[0].block_idx ?? 0);
    return { blockHeight, keyImages };
  } catch {
    return null;
  }
}

export type MoneroKeyImage = {
  keyImage: string;
  txHash: string;
  blockHeight: number;
  inputIndex: number;
  ringSize: number;
  ringSizeNote: string;
};

export type KeyImageReusePair = {
  keyImage: string;
  tx1: MoneroKeyImage;
  tx2: MoneroKeyImage;
  significance: string;
  ringIntersectionNote: string;
};

export type MoneroScanResult = {
  anchorTxHash: string | null;
  anchorBlockHeight: number | null;
  blocksScanned: number[];
  txHashesScanned: number;
  keyImagesExtracted: number;
  reuseDetected: KeyImageReusePair[];
  hasDoubleSpend: boolean;
  allKeyImages: MoneroKeyImage[];
  isKeyImageSpentStatus: Record<string, number>;
  note: string;
  scanTimestamp: string;
};

// Fetch a transaction and extract its key images + block height
async function fetchTxKeyImages(txHash: string): Promise<{ blockHeight: number; keyImages: MoneroKeyImage[] }> {
  // Try XMRChain explorer first
  try {
    const data = await get(`${XMRCHAIN}/api/transaction/${txHash}`) as Record<string, unknown>;
    const inputs = (data.inputs as Record<string, unknown>[]) ?? [];
    const blockHeight = Number(data.block_height ?? data.block_num ?? 0);
    const keyImages: MoneroKeyImage[] = inputs
      .map((inp, i) => ({
        keyImage: String(inp.key_image ?? inp.keyImage ?? "").toLowerCase(),
        txHash,
        blockHeight,
        inputIndex: i,
        ringSize: Number(inp.mixins ?? (inp.ring_members as unknown[])?.length ?? 0),
        ringSizeNote: `${Number(inp.mixins ?? (inp.ring_members as unknown[])?.length ?? 0)} ring members`,
      }))
      .filter(ki => ki.keyImage.length === 64);
    return { blockHeight, keyImages };
  } catch {}

  // Fallback to RPC
  const rpc = await tryGetTransactionRpc(txHash);
  if (rpc) {
    return {
      blockHeight: rpc.blockHeight,
      keyImages: rpc.keyImages.map((ki, i) => ({
        keyImage: ki.toLowerCase(),
        txHash,
        blockHeight: rpc.blockHeight,
        inputIndex: i,
        ringSize: 11, // default Monero ring size
        ringSizeNote: "11 ring members (default)",
      })),
    };
  }

  return { blockHeight: 0, keyImages: [] };
}

// Fetch all transaction hashes in a block
async function fetchBlockTxHashes(blockHeight: number): Promise<string[]> {
  try {
    const data = await get(`${XMRCHAIN}/api/block/${blockHeight}`) as Record<string, unknown>;
    const txs = (data.txs as Record<string, unknown>[]) ?? [];
    return txs.map(tx => String(tx.tx_hash ?? tx.hash ?? "")).filter(h => h.length === 64);
  } catch {
    try {
      const result = await tryRpc<Record<string, unknown>>("get_block", { height: blockHeight });
      const blockDetails = result.block_details as Record<string, unknown> ?? result;
      const txHashes = (blockDetails.tx_hashes as string[]) ?? [];
      return txHashes;
    } catch {
      return [];
    }
  }
}

// Check spend status of key images via RPC
async function checkSpendStatus(keyImages: string[]): Promise<Record<string, number>> {
  if (keyImages.length === 0) return {};
  try {
    const result = await tryRpc<Record<string, unknown>>("is_key_image_spent", { key_images: keyImages });
    const statuses = (result.spent_status as number[]) ?? [];
    const out: Record<string, number> = {};
    keyImages.forEach((ki, i) => { out[ki] = statuses[i] ?? 0; });
    return out;
  } catch {
    return {};
  }
}

// Main entry — accepts a tx hash OR multiple tx hashes
// Scans the block containing each tx plus ±blockWindow surrounding blocks
export async function scanMonero(
  target: string | string[],
  blockWindow = 15
): Promise<MoneroScanResult> {
  const targets = Array.isArray(target) ? target : [target];
  const allKeyImages: MoneroKeyImage[] = [];
  const scannedTxHashes = new Set<string>();
  const scannedBlocks: number[] = [];
  let anchorTxHash: string | null = null;
  let anchorBlockHeight: number | null = null;

  // Step 1: Fetch all anchor transactions and their block heights
  const anchorBlockHeights = new Set<number>();
  for (const txHash of targets) {
    if (txHash.length !== 64) continue;
    anchorTxHash = txHash;
    const { blockHeight, keyImages } = await fetchTxKeyImages(txHash);
    if (blockHeight > 0) {
      anchorBlockHeight = blockHeight;
      anchorBlockHeights.add(blockHeight);
    }
    for (const ki of keyImages) {
      if (!scannedTxHashes.has(txHash)) allKeyImages.push(ki);
    }
    scannedTxHashes.add(txHash);
  }

  // Step 2: For each anchor block, scan surrounding blocks
  for (const centerHeight of anchorBlockHeights) {
    const minBlock = Math.max(0, centerHeight - blockWindow);
    const maxBlock = centerHeight + blockWindow;

    for (let h = minBlock; h <= maxBlock; h++) {
      if (scannedBlocks.includes(h)) continue;
      scannedBlocks.push(h);

      const txHashes = await fetchBlockTxHashes(h);
      for (const txHash of txHashes) {
        if (scannedTxHashes.has(txHash)) continue;
        scannedTxHashes.add(txHash);
        try {
          const { keyImages } = await fetchTxKeyImages(txHash);
          allKeyImages.push(...keyImages);
        } catch {}
      }
    }
  }

  // Step 3: Cross-reference all key images for duplicates
  const kiGroups: Record<string, MoneroKeyImage[]> = {};
  for (const ki of allKeyImages) {
    if (!ki.keyImage || ki.keyImage.length !== 64) continue;
    if (!kiGroups[ki.keyImage]) kiGroups[ki.keyImage] = [];
    kiGroups[ki.keyImage].push(ki);
  }

  const reusePairs: KeyImageReusePair[] = [];
  for (const [keyImage, group] of Object.entries(kiGroups)) {
    if (group.length >= 2) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          reusePairs.push({
            keyImage,
            tx1: group[i],
            tx2: group[j],
            significance:
              "CONFIRMED DOUBLE-SPEND — Identical key image I = x·H_p(P) in two transactions proves the same private spend key x signed both. The blockchain normally prevents this; finding one here indicates a consensus failure or a deliberately crafted invalid chain.",
            ringIntersectionNote:
              `The true signer is the common ring member between TX1 (${group[i].ringSize} members) and TX2 (${group[j].ringSize} members). Intersecting both ring sets narrows or eliminates anonymity.`,
          });
        }
      }
    }
  }

  // Step 4: Check on-chain spend status for all unique key images
  const uniqueKIs = Object.keys(kiGroups);
  const spendStatus = await checkSpendStatus(uniqueKIs.slice(0, 50));

  const note = reusePairs.length > 0
    ? `CRITICAL: ${reusePairs.length} duplicate key image(s) found across ${scannedTxHashes.size} transactions in blocks ${Math.min(...scannedBlocks)}–${Math.max(...scannedBlocks)}. This is mathematical proof of double-spend. True signer identity can be narrowed by intersecting ring member sets.`
    : allKeyImages.length > 0
      ? `Clean: ${allKeyImages.length} unique key images across ${scannedTxHashes.size} transactions in ${scannedBlocks.length} blocks (±${blockWindow} blocks from anchor). No duplicate key images found.`
      : "No key images extracted — check that transaction hashes are valid Monero mainnet transactions.";

  return {
    anchorTxHash,
    anchorBlockHeight,
    blocksScanned: scannedBlocks.sort((a, b) => a - b),
    txHashesScanned: scannedTxHashes.size,
    keyImagesExtracted: allKeyImages.length,
    reuseDetected: reusePairs,
    hasDoubleSpend: reusePairs.length > 0,
    allKeyImages,
    isKeyImageSpentStatus: spendStatus,
    note,
    scanTimestamp: new Date().toISOString(),
  };
}

// Legacy named export — accepts tx hash list (all auto-scanned)
export async function scanMoneroTransactions(txHashes: string[]): Promise<MoneroScanResult> {
  return scanMonero(txHashes);
}

// Check raw key images for duplicates + on-chain spend status
export async function checkKeyImages(keyImages: string[]): Promise<{
  keyImages: { keyImage: string; spentOnChain: number; appearsCount: number }[];
  duplicates: string[];
  spendStatuses: Record<string, number>;
  scanTimestamp: string;
}> {
  const counts: Record<string, number> = {};
  for (const ki of keyImages) {
    const k = ki.toLowerCase().trim();
    if (k.length === 64) counts[k] = (counts[k] ?? 0) + 1;
  }
  const unique = Object.keys(counts);
  const spendStatuses = await checkSpendStatus(unique.slice(0, 64));
  return {
    keyImages: unique.map(ki => ({
      keyImage: ki,
      spentOnChain: spendStatuses[ki] ?? -1,
      appearsCount: counts[ki],
    })),
    duplicates: unique.filter(ki => counts[ki] > 1),
    spendStatuses,
    scanTimestamp: new Date().toISOString(),
  };
}
