// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getUserRoleProfile, isOwnerAdmin } from "../repositories/usersRepository";

export async function canAccessOwnerAdmin(userId: string): Promise<boolean> {
  return isOwnerAdmin(userId);
}

export async function canAccessAdminOrEmployeeAdmin(userId: string): Promise<boolean> {
  const profile = await getUserRoleProfile(userId);
  return profile.isOwner || profile.isAdminEmployee;
}

export async function getAuthzProfile(userId: string) {
  return getUserRoleProfile(userId);
}
