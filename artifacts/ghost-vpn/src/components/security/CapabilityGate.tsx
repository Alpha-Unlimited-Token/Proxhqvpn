// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { ReactNode } from "react";
import { useAccess } from "@/hooks/useAccess";

interface CapabilityGateProps {
  /** Capability key the user must hold. Pass "*" to require admin only. */
  capability?: string;
  /** Require admin role regardless of capability. */
  requireAdmin?: boolean;
  children: ReactNode;
  /** Rendered in place of children when access is denied. Default: nothing. */
  fallback?: ReactNode;
}

/**
 * Hides children unless the current user holds the specified capability (or is admin).
 * Used to suppress security/deception/lab tool UI from consumer navigation.
 */
export function CapabilityGate({
  capability,
  requireAdmin = false,
  children,
  fallback = null,
}: CapabilityGateProps) {
  const { isAdmin, hasCommandCenter } = useAccess();

  if (isAdmin) return <>{children}</>;
  if (requireAdmin) return <>{fallback}</>;

  if (capability === "command_center.read" && hasCommandCenter) return <>{children}</>;
  if (capability === "security.deception.read" && (hasCommandCenter || isAdmin)) return <>{children}</>;
  if (!capability && hasCommandCenter) return <>{children}</>;

  return <>{fallback}</>;
}

/** Full-page restricted access banner for direct route access without authorization. */
export function RestrictedAccessBanner({ message = "This area is restricted to authorized security administrators." }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-950/20 p-6 text-red-200">
      <p className="font-semibold">Access Restricted</p>
      <p className="mt-1 text-sm text-red-100/70">{message}</p>
    </div>
  );
}
