// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import * as schema from "@workspace/db/schema";

export const nodesTable =
  (schema as any).nodesTable ??
  (schema as any).vpnNodesTable ??
  (schema as any).nodeRegistryTable ??
  null;

export function assertNodesSchemaConfigured() {
  if (!nodesTable) {
    throw new Error(
      "Nodes table is not configured. Export nodesTable, vpnNodesTable, or nodeRegistryTable from @workspace/db/schema, or update nodesSchemaAdapter.ts.",
    );
  }
}

export function getNodeColumns(table: any) {
  return {
    id: table.id ?? table.nodeId ?? table.node_id,
    nodeId: table.nodeId ?? table.node_id ?? table.id,
    publicKey: table.publicKey ?? table.public_key ?? table.wireguardPublicKey,
    publicIp: table.publicIp ?? table.public_ip ?? table.ipAddress,
    port: table.port ?? table.listenPort ?? table.wireguardPort,
    status: table.status ?? table.state,
    region: table.region ?? table.location,
    lastSeenAt: table.lastSeenAt ?? table.last_seen_at ?? table.lastSeen,
    errorMessage: table.errorMessage ?? table.error_message,
    metadata: table.metadata,
    createdAt: table.createdAt ?? table.created_at,
    updatedAt: table.updatedAt ?? table.updated_at,
  };
}
