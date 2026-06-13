// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { appendAuditEvent } from "./audit-chain";
import { shipSecurityEvent } from "./siem";

export async function auditTerminalEvent(input: {
  actor: string;
  action: string;
  result: "allow" | "deny" | "error";
  ip?: string;
  command?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const metadata = {
    command: input.command,
    ...input.metadata,
  };

  appendAuditEvent({
    actor: input.actor,
    action: input.action,
    resource: "terminal",
    result: input.result,
    ip: input.ip,
    metadata,
  });

  await shipSecurityEvent({
    actor: input.actor,
    action: input.action,
    resource: "terminal",
    result: input.result,
    severity: input.result === "allow" ? "critical" : "high",
    ip: input.ip,
    metadata,
  });
}
