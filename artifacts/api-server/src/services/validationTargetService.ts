// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Manages allowlisted ProxhqVPN-owned validation targets.
// NEVER allows scanning of third-party IPs or customer systems.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface ValidationTarget {
  id: string;
  name: string;
  target_type: string;
  url: string | null;
  host: string | null;
  port: number | null;
  region: string | null;
  environment: string;
  owned_by: string | null;
  allow_security_scans: boolean;
  allow_load_tests: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateValidationTargetInput {
  name: string;
  target_type: "web" | "api" | "vpn_node" | "wireguard" | "container" | "repository" | "dns" | "tls" | "synthetic";
  url?: string;
  host?: string;
  port?: number;
  region?: string;
  environment?: string;
  owned_by?: string;
  allow_security_scans?: boolean;
  allow_load_tests?: boolean;
  metadata?: Record<string, unknown>;
}

const SECURITY_SCAN_TYPES = ["zap", "trivy", "semgrep", "dependency"];
const LOAD_TEST_TYPES = ["k6"];

export async function createValidationTarget(input: CreateValidationTargetInput): Promise<ValidationTarget> {
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO validation_targets
      (id, name, target_type, url, host, port, region, environment, owned_by,
       allow_security_scans, allow_load_tests, metadata)
    VALUES
      (${id}, ${input.name}, ${input.target_type},
       ${input.url ?? null}, ${input.host ?? null}, ${input.port ?? null},
       ${input.region ?? null}, ${input.environment ?? "production"},
       ${input.owned_by ?? "alpha-unlimited-technologies"},
       ${input.allow_security_scans ?? false}, ${input.allow_load_tests ?? false},
       ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);
  return getValidationTarget(id) as Promise<ValidationTarget>;
}

export async function listValidationTargets(): Promise<ValidationTarget[]> {
  const result = await db.execute(sql`
    SELECT * FROM validation_targets WHERE enabled = TRUE ORDER BY created_at DESC
  `);
  return (result as { rows: ValidationTarget[] }).rows;
}

export async function getValidationTarget(id: string): Promise<ValidationTarget | null> {
  const result = await db.execute(sql`
    SELECT * FROM validation_targets WHERE id = ${id}::uuid LIMIT 1
  `);
  const rows = (result as { rows: ValidationTarget[] }).rows;
  return rows[0] ?? null;
}

export async function assertTargetAllowed(
  target: ValidationTarget,
  runType: string,
): Promise<void> {
  if (!target.enabled) {
    throw new Error(`Target "${target.name}" is disabled.`);
  }
  if (SECURITY_SCAN_TYPES.includes(runType) && !target.allow_security_scans) {
    throw new Error(
      `Security scans are not enabled for target "${target.name}". ` +
      `Set allow_security_scans=true on the target record to permit this scan type.`,
    );
  }
  if (LOAD_TEST_TYPES.includes(runType) && !target.allow_load_tests) {
    throw new Error(
      `Load tests are not enabled for target "${target.name}". ` +
      `Set allow_load_tests=true on the target record to permit this run type.`,
    );
  }
  const owned = target.owned_by ?? "";
  if (!owned) {
    throw new Error(`Target "${target.name}" has no owned_by — cannot confirm ownership. Set owned_by to proceed.`);
  }
}

export async function updateValidationTarget(
  id: string,
  patch: Partial<CreateValidationTargetInput>,
): Promise<ValidationTarget | null> {
  await db.execute(sql`
    UPDATE validation_targets
    SET
      name                 = COALESCE(${patch.name ?? null}, name),
      allow_security_scans = COALESCE(${patch.allow_security_scans ?? null}, allow_security_scans),
      allow_load_tests     = COALESCE(${patch.allow_load_tests ?? null}, allow_load_tests),
      metadata             = COALESCE(${patch.metadata ? JSON.stringify(patch.metadata) + "::jsonb" : null}, metadata)
    WHERE id = ${id}::uuid
  `);
  return getValidationTarget(id);
}
