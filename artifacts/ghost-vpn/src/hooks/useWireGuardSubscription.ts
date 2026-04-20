import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface StripePrice {
  id: string;
  unitAmount: number;
  currency: string;
  recurring: { interval: string; interval_count?: number } | null;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: StripePrice[];
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

interface WGSubscriptionState {
  hasWireGuard: boolean;
  subscription: Subscription | null;
  products: StripeProduct[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  openCheckout: (priceId: string) => Promise<void>;
  openPortal: () => Promise<void>;
  checkingOut: boolean;
}

export function useWireGuardSubscription(): WGSubscriptionState {
  const [hasWireGuard, setHasWireGuard] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, prodRes] = await Promise.all([
        fetch(`${BASE}/api/stripe/subscription`),
        fetch(`${BASE}/api/stripe/products`),
      ]);
      const subData = await subRes.json();
      const prodData = await prodRes.json();
      setHasWireGuard(!!subData.hasWireGuard);
      setSubscription(subData.subscription ?? null);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load subscription status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const openCheckout = useCallback(async (priceId: string) => {
    setCheckingOut(true);
    try {
      const r = await fetch(`${BASE}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await r.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error ?? "Checkout failed");
      }
    } catch (err: any) {
      setError(err.message);
      setCheckingOut(false);
    }
  }, []);

  const openPortal = useCallback(async () => {
    const r = await fetch(`${BASE}/api/stripe/portal`, { method: "POST" });
    const data = await r.json();
    if (data.url) window.location.href = data.url;
  }, []);

  return { hasWireGuard, subscription, products, loading, error, refetch: fetchStatus, openCheckout, openPortal, checkingOut };
}
