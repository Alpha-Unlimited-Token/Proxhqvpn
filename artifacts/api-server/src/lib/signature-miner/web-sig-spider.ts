/**
 * Engine 2 — Web Signature Spider
 * ════════════════════════════════
 * BFS web crawler that hunts for exposed private keys, mnemonics, ECDSA
 * signatures, and seed phrases across public websites, paste sites,
 * GitHub Gists, and similar surfaces.
 *
 * Equivalent to: AlphaWebScraper™ — rewritten for the blockchain domain.
 * Worm model: each "worm" is an async task that crawls one URL, extracts
 * targets, enqueues new URLs, and reports back. Multiple worms run in
 * parallel with adaptive jitter to avoid rate-limit bans.
 *
 * Extracts:
 *   • Raw private keys       0x[0-9a-f]{64}
 *   • WIF private keys       5[1-9A-HJ-NP-Za-km-z]{51} (Bitcoin)
 *   • ECDSA signatures       0x[0-9a-f]{128,132}
 *   • r/s JSON pairs         "r":"0x…","s":"0x…"
 *   • BIP-39 mnemonics       12 or 24 space-separated dictionary words
 *   • Exposed keystores      {"ciphertext":"…","crypto":{…}} JSON patterns
 *   • HD wallet xpub/xprv    xpub[A-Za-z1-9]{107}
 */

import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WebFindKind =
  | "private_key_hex"
  | "private_key_wif"
  | "ecdsa_signature"
  | "rs_pair"
  | "bip39_mnemonic"
  | "keystore_json"
  | "xpub_xprv"
  | "seed_phrase_partial";

export interface WebSigFind {
  kind:        WebFindKind;
  value:       string;
  url:         string;
  context:     string;     // surrounding text snippet
  depth:       number;
  discoveredAt: string;
  verified:    boolean;
}

export interface WebSpiderResult {
  urlsVisited:  number;
  urlsQueued:   number;
  finds:        WebSigFind[];
  byKind:       Record<WebFindKind, number>;
  errors:       number;
  scannedAt:    string;
}

export interface WebSpiderConfig {
  seeds:        string[];         // starting URLs
  maxDepth?:    number;           // default 3
  maxUrls?:     number;           // default 200
  concurrency?: number;           // parallel worms, default 8
  timeoutMs?:   number;           // per-request timeout, default 8000
  jitterMs?:    [number, number]; // random delay range, default [200, 1200]
  allowedDomains?: string[];      // restrict crawl to these (empty = all)
  userAgent?:   string;
  onProgress?:  (visited: number, queued: number, finds: number) => void;
}

// ── Regex patterns ────────────────────────────────────────────────────────────

const PATTERNS: Array<{ kind: WebFindKind; re: RegExp; verify?: (v: string) => boolean }> = [
  {
    kind: "private_key_hex",
    re:   /(?:private[_\s-]?key|privkey|secret[_\s-]?key|secretKey)["\s:=]+["']?(0x[0-9a-fA-F]{64})["']?/gi,
  },
  {
    kind: "private_key_hex",
    re:   /\b(0x[0-9a-fA-F]{64})\b/g,
    verify: (v: string) => {
      // Filter out hashes by checking if it looks like a real key range
      const n = BigInt(v);
      const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
      return n > 0n && n < N;
    },
  },
  {
    kind: "private_key_wif",
    re:   /\b(5[1-9A-HJ-NP-Za-km-z]{50,51})\b/g,
  },
  {
    kind: "ecdsa_signature",
    re:   /\b(0x[0-9a-fA-F]{128,132})\b/g,
  },
  {
    kind: "rs_pair",
    re:   /"r"\s*:\s*"(0x[0-9a-fA-F]{64})"\s*,\s*"s"\s*:\s*"(0x[0-9a-fA-F]{64})"/gi,
  },
  {
    kind: "bip39_mnemonic",
    re:   /\b(?:[a-z]{3,8}\s){11}[a-z]{3,8}\b|\b(?:[a-z]{3,8}\s){23}[a-z]{3,8}\b/gi,
    verify: (v: string) => {
      const words = v.trim().split(/\s+/);
      return words.length === 12 || words.length === 24;
    },
  },
  {
    kind: "keystore_json",
    re:   /\{[^{}]*"ciphertext"\s*:\s*"[0-9a-f]+"[^{}]*\}/gi,
  },
  {
    kind: "xpub_xprv",
    re:   /\b(xpub[A-Za-z0-9]{107}|xprv[A-Za-z0-9]{107})\b/g,
  },
  {
    kind: "seed_phrase_partial",
    re:   /(?:seed|mnemonic|phrase|recovery)["\s:=]+["']?([a-z]+(?:\s+[a-z]+){3,})/gi,
  },
];

// Known paste/exposure sites to seed (public, no auth required)
const DEFAULT_SEED_PATHS = [
  "https://pastebin.com/archive",
  "https://gist.github.com/discover",
  "https://ghostbin.com/archive",
  "https://controlc.com/archive",
  "https://rentry.co",
  "https://paste.ubuntu.com",
];

// ── Fetch with timeout + jitter ───────────────────────────────────────────────

async function jitterSleep(range: [number, number]): Promise<void> {
  const ms = range[0] + Math.random() * (range[1] - range[0]);
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(
  url: string,
  timeoutMs: number,
  userAgent: string,
): Promise<{ text: string; links: string[]; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,text/plain,application/json",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const ct   = resp.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("text") && !ct.includes("json")) return null;
    const text = await resp.text();
    if (text.length > 2_000_000) return null; // 2 MB cap

    // Extract links
    const links: string[] = [];
    const linkRe = /href=["']([^"'#?][^"']*?)["']/gi;
    let m: RegExpExecArray | null;
    const base = new URL(url);
    while ((m = linkRe.exec(text)) !== null) {
      try {
        const abs = new URL(m[1], base).toString();
        if (abs.startsWith("http")) links.push(abs);
      } catch {}
    }
    return { text, links, finalUrl: resp.url };
  } catch { return null; }
}

// ── Text scanner ──────────────────────────────────────────────────────────────

function scanText(text: string, url: string, depth: number): WebSigFind[] {
  const finds: WebSigFind[] = [];
  const seen = new Set<string>();

  for (const { kind, re, verify } of PATTERNS) {
    const regex = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const value = m[1] ?? m[0];
      if (!value || seen.has(value.toLowerCase())) continue;
      if (verify && !verify(value)) continue;
      seen.add(value.toLowerCase());

      // Extract surrounding context (100 chars each side)
      const start   = Math.max(0, m.index - 100);
      const end     = Math.min(text.length, m.index + value.length + 100);
      const context = text.slice(start, end).replace(/\s+/g, " ").trim();

      finds.push({
        kind, value, url, context, depth,
        discoveredAt: new Date().toISOString(),
        verified: false,
      });
    }
  }
  return finds;
}

