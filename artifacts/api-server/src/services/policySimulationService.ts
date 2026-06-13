// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { evaluateZeroTrustPolicy } from "./zeroTrustPolicyService";

export async function simulateZeroTrustDecision(input: {
  userId: string;
  deviceTrustLevel?: string;
  identityRiskLevel?: string;
  requestedCapability?: string;
  region?: string | null;
}) {
  const decision = await evaluateZeroTrustPolicy(input);

  return {
    simulatedAt: new Date().toISOString(),
    input,
    decision,
  };
}
