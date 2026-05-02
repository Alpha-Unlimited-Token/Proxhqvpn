/**
 * Developer External Audit Routes
 * ================================
 * Real external scanning endpoints — no simulators, no mocked data.
 *
 *   POST /api/dev-audit/rpc-probe        — probe a live JSON-RPC endpoint
 *   POST /api/dev-audit/headers-check    — scan HTTP security headers on a live URL
 *   POST /api/dev-audit/contract-test    — test a deployed contract on-chain
 *   POST /api/dev-audit/key-entropy      — audit key generation entropy from real addresses
 *   POST /api/dev-audit/contract-source  — static analysis of Solidity source code
 */

import { Router, type Request, type Response } from "express";
import { probeRpcEndpoint }    from "../lib/dev-audit/rpc-prober";
import { checkSecurityHeaders } from "../lib/dev-audit/headers-checker";
import { testLiveContract }    from "../lib/dev-audit/live-contract-tester";
import { auditKeyEntropy }     from "../lib/dev-audit/key-entropy-auditor";
import { scanContractSource }  from "../lib/dev-audit/contract-scanner";
import { runRpcAttackSuite }   from "../lib/dev-audit/rpc-attack-suite";
import {
  runClickFixScan,
  runBlockchainC2Scan,
  runSsrfProbe,
  runAuthBypassScan,
  runEndpointDiscovery,
  runDnsRebindingTest,
} from "../lib/dev-audit/pentest-suite";
import { universalWalletScan }   from "../lib/dev-audit/wallet-chain-detector";
import { scanEcdsaSignatures }   from "../lib/dev-audit/ecdsa-nonce-scanner";
import { runAdvancedScan }       from "../lib/dev-audit/advanced-wallet-scanner";
import { logger }              from "../lib/logger";

const router = Router();

const SUPPORTED_CHAINS = ["ethereum", "polygon", "bsc", "arbitrum", "optimism"];

// POST /api/dev-audit/rpc-probe
router.post("/rpc-probe", async (req: Request, res: Response) => {
  const { endpoint } = req.body as Record<string, unknown>;
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return res.status(400).json({ error: "endpoint (string) is required" });
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "endpoint must be a valid http:// or https:// URL" });
  }
  // Block private/loopback ranges for external scanning
  const host = parsed.hostname.toLowerCase();
  const isInternal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal) {
    return res.status(400).json({ error: "Cannot probe internal/loopback addresses. The tool scans external endpoints only." });
  }
  try {
    const result = await probeRpcEndpoint(endpoint.trim());
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "rpc-probe error");
    return res.status(500).json({ error: "Probe failed — check the endpoint URL and ensure it is publicly accessible" });
  }
});

// POST /api/dev-audit/headers-check
router.post("/headers-check", async (req: Request, res: Response) => {
  const { url } = req.body as Record<string, unknown>;
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "url (string) is required" });
  }
  let normalized = url.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return res.status(400).json({ error: "url must be a valid URL" });
  }
  const host = parsed.hostname.toLowerCase();
  const isInternal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal) {
    return res.status(400).json({ error: "Cannot scan internal/loopback addresses. Provide a publicly accessible URL." });
  }
  try {
    const result = await checkSecurityHeaders(normalized);
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "headers-check error");
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return res.status(422).json({ error: `Could not reach ${normalized} — ensure the URL is publicly accessible` });
    }
    return res.status(500).json({ error: "Headers scan failed" });
  }
});

// POST /api/dev-audit/contract-test
router.post("/contract-test", async (req: Request, res: Response) => {
  const { address, chain } = req.body as Record<string, unknown>;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
    return res.status(400).json({ error: "address must be a valid 0x-prefixed Ethereum address" });
  }
  const resolvedChain = typeof chain === "string" && SUPPORTED_CHAINS.includes(chain.toLowerCase())
    ? chain.toLowerCase()
    : "ethereum";
  try {
    const result = await testLiveContract(address.trim(), resolvedChain);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "contract-test error");
    return res.status(500).json({ error: "Contract test failed — check the address and chain" });
  }
});

// POST /api/dev-audit/key-entropy
router.post("/key-entropy", async (req: Request, res: Response) => {
  const { addresses } = req.body as Record<string, unknown>;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: "addresses must be a non-empty array of Ethereum addresses" });
  }
  if (addresses.length > 500) {
    return res.status(400).json({ error: "Maximum 500 addresses per audit request" });
  }
  const stringAddresses = addresses.filter((a): a is string => typeof a === "string");
  try {
    const result = auditKeyEntropy(stringAddresses);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "key-entropy error");
    return res.status(500).json({ error: "Entropy audit failed" });
  }
});

