// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { z } from "zod";

export const terminalExecBodySchema = z.object({
  command: z.string().trim().min(1).max(1000),
  shell: z.enum(["bash", "sh", "cmd", "powershell"]).optional().default("bash"),
  ghostMode: z.boolean().optional().default(false),
  timeout: z.number().min(1000).max(60000).optional().default(15000),
});

export const terminalJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const sshConnectBodySchema = z.object({
  host: z.string().min(1).max(253),
  port: z.number().min(1).max(65535).optional().default(22),
  username: z.string().min(1).max(64),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  label: z.string().max(64).optional(),
  timeout: z.number().min(2000).max(30000).optional().default(10000),
});

export const sshSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

export const sshExecBodySchema = z.object({
  sessionId: z.string().uuid(),
  command: z.string().min(1).max(4096),
  timeout: z.number().min(500).max(120000).optional().default(30000),
});

export const httpRequestBodySchema = z.object({
  url: z.string().url(),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"])
    .default("GET"),
  headers: z.record(z.string()).optional().default({}),
  data: z.string().optional(),
  followRedirects: z.boolean().optional().default(true),
  verifySsl: z.boolean().optional().default(true),
  timeout: z.number().min(500).max(30000).optional().default(10000),
});

export const portScanBodySchema = z.object({
  host: z.string().min(1).max(253),
  ports: z.array(z.number().min(1).max(65535)).max(50),
  timeout: z.number().min(100).max(5000).optional().default(1500),
});
