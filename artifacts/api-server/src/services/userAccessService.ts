// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAuthzProfile } from "./authzService";

export type UserRole =
  | "owner"
  | "employee_admin"
  | "employee"
  | "subscriber"
  | null;

export type UserTier = "vpn" | "command_center" | null;

export type UserAccessProfile = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isAdminEmployee: boolean;
  role: UserRole;
  hasAccess: boolean;
  hasSubscription: boolean;
  hasCommandCenter: boolean;
  devTier: 1 | 2 | 3 | null;
  hasArsenal: boolean;
  tier: UserTier;
};

/**
 * Conservative tier resolver.
 *
 * This intentionally supports multiple possible user table shapes because the
 * project has evolved over time. It reads common fields if present and falls
 * back safely when fields are absent.
 */
function resolveTier(user: any): UserTier {
  const rawTier =
    user?.tier ??
    user?.subscriptionTier ??
    user?.plan ??
    user?.planTier ??
    null;

  if (rawTier === "command_center" || rawTier === "pro" || rawTier === "command-center") {
    return "command_center";
  }

  if (rawTier === "vpn" || rawTier === "basic" || rawTier === "vpn_basic") {
    return "vpn";
  }

  if (user?.hasCommandCenter || user?.commandCenterEnabled) {
    return "command_center";
  }

  if (user?.hasSubscription || user?.subscriptionActive || user?.stripeSubscriptionId) {
    return "vpn";
  }

  return null;
}

function resolveDevTier(user: any): 1 | 2 | 3 | null {
  const raw = Number(user?.devTier ?? user?.developerTier ?? 0);

  if (raw === 1 || raw === 2 || raw === 3) return raw;

  return null;
}

function hasActiveSubscription(user: any): boolean {
  if (!user) return false;

  if (user.isAdmin) return true;

  if (
    user.hasSubscription === true ||
    user.subscriptionActive === true ||
    user.activeSubscription === true
  ) {
    return true;
  }

  const status =
    user.subscriptionStatus ??
    user.stripeSubscriptionStatus ??
    user.billingStatus ??
    null;

  if (typeof status === "string") {
    return ["active", "trialing", "paid"].includes(status.toLowerCase());
  }

  return !!user.stripeSubscriptionId;
}

export async function getUserAccessProfile(
  userId: string,
): Promise<UserAccessProfile> {
  const profile = await getAuthzProfile(userId);
  const user: any = profile.user;

  const tier = resolveTier(user);
  const hasSubscription = hasActiveSubscription(user);
  const isAdmin = profile.isOwner;
  const isEmployee = profile.isEmployee;
  const isAdminEmployee = profile.isAdminEmployee;
  const hasCommandCenter =
    isAdmin ||
    isAdminEmployee ||
    tier === "command_center" ||
    user?.hasCommandCenter === true ||
    user?.commandCenterEnabled === true;

  const hasAccess =
    isAdmin ||
    isEmployee ||
    hasSubscription ||
    hasCommandCenter ||
    tier === "vpn" ||
    tier === "command_center";

  const role: UserRole = isAdmin
    ? "owner"
    : isAdminEmployee
      ? "employee_admin"
      : isEmployee
        ? "employee"
        : hasAccess
          ? "subscriber"
          : null;

  return {
    userId,
    email: user?.email ?? null,
    isAdmin,
    isEmployee,
    isAdminEmployee,
    role,
    hasAccess,
    hasSubscription,
    hasCommandCenter,
    devTier: resolveDevTier(user),
    hasArsenal:
      isAdmin ||
      isAdminEmployee ||
      user?.hasArsenal === true ||
      user?.arsenalEnabled === true,
    tier,
  };
}
