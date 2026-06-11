// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Target scope allowlist — enforces that scanned targets are within the user's
// declared authorized scope. Fail-closed: no scopes = deny.
import { db } from "@workspace/db";
import { toolTargetScopesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export function targetMatchesScope(
  target: string,
  scopeType: string,
  scopeValue: string,
): boolean {
  const t = target.trim().toLowerCase();
  const v = scopeValue.trim().toLowerCase();
  if (scopeType === "ip")     return t === v || t.startsWith(`${v}/`);
  if (scopeType === "url")    return t.startsWith(v);
  if (scopeType === "domain") {
    const tClean = t.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    return tClean === v || tClean.endsWith(`.${v}`);
  }
  if (scopeType === "cidr") {
    // Simple CIDR prefix check: extract network prefix
    const [net] = v.split("/");
    const parts  = net.split(".");
    const prefix = v.includes("/") ? parseInt(v.split("/")[1] ?? "32", 10) : 32;
    const octets = Math.ceil(prefix / 8);
    const targetClean = t.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    const tParts = targetClean.split(".");
    if (tParts.length < octets) return false;
    for (let i = 0; i < octets; i++) {
      if ((tParts[i] ?? "") !== (parts[i] ?? "")) return false;
    }
    return true;
  }
  return false;
}

// Fail-closed: throws on DB error, denies when no scopes are defined.
// DB errors propagate to the caller → HTTP 500 (no silent swallow).
export async function checkTargetAllowlist(
  target: string,
  userId: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  if (!target) return { allowed: true, reason: null };
  const scopes = await db
    .select()
    .from(toolTargetScopesTable)
    .where(eq(toolTargetScopesTable.userId, userId));
  if (scopes.length === 0) {
    return {
      allowed: false,
      reason: "No authorized scope entries found. Add your target to your scope list at /tool-scope before running any scan.",
    };
  }
  const inScope = scopes.some(s => targetMatchesScope(target, s.scopeType, s.scopeValue));
  if (!inScope) {
    return {
      allowed: false,
      reason: `Target '${target}' is not in your authorized scope list. Add it at /tool-scope first.`,
    };
  }
  return { allowed: true, reason: null };
}