// POST /api/dev-audit/contract-source
router.post("/contract-source", async (req: Request, res: Response) => {
  const { source } = req.body as Record<string, unknown>;
  if (typeof source !== "string" || source.trim().length < 10) {
    return res.status(400).json({ error: "source must be a non-empty Solidity source string" });
  }
  if (source.length > 500_000) {
    return res.status(400).json({ error: "Source too large — maximum 500KB" });
  }
  try {
    const result = scanContractSource(source);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "contract-source error");
    return res.status(500).json({ error: "Source analysis failed" });
  }
});

// ── Pentest Suite Routes ──────────────────────────────────────────────────────

// POST /api/dev-audit/pentest/clickfix — ClickFix & UI deception scanner
router.post("/pentest/clickfix", async (req: Request, res: Response) => {
  const { url } = req.body as Record<string, unknown>;
  if (typeof url !== "string" || !url.trim()) return res.status(400).json({ error: "url (string) required" });
  try { new URL(url.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  try {
    const result = await runClickFixScan(url.trim());
    return res.json(result);
  } catch (err) { req.log.error({ err }, "clickfix scan error"); return res.status(500).json({ error: "Scan failed" }); }
});

// POST /api/dev-audit/pentest/blockchain-c2 — blockchain C2 channel detector
router.post("/pentest/blockchain-c2", async (req: Request, res: Response) => {
  const { contractAddress, chain } = req.body as Record<string, unknown>;
  if (typeof contractAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress.trim())) {
    return res.status(400).json({ error: "contractAddress must be a valid 0x... Ethereum address" });
  }
  const chainName = typeof chain === "string" ? chain : "ethereum";
  try {
    const result = await runBlockchainC2Scan(contractAddress.trim(), chainName);
    return res.json(result);
  } catch (err) { req.log.error({ err }, "blockchain-c2 scan error"); return res.status(500).json({ error: "Scan failed" }); }
});

// POST /api/dev-audit/pentest/ssrf — SSRF probe
router.post("/pentest/ssrf", async (req: Request, res: Response) => {
  const { targetApi } = req.body as Record<string, unknown>;
  if (typeof targetApi !== "string" || !targetApi.trim()) return res.status(400).json({ error: "targetApi (string) required" });
  try { new URL(targetApi.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  try {
    const result = await runSsrfProbe(targetApi.trim());
    return res.json(result);
  } catch (err) { req.log.error({ err }, "ssrf probe error"); return res.status(500).json({ error: "Probe failed" }); }
});

// POST /api/dev-audit/pentest/auth-bypass — authentication bypass scanner
router.post("/pentest/auth-bypass", async (req: Request, res: Response) => {
  const { targetBase } = req.body as Record<string, unknown>;
  if (typeof targetBase !== "string" || !targetBase.trim()) return res.status(400).json({ error: "targetBase (string) required" });
  try { new URL(targetBase.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  try {
    const result = await runAuthBypassScan(targetBase.trim());
    return res.json(result);
  } catch (err) { req.log.error({ err }, "auth-bypass scan error"); return res.status(500).json({ error: "Scan failed" }); }
});

// POST /api/dev-audit/pentest/endpoint-discovery — sensitive path bruteforce
router.post("/pentest/endpoint-discovery", async (req: Request, res: Response) => {
  const { targetBase } = req.body as Record<string, unknown>;
  if (typeof targetBase !== "string" || !targetBase.trim()) return res.status(400).json({ error: "targetBase (string) required" });
  try { new URL(targetBase.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  try {
    const result = await runEndpointDiscovery(targetBase.trim());
    return res.json(result);
  } catch (err) { req.log.error({ err }, "endpoint-discovery error"); return res.status(500).json({ error: "Discovery failed" }); }
});

// POST /api/dev-audit/pentest/dns-rebinding — DNS rebinding vulnerability test
router.post("/pentest/dns-rebinding", async (req: Request, res: Response) => {
  const { targetUrl } = req.body as Record<string, unknown>;
  if (typeof targetUrl !== "string" || !targetUrl.trim()) return res.status(400).json({ error: "targetUrl (string) required" });
  try { new URL(targetUrl.trim()); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  try {
    const result = await runDnsRebindingTest(targetUrl.trim());
    return res.json(result);
  } catch (err) { req.log.error({ err }, "dns-rebinding test error"); return res.status(500).json({ error: "Test failed" }); }
});

// POST /api/dev-audit/rpc-attack
// Full hacker-technique RPC attack suite:
//   batch amplification, cache probing, namespace enumeration, parameter fuzzing
router.post("/rpc-attack", async (req: Request, res: Response) => {
  const { endpoint } = req.body as Record<string, unknown>;
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return res.status(400).json({ error: "endpoint (string) is required" });
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "endpoint must be a valid http:// or https:// URL" });
  }
  const host = parsed.hostname.toLowerCase();
  const isInternal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal) {
    return res.status(400).json({ error: "Only external endpoints can be tested. Use a publicly accessible URL." });
  }
  try {
    const result = await runRpcAttackSuite(endpoint.trim());
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "rpc-attack error");
    return res.status(500).json({ error: "Attack suite failed — verify the endpoint is reachable" });
  }
});

// POST /api/dev-audit/ecdsa-scan
// Fetches real transaction signatures from Ethereum, checks for ECDSA nonce (k) reuse,
// r-value collisions, low r-values, and malleable s-values.
router.post("/ecdsa-scan", async (req: Request, res: Response) => {
  const { address } = req.body as Record<string, unknown>;
  if (typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ error: "address (string) is required" });
  }
  const cleaned = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(cleaned)) {
    return res.status(400).json({ error: "ECDSA scan requires a valid EVM address (0x + 40 hex chars)" });
  }
  try {
    const result = await scanEcdsaSignatures(cleaned);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "ecdsa-scan error");
    return res.status(500).json({ error: "ECDSA scan failed" });
  }
});

