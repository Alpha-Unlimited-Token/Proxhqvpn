import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Check, Shield, Zap, Infinity, Loader2, Star, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    credentials: "include",
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

type Price = { id: string; unitAmount: number; currency: string; recurring: any; nickname: string };
type Product = { id: string; name: string; description: string; metadata: Record<string, string>; prices: Price[] };

type BillingPeriod = "monthly" | "annual" | "lifetime";

const PERIOD_META: Record<BillingPeriod, { label: string; badge?: string; icon: React.ElementType; desc: string }> = {
  monthly: { label: "Monthly", icon: Zap, desc: "Pay month to month. Cancel any time." },
  annual: { label: "Annual", badge: "SAVE 42%", icon: Shield, desc: "Billed once per year. Best value for regular users." },
  lifetime: { label: "Lifetime", badge: "BEST DEAL", icon: Infinity, desc: "One payment. Access forever. No renewals ever." },
};

const FEATURES = [
  "Unlimited devices — use on every screen you own",
  "WireGuard AES-256-GCM encryption",
  "Stealth Protocol — bypass deep packet inspection",
  "Threat Protection — malware & phishing DNS blocking",
  "Kill switch & DNS leak protection",
  "Beacon threat detection & alerts",
  "6,000+ VPN Gate relay servers worldwide",
  "Double-hop anonymity routing",
  "SilkWeb honeypot decoy network",
  "Split tunneling & smart DNS",
  "Alpha Toolkit — scanner, verifier, Tor scraper",
  "No logs. Ever.",
];

function getPriceForPeriod(prices: Price[], period: BillingPeriod): Price | null {
  if (period === "monthly") return prices.find(p => p.recurring?.interval === "month" && p.recurring?.interval_count === 1) ?? null;
  if (period === "annual") return prices.find(p => p.recurring?.interval === "year") ?? null;
  if (period === "lifetime") return prices.find(p => !p.recurring) ?? null;
  return null;
}

function formatAmount(unitAmount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(unitAmount / 100);
}

