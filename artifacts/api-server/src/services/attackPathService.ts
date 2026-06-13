// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function buildAttackPath(input: {
  entityType: string;
  entityId: string;
  maxDepth?: number;
}) {
  const maxDepth = input.maxDepth ?? 3;

  const result: any = await db.execute(sql`
    WITH RECURSIVE graph_walk AS (
      SELECT
        n.id,
        n.entity_type,
        n.entity_id,
        n.label,
        0 AS depth,
        ARRAY[n.id] AS path
      FROM security_graph_nodes n
      WHERE n.entity_type = ${input.entityType}
        AND n.entity_id = ${input.entityId}

      UNION ALL

      SELECT
        next_node.id,
        next_node.entity_type,
        next_node.entity_id,
        next_node.label,
        graph_walk.depth + 1 AS depth,
        graph_walk.path || next_node.id
      FROM graph_walk
      JOIN security_graph_edges e
        ON e.source_node_id = graph_walk.id OR e.target_node_id = graph_walk.id
      JOIN security_graph_nodes next_node
        ON next_node.id = CASE
          WHEN e.source_node_id = graph_walk.id THEN e.target_node_id
          ELSE e.source_node_id
        END
      WHERE graph_walk.depth < ${maxDepth}
        AND NOT next_node.id = ANY(graph_walk.path)
    )
    SELECT DISTINCT *
    FROM graph_walk
    ORDER BY depth ASC
    LIMIT 1000
  `);

  return {
    root: { entityType: input.entityType, entityId: input.entityId },
    maxDepth,
    nodes: result.rows ?? [],
  };
}
