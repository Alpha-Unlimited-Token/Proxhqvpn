// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { ShieldAlert } from "lucide-react";

interface AuthorizedTargetBannerProps {
  className?: string;
}

/**
 * Displayed on all security/lab tool pages to make scope explicit.
 * Tools may only target ProxhqVPN-owned internal lab assets.
 */
export function AuthorizedTargetBanner({ className = "" }: AuthorizedTargetBannerProps) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-950/20 p-4 text-sm text-yellow-100 ${className}`}>
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400/70" />
      <div>
        <span className="font-semibold">Authorized testing only.</span>{" "}
        These tools may only be used against ProxhqVPN-owned internal lab targets explicitly
        approved in the Security Lab. Public IPs, customer systems, third-party systems,
        and attacker infrastructure are strictly prohibited.
      </div>
    </div>
  );
}
