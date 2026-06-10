import { randomUUID } from "crypto";
import { appendAuditEvent } from "./audit-chain";

export type CommandRisk = "low" | "medium" | "high" | "critical";
export type CommandDecision = "allow" | "requires_approval" | "deny";

export interface CommandRequest {
  actorId: string;
  tenantId?: string | null;
  action: string;
  target: string;
  risk: CommandRisk;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const DENY_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /curl\s+.*\|\s*(bash|sh)/i,
  /wget\s+.*\|\s*(bash|sh)/i,
  /export\s+.*SECRET/i,
  /cat\s+.*(id_rsa|private|secret|\.env)/i,
];

export function classifyCommand(req: CommandRequest): CommandDecision {
  const blob = `${req.action} ${req.target} ${JSON.stringify(req.metadata ?? {})}`;
  if (DENY_PATTERNS.some(p => p.test(blob))) return "deny";
  if (req.risk === "critical" || req.risk === "high") return "requires_approval";
  return "allow";
}

export async function governCommand(req: CommandRequest) {
  const id = randomUUID();
  const decision = classifyCommand(req);
  appendAuditEvent({ actor: req.actorId, action: "command_governance_decision", resource: req.target ?? "", result: decision === "allow" ? "allow" : "deny", metadata: { id, decision, action: req.action, risk: req.risk } });
  return { id, decision };
}
