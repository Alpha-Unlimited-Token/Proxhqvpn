export interface EntitlementInput {
  userId: string;
  action: "issue_vpn_config" | "rotate_vpn_key" | "download_config" | "create_device";
  subscriptionActive: boolean;
  deviceCount: number;
  deviceLimit: number;
  trustScore: number;
  abuseBlocked?: boolean;
}

export interface EntitlementDecision {
  allowed: boolean;
  reason: string;
}

export function decideEntitlement(input: EntitlementInput): EntitlementDecision {
  if (!input.subscriptionActive) return { allowed: false, reason: "Subscription inactive." };
  if (input.abuseBlocked)        return { allowed: false, reason: "Account blocked by abuse policy." };
  if (input.trustScore < 50)     return { allowed: false, reason: "Device/account trust score too low." };
  if (input.action === "create_device" || input.action === "issue_vpn_config") {
    if (input.deviceCount >= input.deviceLimit) {
      return { allowed: false, reason: "Device limit reached." };
    }
  }
  return { allowed: true, reason: "Entitlement approved." };
}
