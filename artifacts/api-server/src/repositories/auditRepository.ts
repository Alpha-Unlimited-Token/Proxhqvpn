// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { appendAuditEvent } from "../lib/audit-chain";

export type AuditResult = "allow" | "deny" | "error";

export type AuditWriteInput = {
  actor: string;
  action: string;
  resource: string;
  result: AuditResult;
  ip?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(input: AuditWriteInput) {
  return appendAuditEvent({
    actor: input.actor,
    action: input.action,
    resource: input.resource,
    result: input.result,
    ip: input.ip,
    metadata: input.metadata,
  });
}
