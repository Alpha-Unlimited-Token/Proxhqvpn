// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 349 — Check public-facing files for accidental internal data exposure.
import fs from "node:fs";
import path from "node:path";

const PUBLIC_FILES = [
  "artifacts/api-server/src/routes/trust-center.ts",
  "artifacts/api-server/src/services/publicTrustCenterService.ts",
  "artifacts/ghost-vpn/src/pages/TrustCenter.tsx",
  "artifacts/ghost-vpn/src/pages/PublicStatus.tsx",
].filter(fs.existsSync);

const FORBIDDEN_PATTERNS = [
  [/privateKey/i,                                               "private key exposure"],
  [/wireguard.*config|wg.*\.conf/i,                            "WireGuard config exposure"],
  [/internalIp|internal_ip/i,                                  "internal IP exposure"],
  [/10\.\d+\.\d+\.\d+/,                                        "RFC1918 10.x address"],
  [/192\.168\.\d+\.\d+/,                                       "RFC1918 192.168.x address"],
  [/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,                       "RFC1918 172.16-31.x address"],
  [/raw_output|rawOutput/i,                                     "raw tool output in public API"],
  [/vulnerability.*detail|vuln_detail/i,                       "vulnerability detail in public API"],
];

const findings: string[] = [];

for (const file of PUBLIC_FILES) {
  const src = fs.readFileSync(file, "utf8");
  for (const [pattern, label] of FORBIDDEN_PATTERNS) {
    if ((pattern as RegExp).test(src)) {
      findings.push(`${file}: possible ${label} (pattern: ${pattern})`);
    }
  }
}

if (findings.length) {
  console.error("❌ Public data exposure risks:\n" + findings.join("\n"));
  process.exit(1);
}

if (PUBLIC_FILES.length === 0) {
  console.log("✅ Public data audit passed (no public-facing files to scan)");
} else {
  console.log(`✅ Public data audit passed (${PUBLIC_FILES.length} files scanned)`);
}
