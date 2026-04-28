/**
 * ENS Reverse Resolver
 * ════════════════════
 * Resolves Ethereum addresses → ENS primary names via eth_call to the
 * ENS ReverseRegistrar.  Uses a single JsonRpcProvider, an in-memory
 * LRU cache (max 10 000 entries), and bounded concurrency (16 parallel
 * requests) so it never floods the RPC endpoint.
 *
 * Usage:
 *   import { resolveEnsNames } from "./ens-resolver";
 *   const map = await resolveEnsNames(["0xabc...", "0xdef..."]);
 *   // map.get("0xabc...") => "vitalik.eth" | null
 */

import { ethers } from "ethers";
import { logger } from "../logger";

// ── Provider (lazy, shared) ───────────────────────────────────────────────────
const RPC_URL = "https://ethereum.publicnode.com";
let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

// ── Simple in-memory cache (address → name | null) ───────────────────────────
const CACHE_MAX = 10_000;
const cache = new Map<string, string | null>();

function cacheGet(addr: string): string | null | undefined {
  return cache.get(addr.toLowerCase());
}
function cacheSet(addr: string, name: string | null): void {
  if (cache.size >= CACHE_MAX) {
    // evict oldest entry
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(addr.toLowerCase(), name);
}

// ── Single-address reverse lookup ─────────────────────────────────────────────
async function lookupOne(address: string): Promise<string | null> {
  const lc = address.toLowerCase();
  const cached = cacheGet(lc);
  if (cached !== undefined) return cached;

  try {
    const name = await getProvider().lookupAddress(lc);
    const result = name ?? null;
    cacheSet(lc, result);
    return result;
  } catch {
    cacheSet(lc, null);
    return null;
  }
}

// ── Batch resolver with bounded concurrency ───────────────────────────────────
const CONCURRENCY = 16;

/**
 * Resolve ENS primary names for a list of addresses.
 * Returns a Map<lowercase_address, ensName | null>.
 * Addresses with no ENS name map to null.
 */
export async function resolveEnsNames(
  addresses: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const deduped = [...new Set(addresses.map(a => a.toLowerCase()))];

  // Separate cache hits from misses
  const misses: string[] = [];
  for (const addr of deduped) {
    const cached = cacheGet(addr);
    if (cached !== undefined) {
      result.set(addr, cached);
    } else {
      misses.push(addr);
    }
  }

  if (misses.length === 0) return result;

  logger.info({ total: deduped.length, uncached: misses.length }, "ENS: resolving addresses");

  // Sliding-window concurrency
  let idx = 0;
  const active = new Set<Promise<void>>();

  while (idx < misses.length || active.size > 0) {
    while (active.size < CONCURRENCY && idx < misses.length) {
      const addr = misses[idx++];
      const p: Promise<void> = lookupOne(addr).then(name => {
        result.set(addr, name);
        active.delete(p);
      });
      active.add(p);
    }
    if (active.size > 0) await Promise.race(active);
  }

  const found = [...result.values()].filter(Boolean).length;
  logger.info({ resolved: deduped.length, withEns: found }, "ENS: resolution complete");

  return result;
}

/**
 * Convenience: look up a single address.
 */
export async function resolveEns(address: string): Promise<string | null> {
  return lookupOne(address);
}

/**
 * Pre-warm the cache for a list of addresses (fire-and-forget).
 * Call early in the pipeline to overlap ENS fetches with other work.
 */
export function prefetchEnsNames(addresses: string[]): void {
  resolveEnsNames(addresses).catch(() => {});
}
