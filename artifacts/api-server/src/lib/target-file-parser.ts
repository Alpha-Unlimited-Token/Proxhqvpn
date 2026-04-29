/**
 * Multi-Format Target File Parser
 * ══════════════════════════════════════════════════════
 * Parses uploaded scan target files and extracts:
 *
 *   • Ethereum / EVM addresses   0x{40 hex}
 *   • ENS names                  something.eth
 *   • Transaction hashes         0x{64 hex}
 *   • Signatures (r,s pairs)     0x{128-130 hex}
 *   • Bitcoin addresses          1…, 3…, bc1…
 *   • Solana addresses           base58, 32–44 chars
 *   • Monero addresses           4…, 86+ chars
 *   • Polkadot SS58              1…, 2…, 5…, 47–50 chars
 *   • Nodes / public keys        0x{128-130 hex} or 0x{66 hex} (compressed)
 *
 * Supported file formats:
 *   • .txt / .log        one item per line, comments (#, //)
 *   • .csv               first non-empty column, skips header if first cell looks like text
 *   • .json / .jsonl     array of strings, or objects with address/addr/wallet/hash/ens fields
 *   • .tsv               tab-separated, first column
 */

import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TargetKind =
  | "eth_address"
  | "ens_name"
  | "tx_hash"
  | "signature"
  | "btc_address"
  | "solana_address"
  | "monero_address"
  | "polkadot_address"
  | "public_key"
  | "unknown";

export interface ParsedTarget {
  raw:   string;
  value: string;           // normalised (lowercase for hex, trimmed for ENS)
  kind:  TargetKind;
  line?: number;           // source line in the file
}

