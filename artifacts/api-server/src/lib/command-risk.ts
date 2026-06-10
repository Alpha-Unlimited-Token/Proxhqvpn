export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface CommandRequest {
  type: string;
  payload: Record<string, unknown>;
  targetScope?: Record<string, unknown>;
}

const CRITICAL_PATTERNS = [
  /rotate.*key/i,
  /delete|destroy|wipe|drop/i,
  /firewall.*deploy/i,
  /node.*restart/i,
  /terminal|shell|exec/i,
  /sql.*write|migration/i,
  /export.*secret/i,
];

const HIGH_PATTERNS = [
  /scan.*external/i,
  /change.*route/i,
  /revoke.*user/i,
  /billing/i,
  /admin/i,
];

export function classifyCommandRisk(req: CommandRequest): RiskLevel {
  const haystack = `${req.type} ${JSON.stringify(req.payload)} ${JSON.stringify(req.targetScope ?? {})}`;
  if (CRITICAL_PATTERNS.some((r) => r.test(haystack))) return "critical";
  if (HIGH_PATTERNS.some((r) => r.test(haystack))) return "high";
  if (Object.keys(req.payload ?? {}).length > 10) return "medium";
  return "low";
}

export function requiredApprovalCount(risk: RiskLevel): number {
  if (risk === "critical") return 2;
  if (risk === "high") return 1;
  return 0;
}
