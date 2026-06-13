// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export const terminalJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const terminalJobSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string(),
  command: z.string(),
  ghostMode: z.boolean(),
  timeout: z.number(),
  status: terminalJobStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().optional(),
  error: z.string().optional(),
});

export const terminalExecRequestSchema = z.object({
  command: z.string().trim().min(1).max(1000),
  ghostMode: z.boolean().optional().default(false),
  timeout: z.number().min(1000).max(60000).optional().default(15000),
});

export const terminalExecQueuedResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: terminalJobStatusSchema,
  createdAt: z.string(),
  pollUrl: z.string(),
});

export const terminalJobResponseSchema = z.object({
  job: terminalJobSchema,
});

export const meResponseSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  isAdmin: z.boolean(),
  isEmployee: z.boolean(),
  isAdminEmployee: z.boolean(),
  role: z.string().nullable(),
  hasAccess: z.boolean(),
  hasSubscription: z.boolean(),
  hasCommandCenter: z.boolean(),
  devTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  hasArsenal: z.boolean(),
  tier: z.union([z.literal("vpn"), z.literal("command_center")]).nullable(),
  billingStatus: z.string().nullable().optional(),
});

export type TerminalJob = z.infer<typeof terminalJobSchema>;
export type TerminalExecRequest = z.infer<typeof terminalExecRequestSchema>;
export type TerminalExecQueuedResponse = z.infer<
  typeof terminalExecQueuedResponseSchema
>;
export type MeResponse = z.infer<typeof meResponseSchema>;
