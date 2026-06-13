// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";

export type NodeBootstrapManifest = {
  nodeId: string;
  apiBase: string;
  region: string | null;
  requiredPackages: string[];
  serviceName: string;
  generatedAt: string;
  expiresAt: string;
  fingerprint: string;
};

export function createNodeBootstrapManifest(input: {
  nodeId: string;
  apiBase: string;
  region?: string | null;
  ttlMinutes?: number;
}): NodeBootstrapManifest {
  const generatedAt = new Date();
  const expiresAt = new Date(
    generatedAt.getTime() + (input.ttlMinutes ?? 15) * 60_000,
  );

  const unsigned = {
    nodeId: input.nodeId,
    apiBase: input.apiBase,
    region: input.region ?? null,
    requiredPackages: ["wireguard", "wireguard-tools", "curl", "python3"],
    serviceName: "proxhqd",
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(unsigned))
    .digest("hex");

  return {
    ...unsigned,
    fingerprint,
  };
}
