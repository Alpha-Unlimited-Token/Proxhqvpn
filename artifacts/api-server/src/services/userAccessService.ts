// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAuthzProfile } from "./authzService";
import { getBillingAccessState, type BillingTier } from "../repositories/billingRepository";

export type UserRole =
  | "owner"
  | "employee_admin"
  | "employee"
  | "subscriber"
  | null;

export type UserTier = BillingTier;

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
  billingStatus: string | null;
};

function resolveDevTier(user: any): 1 | 2 | 3 | null {
  const raw = Number(user?.devTier ?? user?.developerTier ?? 0);
  return raw === 1 || raw === 2 || raw === 3 ? raw : null;
}

export async function getUserAccessProfile(
  userId: string,
): Promise<UserAccessProfile> {
  const profile = await getAuthzProfile(userId);
  const user: any = profile.user;

  const billing = await getBillingAccessState(userId);

  const isAdmin = profile.isOwner;
  const isEmployee = profile.isEmployee;
  const isAdminEmployee = profile.isAdminEmployee;

  const hasCommandCenter =
    isAdmin ||
    isAdminEmployee ||
    billing.hasCommandCenter ||
    user?.hasCommandCenter === true ||
    user?.commandCenterEnabled === true;

  const hasSubscription =
    isAdmin ||
    isEmployee ||
    billing.hasSubscription ||
    user?.hasSubscription === true ||
    user?.subscriptionActive === true;

  const hasAccess =
    isAdmin ||
    isEmployee ||
    hasSubscription ||
    hasCommandCenter;

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
    tier: hasCommandCenter
      ? "command_center"
      : billing.tier,
    billingStatus: billing.status,
  };
}
