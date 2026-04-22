import { Link } from "wouter";
import { Lock, CreditCard, Zap, ArrowUpCircle } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";

interface PaywallGateProps {
  children: React.ReactNode;
  /** "any" = any active subscription grants access (VPN Basic or Pro)
   *  "command_center" = only Command Center Pro (or admin/employee) */
  requireTier?: "any" | "command_center";
}

export function PaywallGate({ children, requireTier = "any" }: PaywallGateProps) {
  const { hasAccess, hasCommandCenter, isLoading } = useAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!hasAccess) return <NoSubscriptionScreen />;
  if (requireTier === "command_center" && !hasCommandCenter) return <UpgradeScreen />;

  return <>{children}</>;
}

function NoSubscriptionScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
        <Lock className="w-7 h-7 text-primary/60" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Subscription Required</h1>
      <p className="text-sm text-white/78 max-w-sm leading-relaxed mb-8">
        Choose a plan to unlock access. VPN Basic gives you the core privacy suite.
        Command Center Pro unlocks the full developer toolkit.
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
          className="flex-1 flex items-center justify-center gap-2 border border-white/10 text-white/83 font-medium text-[13px] py-2.5 px-5 rounded-xl hover:border-white/20 hover:text-white/80 transition-colors"
        >
          My Account
        </Link>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 max-w-sm w-full text-left">
        {[
          { label: "VPN Basic", detail: "WireGuard, kill switch, DNS, devices", tag: "$6.99/mo" },
          { label: "Command Center Pro", detail: "VPN + full developer toolkit", tag: "$39.99/mo" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">{f.tag}</div>
            <div className="text-[11px] font-semibold text-white/88">{f.label}</div>
            <div className="text-[10px] text-white/70 leading-snug">{f.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpgradeScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-6">
        <ArrowUpCircle className="w-7 h-7 text-yellow-400/70" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Command Center Pro Required</h1>
      <p className="text-sm text-white/78 max-w-sm leading-relaxed mb-8">
        This feature is part of the developer toolkit and requires a Command Center Pro subscription.
        Upgrade from VPN Basic at any time — your billing is prorated automatically.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/pricing"
          className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 text-black font-semibold text-[13px] py-2.5 px-5 rounded-xl hover:bg-yellow-400 transition-colors"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Pro
        </Link>
        <Link
          href="/account"
          className="flex-1 flex items-center justify-center gap-2 border border-white/10 text-white/83 font-medium text-[13px] py-2.5 px-5 rounded-xl hover:border-white/20 hover:text-white/80 transition-colors"
        >
          My Account
        </Link>
      </div>
      <div className="mt-8 bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-5 py-4 max-w-sm w-full text-left">
        <div className="text-[11px] font-semibold text-yellow-400/80 mb-2">Included in Command Center Pro</div>
        {[
          "Vulnerability Scanner (SQLMap + nmap)",
          "Ghost Chain — Tor-veiled proxy routing",
          "Alpha Toolkit — scraper, verifier, tools",
          "Threat Intelligence dashboard",
          "Security Audit suite",
          "SilkWeb honeypot & Beacon threat monitor",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2 py-1">
            <div className="w-1 h-1 rounded-full bg-yellow-400/50 shrink-0" />
            <span className="text-[11px] text-white/78">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
