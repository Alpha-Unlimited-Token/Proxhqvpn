import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Check, Zap, Shield, Star, AlertCircle, Loader2 } from "lucide-react";
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

type Price = { id: string; unitAmount: number; currency: string; recurring: any };
type Product = { id: string; name: string; description: string; metadata: Record<string, string>; prices: Price[] };

const PLAN_ICONS: Record<string, React.ElementType> = {
  basic: Zap,
  pro: Shield,
  ultimate: Star,
};

const PLAN_FEATURES: Record<string, string[]> = {
  "ProxhqVPN Basic": [
    "1 simultaneous device",
    "Chicago VPN server",
    "WireGuard protocol",
    "Kill switch",
    "DNS leak protection",
    "No logs policy",
  ],
  "ProxhqVPN Pro": [
    "5 simultaneous devices",
    "All VPN servers",
    "WireGuard + Double-hop",
    "Kill switch",
    "DNS leak protection",
    "Beacon threat detection",
    "Priority support",
    "No logs policy",
  ],
  "ProxhqVPN Ultimate": [
    "Unlimited devices",
    "All VPN servers",
    "Triple-hop masking",
    "WireGuard + VPN Gate overlay",
    "SilkWeb decoy routing",
    "Obfuscation & traffic shaping",
    "Advanced threat intel",
    "Dedicated support",
    "No logs policy",
  ],
};

function formatPrice(unitAmount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(unitAmount / 100);
}

function PlanCard({
  product,
  isCurrentPlan,
  onSubscribe,
  loading,
}: {
  product: Product;
  isCurrentPlan: boolean;
  onSubscribe: (priceId: string) => void;
  loading: boolean;
}) {
  const monthlyPrice = product.prices.find((p) => p.recurring?.interval === "month");
  const planKey = product.name.toLowerCase().includes("ultimate")
    ? "ultimate"
    : product.name.toLowerCase().includes("pro")
    ? "pro"
    : "basic";
  const Icon = PLAN_ICONS[planKey] ?? Shield;
  const features = PLAN_FEATURES[product.name] ?? [];
  const isHighlighted = planKey === "pro";

  return (
    <div
      className={`flex flex-col border ${
        isHighlighted ? "border-primary" : "border-primary/20"
      } bg-black relative`}
    >
      {isHighlighted && (
        <div className="absolute -top-px left-0 right-0 h-px bg-primary" />
      )}
      {isHighlighted && (
        <div className="text-[8px] text-black bg-primary text-center py-1 font-bold tracking-widest">
          MOST POPULAR
        </div>
      )}

      <div className="p-6 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4 h-4 text-primary/60" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{product.name}</span>
        </div>

        {monthlyPrice ? (
          <div className="mb-1">
            <span className="text-3xl font-bold text-primary font-mono">
              {formatPrice(monthlyPrice.unitAmount, monthlyPrice.currency)}
            </span>
            <span className="text-[9px] text-primary/40 ml-1">/month</span>
          </div>
        ) : (
          <div className="text-[9px] text-primary/40 mb-1">Contact for pricing</div>
        )}

        {product.description && (
          <p className="text-[8px] text-primary/40 mb-4 leading-relaxed">{product.description}</p>
        )}

        <ul className="space-y-2 mb-6">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[8px] text-primary/60">
              <Check className="w-3 h-3 text-primary shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 pt-0">
        {isCurrentPlan ? (
          <div className="flex items-center justify-center gap-2 border border-green-500/30 bg-green-900/10 text-green-400 text-[9px] uppercase tracking-widest py-2.5">
            <Check className="w-3 h-3" /> CURRENT PLAN
          </div>
        ) : monthlyPrice ? (
          <button
            onClick={() => onSubscribe(monthlyPrice.id)}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest py-2.5 transition-colors disabled:opacity-50 ${
              isHighlighted
                ? "bg-primary text-black hover:bg-primary/80"
                : "border border-primary/30 text-primary hover:border-primary hover:bg-primary/5"
            }`}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {loading ? "REDIRECTING..." : "SUBSCRIBE NOW"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Pricing() {
  const { user } = useUser();
  const { toast } = useToast();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const { data: products = [], isLoading: loadingProducts, error: productsError } = useQuery<Product[]>({
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
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: Error) => {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
      setCheckingOut(null);
    },
  });

  const handleSubscribe = (priceId: string) => {
    setCheckingOut(priceId);
    checkoutMutation.mutate(priceId);
  };

  const portalMutation = useMutation({
    mutationFn: () => apiFetch("/api/stripe/portal", { method: "POST" }),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const currentPlanId = subData?.subscription?.items?.data?.[0]?.price?.product;

  return (
    <div className="space-y-8 font-mono">
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary">Subscription Plans</h1>
        <p className="text-[9px] text-primary/40 mt-0.5">
          Choose your ProxhqVPN plan. All plans include WireGuard and a strict no-logs policy.
        </p>
      </div>

      {subData?.hasWireGuard && (
        <div className="flex items-center justify-between border border-green-500/30 bg-green-900/10 p-4">
          <div className="flex items-center gap-2 text-[9px] text-green-400">
            <Check className="w-3.5 h-3.5" />
            You have an active subscription
          </div>
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="text-[8px] uppercase tracking-widest border border-green-500/30 text-green-400 hover:bg-green-900/20 px-3 py-1.5 transition-colors"
          >
            {portalMutation.isPending ? "Opening..." : "MANAGE BILLING"}
          </button>
        </div>
      )}

      {loadingProducts && (
        <div className="text-[9px] text-primary/40 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading plans...
        </div>
      )}

      {productsError && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-900/10 p-4">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <div className="text-[9px] text-red-400 font-bold">Stripe not configured</div>
            <div className="text-[8px] text-red-400/70 mt-1">
              Subscription plans need to be created in your Stripe dashboard first.
            </div>
          </div>
        </div>
      )}

      {!loadingProducts && products.length === 0 && !productsError && (
        <div className="flex items-start gap-2 border border-yellow-500/30 bg-yellow-900/10 p-4">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
          <div>
            <div className="text-[9px] text-yellow-400 font-bold">No plans configured yet</div>
            <div className="text-[8px] text-yellow-400/70 mt-1">
              Create products and prices in your Stripe dashboard at dashboard.stripe.com, then they'll appear here automatically.
            </div>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.map((product) => (
            <PlanCard
              key={product.id}
              product={product}
              isCurrentPlan={currentPlanId === product.id}
              onSubscribe={handleSubscribe}
              loading={checkingOut === product.prices.find((p) => p.recurring?.interval === "month")?.id}
            />
          ))}
        </div>
      )}

      <div className="border border-primary/10 bg-primary/5 p-4">
        <div className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2">All plans include</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["WireGuard protocol", "No-logs policy", "Kill switch", "DNS leak protection"].map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-[8px] text-primary/50">
              <Check className="w-2.5 h-2.5 text-primary/40" /> {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