// POST /api/dev-audit/ecdsa-batch
// Scan multiple EVM addresses in one request (max 20).
router.post("/ecdsa-batch", async (req: Request, res: Response) => {
  const { addresses } = req.body as Record<string, unknown>;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: "addresses (string[]) is required" });
  }
  if (addresses.length > 20) {
    return res.status(400).json({ error: "Maximum 20 addresses per batch" });
  }
  const cleaned = (addresses as unknown[])
    .filter((a): a is string => typeof a === "string")
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "No valid EVM addresses provided" });
  }
  try {
    const results = await Promise.all(cleaned.map(a => scanEcdsaSignatures(a)));
    return res.json({ results, scanned: cleaned.length });
  } catch (err) {
    req.log.error({ err }, "ecdsa-batch error");
    return res.status(500).json({ error: "Batch ECDSA scan failed" });
  }
});

// POST /api/dev-audit/advanced-scan
// Runs Profanity/vanity detection, weak-RNG r-value fingerprinting, and contract escape hatch analysis.
router.post("/advanced-scan", async (req: Request, res: Response) => {
  const { address, rValues } = req.body as Record<string, unknown>;
  if (typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ error: "address (string) is required" });
  }
  const cleaned = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(cleaned)) {
    return res.status(400).json({ error: "advanced-scan requires a valid EVM address (0x + 40 hex chars)" });
  }
  const rVals = Array.isArray(rValues) ? (rValues as unknown[]).filter((r): r is string => typeof r === "string") : [];
  try {
    const result = await runAdvancedScan(cleaned, rVals);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "advanced-scan error");
    return res.status(500).json({ error: "Advanced scan failed" });
  }
});

// POST /api/dev-audit/advanced-batch
// Run advanced scans on up to 20 addresses. Pass optional rValues map keyed by lowercase address.
router.post("/advanced-batch", async (req: Request, res: Response) => {
  const { addresses, rValuesMap } = req.body as Record<string, unknown>;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: "addresses (string[]) is required" });
  }
  if (addresses.length > 20) return res.status(400).json({ error: "Maximum 20 addresses per batch" });
  const cleaned = (addresses as unknown[])
    .filter((a): a is string => typeof a === "string")
    .map(a => a.trim())
    .filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
  if (cleaned.length === 0) return res.status(400).json({ error: "No valid EVM addresses provided" });
  const rMap = (rValuesMap && typeof rValuesMap === "object") ? rValuesMap as Record<string, string[]> : {};
  try {
    const results = await Promise.all(
      cleaned.map(a => runAdvancedScan(a, rMap[a.toLowerCase()] ?? []))
    );
    return res.json({ results, scanned: cleaned.length });
  } catch (err) {
    req.log.error({ err }, "advanced-batch error");
    return res.status(500).json({ error: "Batch advanced scan failed" });
  }
});

// POST /api/dev-audit/universal-scan
// Self-adaptive: auto-detects blockchain from address format and runs the correct scan suite.
// Supports EVM (10 chains), Bitcoin, Solana, TRON, XRP, Litecoin, Dogecoin, Cardano, Cosmos.
router.post("/universal-scan", async (req: Request, res: Response) => {
  const { address } = req.body as Record<string, unknown>;
  if (typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ error: "address (string) is required" });
  }
  const cleaned = address.trim();
  if (cleaned.length < 20 || cleaned.length > 200) {
    return res.status(400).json({ error: "address length must be between 20 and 200 characters" });
  }
  try {
    const result = await universalWalletScan(cleaned);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "universal-scan error");
    return res.status(500).json({ error: "Scan failed — check the address format" });
  }
});

export default router;
