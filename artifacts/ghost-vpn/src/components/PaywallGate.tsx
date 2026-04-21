import { Link } from "wouter";
import { Lock, CreditCard, Zap } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";

interface PaywallGateProps {
  children: React.ReactNode;
}

/**
 * PaywallGate wraps any page that requires an active subscription.
 * - Admins and employees pass through with no check.
 * - Active subscribers pass through.
 * - Everyone else sees the paywall screen.
 * - While the access check is loading, a spinner is shown.
 */
export function PaywallGate({ children }: PaywallGateProps) {
  const { hasAccess, isLoading } = useAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <PaywallScreen />;
  }

  return <>{children}</>;
}

function PaywallScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
        <Lock className="w-7 h-7 text-primary/60" />
      </div>

      <h1 className="text-xl font-bold text-white mb-2">Subscription Required</h1>
      <p className="text-sm text-white/40 max-w-sm leading-relaxed mb-8">
        This feature is available to ProxhqVPN subscribers only.
        Choose a plan to unlock full access to all tools, servers, and privacy features.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/pricing"
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-black font-semibold text-[13px] py-2.5 px-5 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          View Plans
        </Link>
        <Link
          href="/account"
          className="flex-1 flex items-center justify-center gap-2 border border-white/10 text-white/50 font-medium text-[13px] py-2.5 px-5 rounded-xl hover:border-white/20 hover:text-white/80 transition-colors"
        >
          My Account
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4 max-w-sm w-full text-left">
        {[
          { label: "WireGuard VPN", detail: "Military-grade encryption" },
          { label: "All Tools", detail: "Scanner, Tor, Proxy & more" },
          { label: "All Platforms", detail: "Desktop, mobile, router" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary/50" />
            </div>
            <div className="text-[11px] font-semibold text-white/60">{f.label}</div>
            <div className="text-[10px] text-white/25 leading-snug">{f.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
