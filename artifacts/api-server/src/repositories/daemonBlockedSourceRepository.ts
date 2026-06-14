// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Persistent daemon blocked-source registry — richer than the in-memory ban Map.
// Supports per-node blocks, expiry, reason, and metadata.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface BlockInput {
  sourceIp:   string;
  reason:     string;
  nodeId?:    string | null;
  expiresAt?: Date | null;
  metadata?:  Record<string, unknown>;
}

export async function blockDaemonSource(input: BlockInput): Promise<{ id: string }> {
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO daemon_blocked_sources
      (id, source_ip, reason, node_id, expires_at, metadata)
    VALUES (
      ${id},
      ${input.sourceIp},
      ${input.reason},
      ${input.nodeId ?? null},
      ${input.expiresAt?.toISOString() ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    ON CONFLICT DO NOTHING
  `);
  return { id };
}

export async function isDaemonSourceBlocked(sourceIp: string, nodeId?: string | null): Promise<boolean> {
  const result: any = await db.execute(sql`
    SELECT id FROM daemon_blocked_sources
    WHERE source_ip = ${sourceIp}
      AND status = 'active'
      AND (${nodeId ?? null} IS NULL OR node_id = ${nodeId ?? null})
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);
  return !!result.rows?.[0];
}

export async function unblockDaemonSource(sourceIp: string, nodeId?: string | null): Promise<void> {
  await db.execute(sql`
    UPDATE daemon_blocked_sources
    SET status = 'revoked'
    WHERE source_ip = ${sourceIp}
      AND status = 'active'
      AND (${nodeId ?? null} IS NULL OR node_id = ${nodeId ?? null})
  `);
}

export async function listActiveDaemonBlocks(limit = 100): Promise<unknown[]> {
  const result: any = await db.execute(sql`
    SELECT id, source_ip, reason, node_id, expires_at, metadata, created_at
    FROM daemon_blocked_sources
    WHERE status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return result.rows ?? [];
}
