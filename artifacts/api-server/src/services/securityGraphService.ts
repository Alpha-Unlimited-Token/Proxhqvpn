// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function upsertSecurityGraphNode(input: {
  entityType: string;
  entityId: string;
  label?: string | null;
  properties?: Record<string, unknown>;
}) {
  const id = randomUUID();

  const result: any = await db.execute(sql`
    INSERT INTO security_graph_nodes
      (id, entity_type, entity_id, label, properties)
    VALUES
      (${id}, ${input.entityType}, ${input.entityId}, ${input.label ?? null}, ${JSON.stringify(input.properties ?? {})}::jsonb)
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
      label = COALESCE(EXCLUDED.label, security_graph_nodes.label),
      properties = security_graph_nodes.properties || EXCLUDED.properties,
      updated_at = NOW()
    RETURNING *
  `);

  return result.rows?.[0];
}

export async function linkSecurityGraphNodes(input: {
  sourceNodeId: string;
  targetNodeId: string;
  relationship: string;
  weight?: number;
  properties?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO security_graph_edges
      (id, source_node_id, target_node_id, relationship, weight, properties)
    VALUES
      (${id}, ${input.sourceNodeId}, ${input.targetNodeId}, ${input.relationship}, ${input.weight ?? 1}, ${JSON.stringify(input.properties ?? {})}::jsonb)
  `);

  return { id };
}

export async function getSecurityGraphForEntity(entityType: string, entityId: string) {
  const nodeResult: any = await db.execute(sql`
    SELECT * FROM security_graph_nodes
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
    LIMIT 1
  `);

  const node = nodeResult.rows?.[0];
  if (!node) return { node: null, edges: [] };

  const edges: any = await db.execute(sql`
    SELECT e.*, s.entity_type AS source_type, s.entity_id AS source_entity_id,
           t.entity_type AS target_type, t.entity_id AS target_entity_id
    FROM security_graph_edges e
    JOIN security_graph_nodes s ON s.id = e.source_node_id
    JOIN security_graph_nodes t ON t.id = e.target_node_id
    WHERE e.source_node_id = ${node.id}
       OR e.target_node_id = ${node.id}
    ORDER BY e.created_at DESC
    LIMIT 500
  `);

  return { node, edges: edges.rows ?? [] };
}
