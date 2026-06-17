// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Custom Detection Signatures — user-defined rules for Ghost Trap alerting.
// Standard pattern matching, no proprietary algorithms.

import { db } from "@workspace/db";
import { detectionSignaturesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import type { IpEnrichment } from "./ip-enrichment";

export interface SignatureCondition {
  field: "country_code" | "asn" | "threat_score" | "abuse_score" |
         "is_tor" | "is_vpn" | "is_known_malicious" | "threat_tag" |
         "probe_type" | "port" | "asn_org";
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains" | "in";
  value: string | number | boolean | string[];
}

export interface DetectionSignature {
  id: number;
  userId: string;
  name: string;
  description: string;
  conditions: SignatureCondition[];
  anyConditions: SignatureCondition[];
  severity: "low" | "medium" | "high" | "critical";
  action: "alert" | "alert_and_block" | "block_only";
  enabled: boolean;
}

function evaluateCondition(
  condition: SignatureCondition,
  enrichment: IpEnrichment,
  probeContext: { probeType?: string; port?: number },
): boolean {
  let actual: string | number | boolean | string[] | null | undefined;
  switch (condition.field) {
    case "country_code":       actual = enrichment.countryCode; break;
    case "asn":                actual = enrichment.asn; break;
    case "asn_org":            actual = enrichment.asnOrg; break;
    case "threat_score":       actual = enrichment.threatScore; break;
    case "abuse_score":        actual = enrichment.abuseConfidenceScore; break;
    case "is_tor":             actual = enrichment.greynoiseIsTor; break;
    case "is_vpn":             actual = enrichment.greynoiseIsVpn; break;
    case "is_known_malicious": actual = enrichment.isKnownMalicious; break;
    case "threat_tag":         actual = enrichment.threatTags; break;
    case "probe_type":         actual = probeContext.probeType; break;
    case "port":               actual = probeContext.port; break;
    default: return false;
  }

  switch (condition.operator) {
    case "eq":  return actual === condition.value;
    case "ne":  return actual !== condition.value;
    case "gt":  return Number(actual) > Number(condition.value);
    case "lt":  return Number(actual) < Number(condition.value);
    case "gte": return Number(actual) >= Number(condition.value);
    case "lte": return Number(actual) <= Number(condition.value);
    case "contains":
      if (Array.isArray(actual)) return actual.includes(String(condition.value));
      return String(actual ?? "").toLowerCase().includes(String(condition.value).toLowerCase());
    case "in":
      if (Array.isArray(condition.value)) return condition.value.includes(actual as string);
      return false;
    default: return false;
  }
}

export function matchesSignature(
  sig: DetectionSignature,
  enrichment: IpEnrichment,
  probeContext: { probeType?: string; port?: number } = {},
): boolean {
  if (!sig.enabled) return false;
  const andPassed = sig.conditions.every(c => evaluateCondition(c, enrichment, probeContext));
  const orPassed = sig.anyConditions.length === 0 ||
    sig.anyConditions.some(c => evaluateCondition(c, enrichment, probeContext));
  return andPassed && orPassed;
}

export async function evaluateSignatures(
  userId: string,
  enrichment: IpEnrichment,
  probeContext: { probeType?: string; port?: number } = {},
): Promise<DetectionSignature[]> {
  const sigs = await db.select()
    .from(detectionSignaturesTable)
    .where(and(
      eq(detectionSignaturesTable.userId, userId),
      eq(detectionSignaturesTable.enabled, true),
    ));

  return sigs
    .map(row => ({
      ...row,
      conditions:    row.conditions    as SignatureCondition[],
      anyConditions: row.anyConditions as SignatureCondition[],
    } as DetectionSignature))
    .filter(sig => matchesSignature(sig, enrichment, probeContext));
}

// Pre-built system signatures (applied to all users automatically)
export const SYSTEM_SIGNATURES: Omit<DetectionSignature, "id" | "userId">[] = [
  {
    name: "Tor Exit Node",
    description: "Any probe from a confirmed Tor exit node",
    conditions: [{ field: "is_tor", operator: "eq", value: true }],
    anyConditions: [],
    severity: "high",
    action: "alert_and_block",
    enabled: true,
  },
  {
    name: "High Abuse Score",
    description: "Source IP has AbuseIPDB confidence score above 80",
    conditions: [{ field: "abuse_score", operator: "gte", value: 80 }],
    anyConditions: [],
    severity: "critical",
    action: "alert_and_block",
    enabled: true,
  },
  {
    name: "Known Malicious Infrastructure",
    description: "Source confirmed malicious by GreyNoise and AbuseIPDB",
    conditions: [{ field: "is_known_malicious", operator: "eq", value: true }],
    anyConditions: [],
    severity: "critical",
    action: "alert_and_block",
    enabled: true,
  },
  {
    name: "Bulletproof Hosting",
    description: "Source hosted on known bulletproof or high-abuse ASNs",
    conditions: [{ field: "threat_tag", operator: "contains", value: "bulletproof-hosting" }],
    anyConditions: [],
    severity: "high",
    action: "alert",
    enabled: true,
  },
];
