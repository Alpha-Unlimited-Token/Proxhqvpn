import { Router } from "express";
import {
  fetchWalletOutgoing,
  fetchNonceAndBalance,
  enrichWithSignatures,
  analyzeSignatures,
  getChain,
  CHAINS,
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
  const data  = await fetchNonceAndBalance(address, chain.rpcUrl);
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
 * Body: { address: string, chain?: string, enrichLimit?: number }
 *
 * Fetches ALL outgoing txs, enriches with r/s/v from RPC,
 * then runs full ECDSA nonce-reuse / r-value collision analysis.
 */
router.post("/signature-scan", async (req, res) => {
  const address     = String(req.body?.address ?? "");
  const chainId     = String(req.body?.chain ?? "ethereum");
  const enrichLimit = Math.min(parseInt(String(req.body?.enrichLimit ?? "500")), 2000);

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid EVM address" });
    return;
  }

  try {
    const summary = await fetchWalletOutgoing(address, chainId, {
      alchemyKey: process.env.ALCHEMY_API_KEY,
      enrichSigs: true,
      enrichLimit,
    });

    const analysis = analyzeSignatures(summary);

    res.json({
      address,
      chain:            chainId,
      chainLabel:       summary.chainLabel,
      nonce:            summary.nonce,
      balanceEth:       summary.balanceEth,
      source:           summary.source,
      totalTxsFetched:  summary.totalFetched,
      sigsAnalyzed:     analysis.totalSigs,
      rValueDuplicates: analysis.rValueDuplicates,
      sValueDuplicates: analysis.sValueDuplicates,
      weakKCandidates:  analysis.weakKCandidates,
      keyRecovered:     analysis.keyRecovered,
      summary:          analysis.summary,
      error:            summary.error ?? null,
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
      const { nonce, balanceEth } = await fetchNonceAndBalance(address, chain.rpcUrl);
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
