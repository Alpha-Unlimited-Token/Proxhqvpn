// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// SSRF / public-target protection for security lab tool routes.

const PRIVATE_RANGES = [
  /^10\.\d+\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^::1$/,
  /^fc[0-9a-f][0-9a-f]:/i,
];

const LAB_SUFFIXES = [".internal", ".proxhqvpn.local", ".lab"];

export function isPrivateIp(host: string): boolean {
  return PRIVATE_RANGES.some((re) => re.test(host));
}

export function isLabHostname(host: string): boolean {
  return LAB_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Throws if `target` is a public IP or non-lab hostname.
 * Call this before any scanner/sqlmap/osint execution.
 */
export function assertNoPublicTarget(target: string): void {
  const normalized = target.trim();
  if (!normalized) throw new Error("Missing target");

  let host: string;
  try {
    const url = normalized.includes("://")
      ? new URL(normalized)
      : new URL(`http://${normalized}`);
    host = url.hostname;
  } catch {
    throw new Error("Invalid target URL or hostname");
  }

  if (!host) throw new Error("Could not resolve hostname from target");

  if (isPrivateIp(host)) return; // private IPs are allowed
  if (isLabHostname(host)) return; // *.internal / *.proxhqvpn.local / *.lab allowed

  throw new Error(
    `Public targets are not permitted for lab tools. Use an internal lab target (*.internal or *.proxhqvpn.local).`,
  );
}