export default function Pricing() {
  const { user } = useUser();
  const { toast } = useToast();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [checkingOut, setCheckingOut] = useState(false);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["stripe-products"],
    queryFn: () => apiFetch("/api/stripe/products"),
    enabled: !!user,
  });

  const { data: subData } = useQuery<{ subscription: any; hasWireGuard: boolean }>({
    queryKey: ["stripe-subscription"],
    queryFn: () => apiFetch("/api/stripe/subscription"),
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: (priceId: string) =>
      apiFetch("/api/stripe/checkout", { method: "POST", body: JSON.stringify({ priceId }) }),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (e: Error) => {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
      setCheckingOut(false);
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => apiFetch("/api/stripe/portal", { method: "POST" }),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const mainProduct = products.find(p => p.name === "ProxhqVPN") ?? products[0] ?? null;
  const selectedPrice = mainProduct ? getPriceForPeriod(mainProduct.prices, period) : null;
  const meta = PERIOD_META[period];
  const Icon = meta.icon;

  const handleSubscribe = () => {
    if (!selectedPrice) return;
    setCheckingOut(true);
    checkoutMutation.mutate(selectedPrice.id);
  };

  const monthlyEquiv = () => {
    if (!selectedPrice) return null;
    if (period === "monthly") return null;
    if (period === "annual") return formatAmount(Math.round(selectedPrice.unitAmount / 12)) + "/mo";
    if (period === "lifetime") return "one-time";
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-2">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-2">
          <Star className="w-3 h-3 text-primary" />
          <span className="text-xs text-primary font-medium">ProxhqVPN — Full Access</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">One plan. Everything included.</h1>
        <p className="text-white/40 text-sm">No tiers. No hidden features. Every subscriber gets the full ProxhqVPN experience.</p>
      </div>

      {/* Active subscription banner */}
      {subData?.hasWireGuard && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Check className="w-4 h-4" /> You have an active subscription
          </div>
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="text-xs border border-primary/30 text-primary hover:bg-primary/10 rounded-xl px-4 py-2 transition-all"
          >
            {portalMutation.isPending ? "Opening..." : "Manage Billing"}
          </button>
        </div>
      )}

      {/* Billing period selector */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-1.5 flex gap-1">
        {(Object.keys(PERIOD_META) as BillingPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 relative py-3 px-4 rounded-xl text-sm font-medium transition-all ${
              period === p
                ? "bg-primary text-black shadow-[0_0_20px_rgba(0,255,136,0.2)]"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {PERIOD_META[p].label}
            {PERIOD_META[p].badge && period !== p && (
              <span className="absolute -top-2 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {PERIOD_META[p].badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main plan card */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-white/30 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading plans...
        </div>
      ) : !mainProduct ? (
        <div className="flex items-start gap-3 bg-yellow-900/10 border border-yellow-500/20 rounded-2xl p-5">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-yellow-400">Plans are being set up</div>
            <div className="text-sm text-yellow-400/60 mt-1">Check back in a moment — your subscription plans are being created.</div>
          </div>
        </div>
      ) : (
        <div className={`bg-[#0d1610] border rounded-2xl overflow-hidden transition-all ${
          period === "annual" ? "border-primary/40 shadow-[0_0_40px_rgba(0,255,136,0.08)]" : "border-white/[0.07]"
        }`}>
          {period === "annual" && (
            <div className="bg-primary text-black text-center text-xs font-bold tracking-widest py-2">
              MOST POPULAR — SAVE 42%
            </div>
          )}
          {period === "lifetime" && (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-center text-xs font-bold tracking-widest py-2">
              BEST DEAL — PAY ONCE, KEEP FOREVER
            </div>
          )}

          <div className="p-8">
            {/* Price display */}
            <div className="flex items-end gap-3 mb-2">
              <div className="flex items-start">
                <span className="text-white/40 text-lg mt-2 mr-1">$</span>
                <span className="text-6xl font-bold text-white leading-none">
                  {selectedPrice ? Math.floor(selectedPrice.unitAmount / 100) : "—"}
                </span>
                {selectedPrice && selectedPrice.unitAmount % 100 !== 0 && (
                  <span className="text-white/60 text-2xl mt-3">.{String(selectedPrice.unitAmount % 100).padStart(2, "0")}</span>
                )}
              </div>
              <div className="pb-2 text-white/40 text-sm">
                {period === "monthly" && "/month"}
                {period === "annual" && "/year"}
                {period === "lifetime" && "one-time"}
              </div>
            </div>

            {monthlyEquiv() && (
              <div className="text-primary text-sm font-medium mb-1">
                {period === "annual" && `That's just ${monthlyEquiv()} — 42% less than monthly`}
                {period === "lifetime" && "Pay once, protected forever"}
              </div>
            )}

            <p className="text-white/40 text-sm mb-8">{meta.desc}</p>

            {/* Feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-sm text-white/70">{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            {subData?.hasWireGuard ? (
              <div className="flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 rounded-2xl py-4 text-primary font-medium">
                <Check className="w-4 h-4" /> Already subscribed
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={checkingOut || !selectedPrice}
                className={`w-full py-4 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 ${
                  period === "lifetime"
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:brightness-110 shadow-[0_0_30px_rgba(255,200,0,0.2)]"
                    : "bg-primary text-black hover:brightness-110 shadow-[0_0_30px_rgba(0,255,136,0.2)]"
                }`}
              >
                {checkingOut ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout...</>
                ) : period === "lifetime" ? (
                  <><Infinity className="w-4 h-4" /> Get Lifetime Access</>
                ) : (
                  <><Shield className="w-4 h-4" /> Get Protected — {period === "monthly" ? "$9.99/mo" : "$69.99/yr"}</>
                )}
              </button>
            )}

            <p className="text-center text-white/25 text-xs mt-4">
              30-day money-back guarantee · No logs · Cancel any time
            </p>
          </div>
        </div>
      )}

      {/* Bottom reassurance */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { title: "No Logs", body: "We never record your IP, browsing history, or traffic data." },
          { title: "30-Day Guarantee", body: "Not satisfied? Get a full refund within 30 days, no questions asked." },
          { title: "Instant Access", body: "Your VPN tunnel is registered automatically within 30 seconds of subscribing." },
        ].map((item) => (
          <div key={item.title} className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4 text-center">
            <div className="text-xs font-semibold text-white/70 mb-1">{item.title}</div>
            <div className="text-xs text-white/30 leading-relaxed">{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
