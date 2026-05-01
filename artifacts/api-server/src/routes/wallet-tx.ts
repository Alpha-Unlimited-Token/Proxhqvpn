import { Router } from "express";
import {
  fetchWalletOutgoing,
  fetchNonceAndBalance,
  getChain,
  CHAINS,
  fullSignatureScan,
} from "@workspace/wallet-tx";

const router = Router();

/**
 * GET /api/wallet/chains
 * Returns the list of supported chains.
 */
router.get("/chains", (_req, res) => {
  res.json(CHAINS.map(c => ({ id: c.id, label: c.label })));
});

/**
 * GET /api/wallet/nonce?address=0x...&chain=ethereum
 * Fast nonce + balance check — one RPC call per chain.
 */
router.get("/nonce", async (req, res) => {
  const address = String(req.query.address ?? "");
  const chainId = String(req.query.chain ?? "ethereum");

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  const chain = getChain(chainId);
  const data  = await fetchNonceAndBalance(address, chain.rpcUrl, chainId);
  res.json({ address, chain: chainId, ...data });
});

/**
 * GET /api/wallet/outgoing?address=0x...&chain=ethereum&enrichSigs=false
 * Full outgoing transaction history with optional signature enrichment.
 *
 * Query params:
 *   address    - EVM address (required)
 *   chain      - chain id (default: ethereum)
 *   enrichSigs - "true" to fetch r/s/v for each tx (slower)
 *   enrichLimit- max txs to enrich (default 200)
 */
router.get("/outgoing", async (req, res) => {
  const address     = String(req.query.address ?? "");
  const chainId     = String(req.query.chain ?? "ethereum");
  const enrichSigs  = req.query.enrichSigs === "true";
  const enrichLimit = Math.min(parseInt(String(req.query.enrichLimit ?? "200")), 1000);

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  try {
    const summary = await fetchWalletOutgoing(address, chainId, {
      alchemyKey:  process.env.ALCHEMY_API_KEY,
      enrichSigs,
      enrichLimit,
    });

    res.json({
      address:      summary.address,
      chain:        summary.chain,
      chainLabel:   summary.chainLabel,
      nonce:        summary.nonce,
      balanceEth:   summary.balanceEth,
      totalFetched: summary.totalFetched,
      source:       summary.source,
      error:        summary.error ?? null,
      outgoingTxs:  summary.outgoingTxs.map(tx => ({
        hash:        tx.hash,
        blockNumber: tx.blockNumber,
        timestamp:   tx.timestamp,
        to:          tx.to,
        valueEth:    tx.valueEth,
        asset:       tx.asset,
        category:    tx.category,
        nonce:       tx.nonce,
        r:           tx.r,
        s:           tx.s,
        v:           tx.v,
      })),
    });
  } catch (err) {
    req.log?.error(err, "wallet/outgoing error");
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/wallet/signature-scan
 * Body: { address, chain?, enrichLimit?, batchSize?, concurrency? }
 *
 * Full pipeline:
 *  1. Pages ALL outgoing txs from Blockscout (handles 33k+ wallets)
 *  2. Detects nonce reuse from the nonce field (free — no extra RPC calls)
 *  3. Batch-fetches r/s/v using JSON-RPC batch (50/call, concurrent)
 *  4. Runs r-value duplicate + weak-k + key-recovery analysis
 */
router.post("/signature-scan", async (req, res) => {
  const address     = String(req.body?.address ?? "");
  const chainId     = String(req.body?.chain ?? "ethereum");
  // enrichLimit: how many sigs to enrich. Default 50k (effectively unlimited for most wallets)
  const enrichLimit = Math.min(parseInt(String(req.body?.enrichLimit ?? "50000")), 100_000);
  const batchSize   = Math.min(parseInt(String(req.body?.batchSize   ?? "50")), 100);
  const concurrency = Math.min(parseInt(String(req.body?.concurrency ?? "10")), 20);

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  try {
    const result = await fullSignatureScan(address, chainId, enrichLimit, batchSize, concurrency);
    res.json({
      address:          result.address,
      chain:            result.chain,
      chainLabel:       result.chainLabel,
      nonce:            result.nonce,
      balanceEth:       result.balanceEth,
      source:           result.source,
      totalTxsFetched:  result.totalTxsFetched,
      sigsAnalyzed:     result.sigsEnriched,
      nonceReuseFound:  result.nonceReuseFound,
      nonceReusePairs:  result.nonceReusePairs,
      rValueDuplicates: result.rValueDuplicates,
      sValueDuplicates: result.sValueDuplicates,
      weakKCandidates:  result.weakKCandidates,
      keyRecovered:     result.keyRecovered,
      summary:          result.summary,
      durationMs:       result.durationMs,
      error:            result.error,
    });
  } catch (err) {
    req.log?.error(err, "wallet/signature-scan error");
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/wallet/multi-chain?address=0x...
 * Checks nonce on ALL supported chains — quick reachability check.
 */
router.get("/multi-chain", async (req, res) => {
  const address = String(req.query.address ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  const results = await Promise.allSettled(
    CHAINS.map(async chain => {
      const { nonce, balanceEth } = await fetchNonceAndBalance(address, chain.rpcUrl, chain.id);
      return { chain: chain.id, label: chain.label, nonce, balanceEth, active: nonce > 0 };
    }),
  );

  const chains = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { chain: CHAINS[i].id, label: CHAINS[i].label, nonce: 0, balanceEth: 0, active: false, error: r.reason?.message },
  );

  res.json({ address, chains, activeChains: chains.filter(c => c.active).map(c => c.chain) });
});

export default router;
