// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getBehaviorProfile } from "./behaviorAnalyticsService";

export async function scoreIdentityRisk(input: {
  userId: string;
  isAdmin?: boolean;
  impossibleTravel?: boolean;
  failedLoginCount?: number;
  newCountry?: boolean;
}) {
  const reasons: string[] = [];
  let risk = 0;

  if (input.isAdmin) risk += 10;

  if (input.impossibleTravel) {
    risk += 50;
    reasons.push("impossible_travel");
  }

  if (input.newCountry) {
    risk += 20;
    reasons.push("new_country");
  }

  const failed = input.failedLoginCount ?? 0;
  if (failed >= 5) {
    risk += 30;
    reasons.push("failed_login_spike");
  }

  const behavior = await getBehaviorProfile(input.userId, "user");
  if (behavior?.risk_score) {
    risk += Math.min(40, Number(behavior.risk_score));
    reasons.push("behavior_profile_risk");
  }

  risk = Math.max(0, Math.min(100, risk));

  return {
    userId: input.userId,
    risk,
    level:
      risk >= 80 ? "critical" :
      risk >= 60 ? "high" :
      risk >= 30 ? "medium" :
      "low",
    reasons,
  };
}
