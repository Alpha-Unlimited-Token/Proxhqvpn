// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  linkSecurityGraphNodes,
  upsertSecurityGraphNode,
} from "./securityGraphService";
import { publishPlatformEvent } from "../lib/event-bus";

export async function correlateSecurityEntity(input: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}) {
  const source = await upsertSecurityGraphNode({
    entityType: input.sourceType,
    entityId: input.sourceId,
    label: `${input.sourceType}:${input.sourceId}`,
  });

  const target = await upsertSecurityGraphNode({
    entityType: input.targetType,
    entityId: input.targetId,
    label: `${input.targetType}:${input.targetId}`,
  });

  const edge = await linkSecurityGraphNodes({
    sourceNodeId: source.id,
    targetNodeId: target.id,
    relationship: input.relationship,
    weight: input.confidence ?? 1,
    properties: input.metadata,
  });

  await publishPlatformEvent({
    type: "security.entity.correlated",
    subject: input.sourceId,
    severity: "info",
    payload: {
      edgeId: edge.id,
      sourceType: input.sourceType,
      targetType: input.targetType,
      relationship: input.relationship,
      confidence: input.confidence ?? 1,
    },
  });

  return { source, target, edge };
}