// ── Main spider ───────────────────────────────────────────────────────────────

export async function runWebSigSpider(
  config: WebSpiderConfig,
): Promise<WebSpiderResult> {
  const maxDepth    = config.maxDepth   ?? 3;
  const maxUrls     = config.maxUrls    ?? 200;
  const concurrency = config.concurrency ?? 8;
  const timeoutMs   = config.timeoutMs  ?? 8_000;
  const jitter      = config.jitterMs   ?? [200, 1200];
  const ua          = config.userAgent  ?? "Mozilla/5.0 (compatible; SigSpider/1.0)";
  const allowed     = new Set(config.allowedDomains?.map(d => d.toLowerCase()) ?? []);

  const seeds = config.seeds.length > 0 ? config.seeds : DEFAULT_SEED_PATHS;

  // BFS queue: [url, depth]
  const queue:   Array<[string, number]> = seeds.map(u => [u, 0]);
  const visited  = new Set<string>();
  const finds:   WebSigFind[] = [];
  let errors     = 0;

  logger.info({ seeds: seeds.length, maxDepth, maxUrls }, "Web sig spider starting");

  const isAllowed = (url: string) => {
    if (allowed.size === 0) return true;
    try { return allowed.has(new URL(url).hostname.toLowerCase()); } catch { return false; }
  };

  // Worm pool: drain queue with `concurrency` parallel worms
  while (queue.length > 0 && visited.size < maxUrls) {
    const batch = queue.splice(0, concurrency);

    await Promise.all(batch.map(async ([url, depth]) => {
      if (visited.has(url) || !isAllowed(url)) return;
      visited.add(url);

      config.onProgress?.(visited.size, queue.length, finds.length);

      await jitterSleep(jitter);
      const page = await fetchPage(url, timeoutMs, ua);
      if (!page) { errors++; return; }

      // Scan for signatures/keys
      const pagefinds = scanText(page.text, page.finalUrl, depth);
      finds.push(...pagefinds);

      if (pagefinds.length > 0) {
        logger.info({ url, depth, finds: pagefinds.length }, "Web spider hit");
      }

      // Enqueue new links if within depth
      if (depth < maxDepth) {
        for (const link of page.links) {
          if (!visited.has(link) && isAllowed(link) && visited.size + queue.length < maxUrls * 2) {
            queue.push([link, depth + 1]);
          }
        }
      }
    }));
  }

  const byKind: Record<WebFindKind, number> = {} as Record<WebFindKind, number>;
  for (const f of finds) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;

  logger.info({ urlsVisited: visited.size, finds: finds.length, errors }, "Web sig spider done");

  return {
    urlsVisited:  visited.size,
    urlsQueued:   queue.length,
    finds:        dedup(finds),
    byKind,
    errors,
    scannedAt:    new Date().toISOString(),
  };
}

function dedup(finds: WebSigFind[]): WebSigFind[] {
  const seen = new Set<string>();
  return finds.filter(f => {
    const key = `${f.kind}:${f.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
