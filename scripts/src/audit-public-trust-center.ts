// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// audit-public-trust-center.ts
// Verifies that public Trust Center API routes do NOT expose private/sensitive data.
//
// Checks:
//  - No private IPs (RFC-1918 + RFC-4193) in responses
//  - No raw vulnerability details in responses
//  - No WireGuard private keys or configs
//  - No secrets or tokens
//  - No internal node inventory
//  - All public routes return only approved fields
//
// Run: pnpm --filter @workspace/scripts run audit:trust-center

const BASE_URL = process.env.PUBLIC_API_URL ?? "http://localhost:8080";

const PRIVATE_IP_PATTERNS = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\bfd[0-9a-f]{2}:/i,
  /\bfc[0-9a-f]{2}:/i,
];

const SECRET_PATTERNS = [
  /private[_\s-]?key/i,
  /secret[_\s-]?key/i,
  /api[_\s-]?key/i,
  /bearer\s+[a-z0-9._-]{20,}/i,
  /authorization:\s*bearer/i,
  /-----BEGIN.{0,20}PRIVATE KEY-----/,
  /[a-z0-9]{32,}==/i,
];

const WIREGUARD_PATTERNS = [
  /\[Interface\]/i,
  /\[Peer\]/i,
  /PrivateKey\s*=/i,
  /AllowedIPs\s*=/i,
  /Endpoint\s*=\s*\d/i,
];

const VULN_PATTERNS = [
  /CVE-\d{4}-\d{4,}/i,
  /"severity"\s*:\s*"critical"/i,
  /"exploit"/i,
  /remote code execution/i,
  /"affected_hosts"/i,
  /"vulnerability_details"/i,
];

const NODE_INVENTORY_PATTERNS = [
  /"server_ip"/i,
  /"internal_ip"/i,
  /"node_ip"/i,
  /"wg_endpoint"/i,
  /"private_endpoint"/i,
];

// Approved top-level fields for each endpoint
const APPROVED_FIELDS: Record<string, string[]> = {
  "/api/trust-center/summary": [
    "trustScore", "maxScore", "validationStatus", "lastValidationRun",
    "uptime30d", "uptime90d", "uptime365d", "complianceStatus",
    "openPublicIncidents", "resolvedIncidentsCount", "securityProgramSummary", "lastUpdated",
  ],
  "/api/trust-center/validation-summary": [
    "latestScore", "maxScore", "lastValidationAt", "checksPerformed",
    "passed", "failed", "warning", "checksTypes", "lastUpdated",
  ],
  "/api/trust-center/status": [
    "overallStatus", "components", "activeIncidents", "updatedAt",
  ],
  "/api/trust-center/documents": [
    "documents",
  ],
};

interface AuditResult {
  route: string;
  passed: boolean;
  violations: string[];
}

async function auditRoute(route: string): Promise<AuditResult> {
  const violations: string[] = [];
  const url = `${BASE_URL}${route}`;

  let body: string;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { route, passed: false, violations: [`HTTP ${res.status} — route unreachable`] };
    }
    body = await res.text();
  } catch (err) {
    return { route, passed: false, violations: [`Network error: ${String(err)}`] };
  }

  // Private IPs
  for (const pat of PRIVATE_IP_PATTERNS) {
    if (pat.test(body)) violations.push(`PRIVATE IP EXPOSED: matched ${pat.source}`);
  }

  // Secrets / tokens
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(body)) violations.push(`SECRET/TOKEN EXPOSED: matched ${pat.source}`);
  }

  // WireGuard configs
  for (const pat of WIREGUARD_PATTERNS) {
    if (pat.test(body)) violations.push(`WIREGUARD CONFIG EXPOSED: matched ${pat.source}`);
  }

  // Raw vulnerabilities
  for (const pat of VULN_PATTERNS) {
    if (pat.test(body)) violations.push(`RAW VULNERABILITY EXPOSED: matched ${pat.source}`);
  }

  // Internal node inventory
  for (const pat of NODE_INVENTORY_PATTERNS) {
    if (pat.test(body)) violations.push(`NODE INVENTORY EXPOSED: matched ${pat.source}`);
  }

  // Approved fields check
  const approvedFields = APPROVED_FIELDS[route];
  if (approvedFields) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const keys   = Object.keys(parsed);
      const unexpected = keys.filter(k => !approvedFields.includes(k));
      if (unexpected.length > 0) {
        violations.push(`UNEXPECTED FIELDS: ${unexpected.join(", ")}`);
      }
    } catch {
      violations.push("PARSE ERROR: response is not valid JSON");
    }
  }

  return { route, passed: violations.length === 0, violations };
}

async function main() {
  console.log("\n🔒 ProxhqVPN Public Trust Center Audit");
  console.log("=".repeat(50));
  console.log(`Target: ${BASE_URL}`);
  console.log("=".repeat(50) + "\n");

  const routes = Object.keys(APPROVED_FIELDS);
  const results = await Promise.all(routes.map(auditRoute));

  let allPassed = true;
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.route}`);
    if (!result.passed) {
      allPassed = false;
      for (const v of result.violations) {
        console.log(`   ⚠️  ${v}`);
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  if (allPassed) {
    console.log("✅ All Trust Center audit checks PASSED.");
    console.log("   No private data, IPs, secrets, or vulnerabilities exposed.");
  } else {
    console.log("❌ AUDIT FAILED — violations found above.");
    console.log("   Fix all violations before deploying to production.");
    process.exit(1);
  }
  console.log("=".repeat(50) + "\n");
}

void main();
