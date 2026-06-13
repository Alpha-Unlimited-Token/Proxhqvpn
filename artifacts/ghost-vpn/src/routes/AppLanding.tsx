// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Redirect } from "wouter";
import { useAccess } from "@/hooks/useAccess";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AppLanding() {
  const { hasCommandCenter, hasAccess, isLoading } = useAccess();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080d09] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
          <img
            src={`${basePath}/icon-final2.png`}
            alt="ProxhqVPN"
            className="w-8 h-8"
          />
        </div>
        <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest">
          Verifying access…
        </p>
      </div>
    );
  }

  if (hasCommandCenter) return <Redirect to="/dashboard" />;
  if (hasAccess) return <Redirect to="/my-vpn" />;

  return <Redirect to="/pricing" />;
}
