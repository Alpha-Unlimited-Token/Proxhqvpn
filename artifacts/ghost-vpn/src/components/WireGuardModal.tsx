import { useState } from "react";
import { Shield, Zap, CheckCircle, X, Lock, Wifi, Smartphone, Router, Monitor, Tv, Globe, ArrowRight, Loader2 } from "lucide-react";
import { useWireGuardSubscription } from "@/hooks/useWireGuardSubscription";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FEATURES = [
  { icon: Wifi,       text: "WireGuard tunnel on all devices" },
  { icon: Smartphone, text: "QR code setup — scan & go on mobile" },
  { icon: Router,     text: "Router configs for 6 firmware types" },
  { icon: Monitor,    text: "Desktop app auto-configuration" },
  { icon: Tv,         text: "Smart TV & console support" },
  { icon: Globe,      text: "AES-256-GCM + kill switch + DNS shield" },
];

const PLAN_LABELS: Record<string, { label: string; badge?: string; perMonth: string; billing: string }> = {
  monthly: { label: "Monthly",  perMonth: "$14.00/mo",  billing: "Billed monthly" },
  annual:  { label: "Annual",   perMonth: "$7.00/mo",   billing: "Billed $84.00/year", badge: "SAVE 50%" },
  "2year": { label: "2-Year",   perMonth: "$5.00/mo",   billing: "Billed $120.00/2 yrs", badge: "BEST VALUE" },
};

function formatPriceLabel(price: { unitAmount: number; recurring: any; id: string }) {
  const interval: string = price.recurring?.interval ?? "";
  const count: number = price.recurring?.interval_count ?? 1;
  if (interval === "month") return "monthly";
  if (interval === "year" && count === 2) return "2year";
  if (interval === "year") return "annual";
  return "monthly";
}

export default function WireGuardModal({ open, onClose }: Props) {
  const { products, loading, openCheckout, checkingOut } = useWireGuardSubscription();
  const [selectedPrice, setSelectedPrice] = useState<string | null>(null);

  if (!open) return null;

  const wgProduct = products.find(p => p.metadata?.feature === "wireguard");
  const prices = wgProduct?.prices ?? [];

  const sortedPrices = [...prices].sort((a, b) => {
    const order = { monthly: 0, annual: 1, "2year": 2 };
    return (order[formatPriceLabel(a) as keyof typeof order] ?? 0) - (order[formatPriceLabel(b) as keyof typeof order] ?? 0);
  });

  const handlePurchase = async () => {
    const priceId = selectedPrice ?? sortedPrices.find(p => formatPriceLabel(p) === "annual")?.id ?? sortedPrices[0]?.id;
    if (!priceId) return;
    await openCheckout(priceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-black border border-primary/30 shadow-[0_0_60px_rgba(0,255,0,0.08)] font-mono relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <button onClick={onClose} className="absolute top-3 right-3 text-primary/40 hover:text-primary transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 border-b border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 border border-primary/40 flex items-center justify-center bg-primary/5">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-[0.15em] text-primary uppercase">WireGuard Add-on</h2>
              <p className="text-[9px] text-primary/40 tracking-widest">by ProxhqVPN · ALPHA UNLIMITED TECHNOLOGIES LLC</p>
            </div>
          </div>
          <p className="text-[10px] text-primary/60 mt-3 leading-relaxed">
            Unlock the full WireGuard experience on every device you own. Auto-configure your phone in seconds with a QR scan, set up your router to protect your entire home network, and manage all devices from one place.
          </p>
        </div>

        <div className="p-4 border-b border-primary/10">
          <div className="text-[8px] tracking-[0.25em] text-primary/30 uppercase mb-3">What's included</div>
          <div className="grid grid-cols-2 gap-1.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[9px] text-primary/60">
                <Icon className="w-3 h-3 text-primary/40 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-primary/10">
          <div className="text-[8px] tracking-[0.25em] text-primary/30 uppercase mb-3">Choose a plan</div>

          {loading ? (
            <div className="flex items-center gap-2 text-[9px] text-primary/40 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading pricing...
            </div>
          ) : sortedPrices.length === 0 ? (
            <p className="text-[9px] text-primary/30">Pricing unavailable — please try again</p>
          ) : (
            <div className="space-y-1.5">
              {sortedPrices.map(price => {
                const planKey = formatPriceLabel(price);
                const meta = PLAN_LABELS[planKey] ?? { label: planKey, perMonth: `$${(price.unitAmount / 100).toFixed(2)}`, billing: "" };
                const isSelected = (selectedPrice ?? sortedPrices.find(p => formatPriceLabel(p) === "annual")?.id) === price.id;
                return (
                  <button
                    key={price.id}
                    onClick={() => setSelectedPrice(price.id)}
                    className={`w-full flex items-center justify-between border px-3 py-2.5 transition-all ${
                      isSelected ? "border-primary bg-primary/10" : "border-primary/20 hover:border-primary/50"
                    }`}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary uppercase">{meta.label}</span>
                        {meta.badge && (
                          <span className="text-[8px] bg-primary text-black px-1.5 py-0.5 font-bold">{meta.badge}</span>
                        )}
                      </div>
                      <div className="text-[9px] text-primary/40 mt-0.5">{meta.billing}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-primary">{meta.perMonth}</div>
                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto mt-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={handlePurchase}
            disabled={checkingOut || loading || sortedPrices.length === 0}
            className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-black bg-primary hover:bg-primary/80 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingOut ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> REDIRECTING TO CHECKOUT...</>
            ) : (
              <><Lock className="w-3.5 h-3.5" /> SUBSCRIBE &amp; ACTIVATE WIREGUARD <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
          <div className="flex items-center justify-center gap-4 text-[8px] text-primary/25">
            <span>🔒 Stripe secure checkout</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>Instant activation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
