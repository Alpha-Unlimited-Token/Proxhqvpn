import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useWireGuardSubscription } from "@/hooks/useWireGuardSubscription";

export default function CheckoutSuccess() {
  const { hasWireGuard, loading, refetch } = useWireGuardSubscription();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setWaited(true); refetch(); }, 2000);
    return () => clearTimeout(t);
  }, [refetch]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center font-mono">
      <div className="text-center space-y-5 max-w-sm px-4">
        <div className="w-14 h-14 border border-primary/30 flex items-center justify-center mx-auto bg-primary/5">
          <CheckCircle className="w-7 h-7 text-primary" />
        </div>

        <div>
          <h1 className="text-base font-bold tracking-widest uppercase text-primary">WireGuard Activated</h1>
          <p className="text-[10px] text-primary/40 mt-1">Your ProxhqVPN WireGuard Add-on is now active.</p>
        </div>

        {(!waited || loading) ? (
          <div className="flex items-center justify-center gap-2 text-[9px] text-primary/30 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Verifying activation...
          </div>
        ) : hasWireGuard ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-[9px] text-green-400">
              <Zap className="w-3.5 h-3.5" /> WIREGUARD READY
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-left">
              {[
                { href: "/devices", label: "Set up your devices →" },
                { href: "/router-config", label: "Configure your router →" },
                { href: "/account", label: "View your account →" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="flex items-center justify-between border border-primary/20 hover:border-primary/50 px-3 py-2 text-[9px] text-primary/60 hover:text-primary transition-colors">
                  {label} <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[9px] text-primary/30">Activation in progress — check your account in a moment.</p>
        )}

        <Link href="/account"
          className="inline-flex items-center gap-2 text-[9px] uppercase tracking-widest text-primary/50 hover:text-primary border border-primary/20 hover:border-primary/40 px-4 py-2 transition-colors">
          GO TO ACCOUNT <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