export interface ParseResult {
  targets:     ParsedTarget[];
  totalLines:  number;
  skipped:     number;
  byKind:      Record<TargetKind, number>;
  format:      string;
  errors:      string[];
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// Ethereum address: 0x + 40 hex chars
const RE_ETH  = /^0x[0-9a-fA-F]{40}$/;
// TX hash: 0x + 64 hex chars
const RE_TX   = /^0x[0-9a-fA-F]{64}$/;
// Signature / raw sig: 0x + 128–132 hex chars (v+r+s range)
const RE_SIG  = /^0x[0-9a-fA-F]{128,132}$/;
// Public key (compressed): 0x + 66 hex chars; (uncompressed): 0x + 130 hex chars
const RE_PUBKEY = /^0x(?:02|03|04)[0-9a-fA-F]{64,128}$/;
// ENS name
const RE_ENS  = /^[a-z0-9-]{1,253}\.eth$/i;
// Bitcoin: legacy (1…, 3…), bech32 (bc1…)
const RE_BTC  = /^(?:[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[ac-hj-np-zAC-HJ-NP-Z02-9]{6,87})$/;
// Solana: base58, 32–44 chars (no 0, O, I, l)
const RE_SOL  = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Monero: starts with 4, 95 chars
const RE_XMR  = /^4[0-9A-Za-z]{94}$/;
// Polkadot SS58: starts with 1, 2, or 5; 47–50 chars
const RE_DOT  = /^[125][1-9A-HJ-NP-Za-km-z]{46,49}$/;

// ── Classify a single token ────────────────────────────────────────────────────

export function classifyTarget(raw: string): ParsedTarget | null {
  const v = raw.trim();
  if (!v) return null;

  // Skip comments
  if (v.startsWith("#") || v.startsWith("//")) return null;

  // Ethereum address (check before TX hash because both start 0x)
  if (RE_ETH.test(v))    return { raw: v, value: v.toLowerCase(), kind: "eth_address" };
  // TX hash (64 hex, likely a transaction)
  if (RE_TX.test(v))     return { raw: v, value: v.toLowerCase(), kind: "tx_hash" };
  // Signature (128+ hex)
  if (RE_SIG.test(v))    return { raw: v, value: v.toLowerCase(), kind: "signature" };
  // Public key
  if (RE_PUBKEY.test(v)) return { raw: v, value: v.toLowerCase(), kind: "public_key" };
  // ENS
  if (RE_ENS.test(v))    return { raw: v, value: v.toLowerCase(), kind: "ens_name" };
  // Bitcoin
  if (RE_BTC.test(v))    return { raw: v, value: v, kind: "btc_address" };
  // Monero (check before Solana/Polkadot — 95 chars)
  if (RE_XMR.test(v))    return { raw: v, value: v, kind: "monero_address" };
  // Polkadot SS58
  if (RE_DOT.test(v))    return { raw: v, value: v, kind: "polkadot_address" };
  // Solana (must be after Polkadot — overlapping chars)
  if (RE_SOL.test(v))    return { raw: v, value: v, kind: "solana_address" };

  // Unknown but non-empty
  return { raw: v, value: v, kind: "unknown" };
}

// ── Format parsers ────────────────────────────────────────────────────────────

function parseTxt(content: string): { tokens: Array<{ value: string; line: number }>; errors: string[] } {
  const lines  = content.split(/\r?\n/);
  const tokens: Array<{ value: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Support comma-separated on a single line too
    for (const part of line.split(/[\s,;|]+/)) {
      const v = part.trim();
      if (v) tokens.push({ value: v, line: i + 1 });
    }
  }
  return { tokens, errors: [] };
}

function parseCsv(content: string, sep = ","): { tokens: Array<{ value: string; line: number }>; errors: string[] } {
  const lines  = content.split(/\r?\n/);
  const tokens: Array<{ value: string; line: number }> = [];
  const errors: string[] = [];

  // Skip header if first non-empty cell doesn't look like any target type
  let startRow = 0;
  if (lines.length > 0) {
    const firstCell = lines[0].split(sep)[0].trim();
    if (firstCell && classifyTarget(firstCell)?.kind === "unknown") startRow = 1;
  }

  for (let i = startRow; i < lines.length; i++) {
    const row = lines[i].split(sep);
    // Take first non-empty column that classifies as a known type
    for (const cell of row) {
      const v = cell.replace(/["']/g, "").trim();
      if (!v) continue;
      const classified = classifyTarget(v);
      if (classified && classified.kind !== "unknown") {
        tokens.push({ value: v, line: i + 1 });
        break;
      }
    }
  }
  return { tokens, errors };
}

function parseJson(content: string): { tokens: Array<{ value: string; line: number }>; errors: string[] } {
  const tokens: Array<{ value: string; line: number }> = [];
  const errors: string[] = [];
  try {
    const data = JSON.parse(content);
    const ADDR_KEYS = ["address", "addr", "wallet", "account", "hash", "txhash", "tx_hash", "ens", "target", "id"];
    const extractFrom = (obj: unknown, line: number) => {
      if (typeof obj === "string") { tokens.push({ value: obj.trim(), line }); return; }
      if (Array.isArray(obj))     { obj.forEach((item, i) => extractFrom(item, i + 1)); return; }
      if (obj && typeof obj === "object") {
        for (const key of ADDR_KEYS) {
          const v = (obj as Record<string, unknown>)[key];
          if (typeof v === "string" && v.trim()) {
            tokens.push({ value: v.trim(), line });
            return;
          }
        }
        // Fallback: first string value
        for (const v of Object.values(obj as Record<string, unknown>)) {
          if (typeof v === "string" && v.trim()) { tokens.push({ value: v.trim(), line }); return; }
        }
      }
    };
    if (Array.isArray(data)) {
      data.forEach((item, i) => extractFrom(item, i + 1));
    } else {
      extractFrom(data, 1);
    }
  } catch (err) {
    errors.push(`JSON parse error: ${String(err)}`);
  }
  return { tokens, errors };
}

function parseJsonl(content: string): { tokens: Array<{ value: string; line: number }>; errors: string[] } {
  const tokens: Array<{ value: string; line: number }> = [];
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      const tmp = parseJson(JSON.stringify(obj));
      tokens.push(...tmp.tokens.map(t => ({ ...t, line: i + 1 })));
    } catch {
      // Try as raw value
      if (line.trim()) tokens.push({ value: line.trim(), line: i + 1 });
    }
  }
  return { tokens, errors };
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function parseTargetFile(content: string, filename: string): ParseResult {
  const ext = path.extname(filename).toLowerCase();
  const errors: string[] = [];
  let format = "txt";
  let rawTokens: Array<{ value: string; line: number }> = [];

  if (ext === ".json") {
    format = "json";
    const r = parseJson(content);
    rawTokens = r.tokens;
    errors.push(...r.errors);
  } else if (ext === ".jsonl" || ext === ".ndjson") {
    format = "jsonl";
    const r = parseJsonl(content);
    rawTokens = r.tokens;
    errors.push(...r.errors);
  } else if (ext === ".csv") {
    format = "csv";
    const r = parseCsv(content, ",");
    rawTokens = r.tokens;
    errors.push(...r.errors);
  } else if (ext === ".tsv") {
    format = "tsv";
    const r = parseCsv(content, "\t");
    rawTokens = r.tokens;
    errors.push(...r.errors);
  } else {
    // .txt, .log, .md, or unknown → line-based
    format = ext || "txt";
    const r = parseTxt(content);
    rawTokens = r.tokens;
    errors.push(...r.errors);
  }

  const targets: ParsedTarget[] = [];
  let skipped = 0;
  const totalLines = content.split(/\r?\n/).length;

  const seen = new Set<string>();
  for (const { value, line } of rawTokens) {
    const classified = classifyTarget(value);
    if (!classified) { skipped++; continue; }
    if (classified.kind === "unknown") { skipped++; continue; }
    const dedup = classified.value;
    if (seen.has(dedup)) { skipped++; continue; }
    seen.add(dedup);
    targets.push({ ...classified, line });
  }

  const byKind: Record<TargetKind, number> = {} as Record<TargetKind, number>;
  for (const t of targets) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;

  return { targets, totalLines, skipped, byKind, format, errors };
}

// ── Convenience: extract only Ethereum addresses from a ParseResult ───────────
export function extractEthAddresses(result: ParseResult): string[] {
  return result.targets
    .filter(t => t.kind === "eth_address")
    .map(t => t.value);
}

// ── Convenience: extract all scannable addresses (all chains) ─────────────────
export function extractAllAddresses(result: ParseResult): { address: string; chain: string }[] {
  const CHAIN_MAP: Partial<Record<TargetKind, string>> = {
    eth_address:      "ethereum",
    btc_address:      "bitcoin",
    solana_address:   "solana",
    monero_address:   "monero",
    polkadot_address: "polkadot",
    ens_name:         "ethereum",
  };
  return result.targets
    .filter(t => CHAIN_MAP[t.kind])
    .map(t => ({ address: t.value, chain: CHAIN_MAP[t.kind]! }));
}
