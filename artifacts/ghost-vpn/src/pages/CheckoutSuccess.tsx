// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Loader2, ArrowRight, Shield } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CheckoutSuccess() {
  const search     = useSearch();
  const [, setLocation] = useLocation();
  const sessionId  = new URLSearchParams(search).get("session_id");
  const [recording, setRecording] = useState(false);
  const [done, setDone]           = useState(false);

  useEffect(() => {
    const promoCode = sessionStorage.getItem("proxhq_promo_code");
    sessionStorage.removeItem("proxhq_promo_code");

    if (promoCode && sessionId) {
      setRecording(true);
      fetch(`${BASE}/api/ambassadors/record-referral`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, promoCode }),
      })
        .catch(() => {})
        .finally(() => { setRecording(false); setDone(true); });
    } else {
      setDone(true);
    }

    // Auto-redirect after 4 seconds
    const t = setTimeout(() => setLocation("/my-vpn"), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-5 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-500/30 flex items-center justify-center mx-auto">
          {recording
            ? <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
            : <CheckCircle className="w-8 h-8 text-green-400" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Subscription Activated!</h1>
          <p className="text-sm text-primary/50 mt-2 leading-relaxed">
            Your ProxhqVPN subscription is now active. You're fully protected.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-primary/30 animate-pulse">
          <Shield className="w-3 h-3" /> Redirecting to your VPN dashboard...
        </div>
        <button onClick={() => setLocation("/my-vpn")}
          className="flex items-center gap-2 mx-auto px-5 py-2 bg-primary text-black text-xs font-mono font-bold uppercase rounded hover:bg-primary/80 transition-colors">
          Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
