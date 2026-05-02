// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import dns from "dns/promises";
import { URL } from "url";

// ─── SSRF Guard ────────────────────────────────────────────────────────────────
// Resolves the target hostname via DNS and rejects any IP that falls into a
// private, loopback, link-local, or multicast range. Must be called BEFORE
// any outbound fetch/tcp-connect that accepts user-supplied URLs or hostnames.

const PRIVATE_RANGES: [number, number, number][] = [
  // Loopback: 127.0.0.0/8
  [0x7f000000, 0xff000000, 4],
  // Private: 10.0.0.0/8
  [0x0a000000, 0xff000000, 4],
  // Private: 172.16.0.0/12
  [0xac100000, 0xfff00000, 4],
  // Private: 192.168.0.0/16
  [0xc0a80000, 0xffff0000, 4],
  // Link-local: 169.254.0.0/16 (AWS/GCP/Azure metadata)
  [0xa9fe0000, 0xffff0000, 4],
  // Multicast: 224.0.0.0/4
  [0xe0000000, 0xf0000000, 4],
  // Broadcast / Reserved: 240.0.0.0/4
  [0xf0000000, 0xf0000000, 4],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const int = ipv4ToInt(ip);
  if (int === null) return false;
  return PRIVATE_RANGES.some(([net, mask]) => (int & mask) >>> 0 === net);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  // Loopback ::1
  if (lower === "::1") return true;
  // Unique-local fc00::/7
  if (/^f[cd]/i.test(lower)) return true;
  // Link-local fe80::/10
  if (/^fe[89ab]/i.test(lower)) return true;
  // Mapped IPv4: ::ffff:x.x.x.x
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

export interface SsrfCheckResult {
  blocked: boolean;
  reason?: string;
  resolvedIps?: string[];
}

export async function checkSsrf(target: string, isUrl = true): Promise<SsrfCheckResult> {
  let hostname: string;

  if (isUrl) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return { blocked: true, reason: "Invalid URL format" };
    }
    hostname = parsed.hostname;

    // Block non-http(s) schemes
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { blocked: true, reason: `Forbidden protocol: ${parsed.protocol}` };
    }
  } else {
    hostname = target.trim().toLowerCase();
  }

  // Block raw IP addresses first (no DNS lookup needed)
  const rawIpv4 = ipv4ToInt(hostname);
  if (rawIpv4 !== null && isPrivateIpv4(hostname)) {
    return { blocked: true, reason: `Direct private IPv4 address: ${hostname}` };
  }
  if (isPrivateIpv6(hostname)) {
    return { blocked: true, reason: `Direct private IPv6 address: ${hostname}` };
  }

  // Resolve hostname and check every returned IP
  let addrs: string[];
  try {
    const records = await dns.lookup(hostname, { all: true, family: 0 });
    addrs = records.map((r) => r.address);
  } catch {
    // DNS failure — safe to block (attacker-controlled resolution)
    return { blocked: true, reason: `DNS resolution failed for: ${hostname}` };
  }

  for (const addr of addrs) {
    if (isPrivateIpv4(addr)) {
      return {
        blocked: true,
        reason: `Hostname ${hostname} resolved to private IPv4: ${addr}`,
        resolvedIps: addrs,
      };
    }
    if (isPrivateIpv6(addr)) {
      return {
        blocked: true,
        reason: `Hostname ${hostname} resolved to private IPv6: ${addr}`,
        resolvedIps: addrs,
      };
    }
  }

  return { blocked: false, resolvedIps: addrs };
}

// Convenience: extract hostname from a PostgreSQL connection string and check it.
// Supports both URI format (postgresql://user:pass@host:5432/db) and DSN keyword format.
export async function checkSsrfPostgres(connectionString: string): Promise<SsrfCheckResult> {
  let hostname: string | null = null;

  // Try URI format first
  try {
    const url = new URL(connectionString);
    if (url.hostname) hostname = url.hostname;
  } catch {
    // Try DSN keyword format: host=hostname port=5432 ...
    const match = connectionString.match(/\bhost\s*=\s*([^\s]+)/i);
    if (match) hostname = match[1];
  }

  if (!hostname) {
    return { blocked: true, reason: "Could not parse hostname from connection string" };
  }

  return checkSsrf(hostname, false);
}
