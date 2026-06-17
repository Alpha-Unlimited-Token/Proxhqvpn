// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Referral link handler — stores promo code in sessionStorage and redirects to /pricing.
// Route: /ref/:code
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function RefRedirect() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    const code = (params.code ?? "").toUpperCase().trim();
    if (code) {
      sessionStorage.setItem("proxhq_promo_code", code);
    }
    navigate("/pricing", { replace: true });
  }, [params.code, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-green-400 font-mono text-sm animate-pulse">Redirecting to pricing...</div>
    </div>
  );
}
