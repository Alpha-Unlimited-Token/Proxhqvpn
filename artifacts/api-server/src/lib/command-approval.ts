// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// C-4: Two-person rule for high-risk terminal commands.

import crypto from "crypto";
import { appendAuditEvent } from "./audit-chain";
import { logger } from "./logger";

export interface CommandApprovalRequest {
  id:          string;
  requestedBy: string;
  command:     string;
  targetHost:  string;
  reason:      string;
  status:      "pending" | "approved" | "denied" | "expired";
  requestedAt: string;
  expiresAt:   string;
  approvedBy:  string | null;
  approvedAt:  string | null;
}

const pendingApprovals = new Map<string, CommandApprovalRequest>();
const APPROVAL_TTL_MS  = 5 * 60_000;  // 5 minutes to approve

// Expire stale entries on a background interval
setInterval(() => {
  const now = Date.now();
  for (const [id, req] of pendingApprovals) {
    if (new Date(req.expiresAt).getTime() < now) {
      req.status = "expired";
      pendingApprovals.delete(id);
    }
  }
}, 60_000);

export function requestCommandApproval(
  requestedBy: string,
  command:     string,
  targetHost:  string,
  reason:      string,
): CommandApprovalRequest {
  const id  = crypto.randomUUID();
  const now = new Date();
  const req: CommandApprovalRequest = {
    id,
    requestedBy,
    command,
    targetHost,
    reason,
    status:      "pending",
    requestedAt: now.toISOString(),
    expiresAt:   new Date(now.getTime() + APPROVAL_TTL_MS).toISOString(),
    approvedBy:  null,
    approvedAt:  null,
  };
  pendingApprovals.set(id, req);

  appendAuditEvent({
    actor:    requestedBy,
    action:   "command_approval.requested",
    resource: `approval:${id}`,
    result:   "allow",
    metadata: { command: command.slice(0, 100), targetHost, reason },
  });

  logger.warn(
    { approvalId: id, requestedBy, command: command.slice(0, 80) },
    "[command-approval] High-risk command pending approval",
  );

  return req;
}

export function getPendingApprovals(): CommandApprovalRequest[] {
  const now = Date.now();
  for (const [id, req] of pendingApprovals) {
    if (new Date(req.expiresAt).getTime() < now) {
      req.status = "expired";
      pendingApprovals.delete(id);
    }
  }
  return [...pendingApprovals.values()];
}

export function approveCommand(
  approvalId:     string,
  approverUserId: string,
): { ok: true; req: CommandApprovalRequest } | { ok: false; reason: string } {
  const req = pendingApprovals.get(approvalId);
  if (!req) return { ok: false, reason: "Approval request not found or expired" };
  if (req.requestedBy === approverUserId) return { ok: false, reason: "Cannot self-approve — requires a different admin" };
  if (new Date(req.expiresAt).getTime() < Date.now()) return { ok: false, reason: "Approval request has expired" };

  req.status     = "approved";
  req.approvedBy = approverUserId;
  req.approvedAt = new Date().toISOString();
  pendingApprovals.delete(approvalId);

  appendAuditEvent({
    actor:    approverUserId,
    action:   "command_approval.approved",
    resource: `approval:${approvalId}`,
    result:   "allow",
    metadata: { command: req.command.slice(0, 100), requestedBy: req.requestedBy },
  });

  return { ok: true, req };
}

export function denyCommand(
  approvalId:     string,
  approverUserId: string,
  reason?:        string,
): { ok: true } | { ok: false; reason: string } {
  const req = pendingApprovals.get(approvalId);
  if (!req) return { ok: false, reason: "Approval request not found or expired" };
  if (req.requestedBy === approverUserId) return { ok: false, reason: "Cannot self-deny — requires a different admin" };

  req.status = "denied";
  pendingApprovals.delete(approvalId);

  appendAuditEvent({
    actor:    approverUserId,
    action:   "command_approval.denied",
    resource: `approval:${approvalId}`,
    result:   "deny",
    metadata: { command: req.command.slice(0, 100), requestedBy: req.requestedBy, reason },
  });

  return { ok: true };
}
