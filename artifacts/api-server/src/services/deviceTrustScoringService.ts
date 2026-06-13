// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getBehaviorProfile } from "./behaviorAnalyticsService";

export type DeviceTrustScore = {
  deviceId: string;
  score: number;
  level: "trusted" | "normal" | "risky" | "blocked";
  reasons: string[];
};

export async function scoreDeviceTrust(input: {
  deviceId: string;
  isManaged?: boolean;
  hasRecentAttestation?: boolean;
  failedChecks?: number;
}): Promise<DeviceTrustScore> {
  const reasons: string[] = [];
  let score = 100;

  if (!input.isManaged) {
    score -= 20;
    reasons.push("unmanaged_device");
  }

  if (!input.hasRecentAttestation) {
    score -= 25;
    reasons.push("missing_recent_attestation");
  }

  const failedChecks = input.failedChecks ?? 0;
  if (failedChecks > 0) {
    score -= Math.min(50, failedChecks * 10);
    reasons.push("failed_device_checks");
  }

  const behavior = await getBehaviorProfile(input.deviceId, "device");
  if (behavior?.risk_score) {
    score -= Math.min(40, Number(behavior.risk_score));
    reasons.push("behavior_risk");
  }

  score = Math.max(0, Math.min(100, score));

  const level =
    score >= 85 ? "trusted" :
    score >= 60 ? "normal" :
    score >= 30 ? "risky" :
    "blocked";

  return { deviceId: input.deviceId, score, level, reasons };
}
