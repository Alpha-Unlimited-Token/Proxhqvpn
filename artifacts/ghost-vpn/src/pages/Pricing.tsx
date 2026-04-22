import { useState } from "react";
import { PageSEO } from "@/components/PageSEO";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  Check, Shield, Zap, Loader2, Star, AlertCircle,
  Lock, Cpu, Globe, ShieldCheck, Server, Terminal as TerminalIcon,
  ScanSearch, Globe2, Network, Activity, Send, FolderSearch, Radar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/hooks/useAccess";

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
type BillingPeriod = "monthly" | "annual";

const VPN_FEATURES = [
  { icon: Shield, text: "WireGuard AES-256-GCM encryption" },
  { icon: Lock, text: "Kill switch & auto-reconnect" },
  { icon: ShieldCheck, text: "DNS leak protection" },
  { icon: Globe, text: "6,000+ VPN Gate relay servers" },
  { icon: Cpu, text: "Double-hop anonymity routing" },
  { icon: Zap, text: "Stealth obfuscation — bypass DPI" },
  { icon: Server, text: "Unlimited simultaneous devices" },
  { icon: Globe2, text: "Split tunneling & Smart DNS" },
  { icon: Globe2, text: "Onion Browser — Tor over VPN private browsing" },
];

const PRO_EXTRAS = [
  { icon: ScanSearch, text: "Vulnerability Scanner (SQLMap + nmap port scan)" },
  { icon: Send,       text: "HTTP Probe — craft raw HTTP requests, inspect responses (Burp Repeater equivalent)" },
  { icon: FolderSearch, text: "Directory Fuzzer — brute-force hidden endpoints & admin panels (ffuf equivalent)" },
  { icon: Radar,      text: "Subdomain Scout — certificate transparency + DNS enumeration" },
  { icon: Network,    text: "Ghost Chain — 7-hop Tor-veiled proxy routing" },
  { icon: Activity,   text: "Threat Intelligence — live IP reputation, Tor exit feeds, blocklist" },
  { icon: TerminalIcon, text: "Alpha Toolkit — network/security/exploit scanner" },
  { icon: ShieldCheck, text: "Security Audit — TLS grader, HTTP headers, WHOIS" },
  { icon: Server,     text: "SilkWeb honeypot decoy network + Beacon intrusion alerts" },
];

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(cents / 100);
}

function getPriceForPeriod(prices: Price[], period: BillingPeriod): Price | null {
  if (period === "monthly") return prices.find(p => p.recurring?.interval === "month") ?? null;
  if (period === "annual")  return prices.find(p => p.recurring?.interval === "year")  ?? null;
  return null;
}

export default function Pricing() {
  const { user } = useUser();
  const { toast } = useToast();
  const { tier, hasAccess, hasCommandCenter } = useAccess();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<null | "valid" | "invalid">(null);
  const [promoAmbassador, setPromoAmbassador] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["stripe-products"],
    queryFn: () => apiFetch("/api/stripe/products"),
    staleTime: 60_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (priceId: string) =>
      apiFetch("/api/stripe/checkout", { method: "POST", body: JSON.stringify({ priceId, promoCode: promoCode.trim().toUpperCase() || undefined }) }),
    onSuccess: (data) => {
      if (data.url) {
        if (promoCode.trim()) sessionStorage.setItem("proxhq_promo_code", promoCode.trim().toUpperCase());
        window.location.href = data.url;
      }
    },
    onError: (e: Error) => {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
      setCheckingOut(null);
    },
  });

  const validatePromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await fetch(`${BASE}/api/ambassadors/promo/${code}`, { credentials: "include" });
      const d = await r.json();
      if (r.ok && d.status === "approved") {
        setPromoStatus("valid");
        setPromoAmbassador(d.name);
      } else {
        setPromoStatus("invalid");
        setPromoAmbassador(null);
      }
    } catch {
      setPromoStatus("invalid");
      setPromoAmbassador(null);
    }
  };

  const portalMutation = useMutation({
    mutationFn: () => apiFetch("/api/stripe/portal", { method: "POST" }),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const vpnProduct    = products.find(p => p.metadata?.tier === "vpn") ?? null;
  const proProduct    = products.find(p => p.metadata?.tier === "command_center") ?? null;
  const vpnPrice      = vpnProduct  ? getPriceForPeriod(vpnProduct.prices,  period) : null;
  const proPrice      = proProduct  ? getPriceForPeriod(proProduct.prices,  period) : null;

  const checkout = (priceId: string) => {
    setCheckingOut(priceId);
    checkoutMutation.mutate(priceId);
  };

  const savings = (monthly: number, annual: number) =>
    Math.round(100 - (annual / 12 / monthly * 100));

  const vpnMonthly  = vpnProduct  ? (getPriceForPeriod(vpnProduct.prices,  "monthly")?.unitAmount ?? 699)   : 699;
  const proMonthly  = proProduct  ? (getPriceForPeriod(proProduct.prices,  "monthly")?.unitAmount ?? 3999)  : 3999;
  const vpnAnnual   = vpnProduct  ? (getPriceForPeriod(vpnProduct.prices,  "annual")?.unitAmount  ?? 5999)  : 5999;
  const proAnnual   = proProduct  ? (getPriceForPeriod(proProduct.prices,  "annual")?.unitAmount  ?? 34999) : 34999;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      <PageSEO
        title="Pricing — VPN Basic &amp; Command Center Pro"
        description="Choose your ProxhqVPN plan. VPN Basic starts at $6.99/month ($59.99/year). Command Center Pro with full security suite from $39.99/month ($349.99/year). 30-day money-back guarantee."
        path="/pricing"
      />

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
          <Star className="w-3 h-3 text-primary" />
          <span className="text-xs text-primary font-medium">ProxhqVPN — Pricing</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Privacy tools. Developer toolkit. One platform.
        </h1>
        <p className="text-white/78 text-sm max-w-xl mx-auto">
          Start with VPN Basic for personal privacy — or unlock the full Command Center suite for security research, penetration testing, and developer workflows.
        </p>
      </div>

      {/* Active plan banner */}
      {hasAccess && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-primary/8 border border-primary/25 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2.5 text-sm text-primary font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              Active plan: <strong>{tier === "command_center" ? "Command Center Pro" : "VPN Basic"}</strong>
              {tier === "vpn" && <span className="text-white/78 font-normal ml-1">— upgrade to Pro to unlock developer tools</span>}
            </span>
          </div>
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="text-xs border border-primary/30 text-primary hover:bg-primary/10 rounded-xl px-4 py-2 transition-all shrink-0"
          >
            {portalMutation.isPending ? "Opening..." : "Manage Billing"}
          </button>
        </div>
      )}

      {/* Billing period toggle */}
      <div className="flex justify-center">
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-1 flex gap-1">
          {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`relative px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                period === p ? "bg-primary text-black" : "text-white/83 hover:text-white/80"
              }`}
            >
              {p === "monthly" ? "Monthly" : "Annual"}
              {p === "annual" && period !== "annual" && (
                <span className="absolute -top-2.5 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  SAVE {savings(vpnMonthly, vpnAnnual)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ambassador promo code */}
      {!hasAccess && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 border border-primary/15 rounded-2xl px-5 py-4 bg-primary/5">
          <div className="flex-1">
            <div className="text-xs font-semibold text-primary/70 mb-1">Have an ambassador promo code?</div>
            <div className="flex items-center gap-2">
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setPromoStatus(null); setPromoAmbassador(null); }}
                onKeyDown={e => e.key === "Enter" && validatePromo()}
                placeholder="Enter code (e.g. JOHN2024)"
                className="bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-primary/50 rounded-lg tracking-widest w-44"
              />
              <button onClick={validatePromo} disabled={!promoCode.trim()}
                className="text-[10px] font-mono border border-primary/30 text-primary/60 hover:border-primary hover:text-primary px-3 py-1.5 rounded-lg disabled:opacity-30 transition-colors">
                Apply
              </button>
            </div>
          </div>
          {promoStatus === "valid" && promoAmbassador && (
            <div className="flex items-center gap-2 text-green-400 text-[11px] font-mono bg-green-900/10 border border-green-500/20 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5" />
              Supporting <strong>{promoAmbassador}</strong> — they'll earn 10% commission!
            </div>
          )}
          {promoStatus === "invalid" && (
            <div className="flex items-center gap-2 text-red-400 text-[11px] font-mono bg-red-900/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> Code not found or inactive
            </div>
          )}
          {!promoStatus && (
            <a href="/ambassadors" className="text-[10px] font-mono text-primary/30 hover:text-primary/60 transition-colors shrink-0">
              Browse ambassadors →
            </a>
          )}
        </div>
      )}

      {/* Plan cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-white/70 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading plans...
        </div>
      ) : (!vpnProduct && !proProduct) ? (
        <div className="flex items-start gap-3 bg-yellow-900/10 border border-yellow-500/20 rounded-2xl p-5">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-yellow-400">Plans are being set up</div>
            <div className="text-sm text-yellow-400/60 mt-1">Check back in a moment — your subscription plans are being created in Stripe.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── VPN Basic ── */}
          <div className={`bg-[#0d1610] border rounded-2xl overflow-hidden flex flex-col ${
            tier === "vpn" ? "border-primary/40 shadow-[0_0_40px_rgba(0,255,136,0.06)]" : "border-white/[0.07]"
          }`}>
            <div className="p-7 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-primary/60 mb-1">VPN Basic</div>
                  <div className="text-lg font-bold text-white">Personal Privacy Suite</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary/70" />
                </div>
              </div>

              {/* Price */}
              <div className="flex items-end gap-2 mb-1">
                <div className="flex items-start">
                  <span className="text-white/78 text-base mt-1.5 mr-0.5">$</span>
                  <span className="text-5xl font-bold text-white leading-none">
                    {period === "monthly"
                      ? Math.floor(vpnMonthly / 100)
                      : Math.floor(vpnAnnual / 100)}
                  </span>
                  {period === "monthly" && vpnMonthly % 100 !== 0 && (
                    <span className="text-white/88 text-2xl mt-2">.{String(vpnMonthly % 100).padStart(2, "0")}</span>
                  )}
                  {period === "annual" && vpnAnnual % 100 !== 0 && (
                    <span className="text-white/88 text-2xl mt-2">.{String(vpnAnnual % 100).padStart(2, "0")}</span>
                  )}
                </div>
                <span className="text-white/70 text-sm pb-1">/{period === "monthly" ? "month" : "year"}</span>
              </div>
              {period === "annual" && (
                <div className="text-primary/70 text-xs font-medium mb-4">
                  ${(vpnAnnual / 12 / 100).toFixed(2)}/mo · save {savings(vpnMonthly, vpnAnnual)}% vs monthly
                </div>
              )}
              {period === "monthly" && <div className="mb-4" />}

              <div className="text-white/78 text-xs mb-6 leading-relaxed">
                Everything you need for personal privacy and secure browsing. Includes all core VPN features with no limitations.
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-7 flex-1">
                {VPN_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-primary" />
                    </div>
                    <span className="text-[12px] text-white/88">{f.text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {tier === "vpn" ? (
                <div className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/25 rounded-xl py-3 text-primary text-sm font-medium">
                  <Check className="w-4 h-4" /> Current Plan
                </div>
              ) : tier === "command_center" ? (
                <div className="w-full flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 text-white/70 text-sm">
                  Included in your Pro plan
                </div>
              ) : (
                <button
                  onClick={() => vpnPrice && checkout(vpnPrice.id)}
                  disabled={!!checkingOut || !vpnPrice}
                  className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-primary text-black hover:brightness-110 transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(0,255,136,0.15)]"
                >
                  {checkingOut === vpnPrice?.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                  ) : (
                    <><Shield className="w-4 h-4" /> Get VPN Basic</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* ── Command Center Pro ── */}
          <div className="bg-[#0d1610] border border-yellow-500/30 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(234,179,8,0.06)] relative">
            <div className="bg-gradient-to-r from-yellow-500/90 to-orange-500/90 text-black text-center text-[11px] font-bold tracking-widest py-2">
              DEVELOPER TOOLKIT — BEST VALUE
            </div>
            <div className="p-7 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-yellow-400/70 mb-1">Command Center Pro</div>
                  <div className="text-lg font-bold text-white">Full Security Toolkit</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-yellow-400/70" />
                </div>
              </div>

              {/* Price */}
              <div className="flex items-end gap-2 mb-1">
                <div className="flex items-start">
                  <span className="text-white/78 text-base mt-1.5 mr-0.5">$</span>
                  <span className="text-5xl font-bold text-white leading-none">
                    {period === "monthly"
                      ? Math.floor(proMonthly / 100)
                      : Math.floor(proAnnual / 100)}
                  </span>
                  {period === "monthly" && proMonthly % 100 !== 0 && (
                    <span className="text-white/88 text-2xl mt-2">.{String(proMonthly % 100).padStart(2, "0")}</span>
                  )}
                  {period === "annual" && proAnnual % 100 !== 0 && (
                    <span className="text-white/88 text-2xl mt-2">.{String(proAnnual % 100).padStart(2, "0")}</span>
                  )}
                </div>
                <span className="text-white/70 text-sm pb-1">/{period === "monthly" ? "month" : "year"}</span>
              </div>
              {period === "annual" && (
                <div className="text-yellow-400/70 text-xs font-medium mb-4">
                  ${(proAnnual / 12 / 100).toFixed(2)}/mo · save {savings(proMonthly, proAnnual)}% vs monthly
                </div>
              )}
              {period === "monthly" && (
                <div className="text-yellow-400/50 text-xs mb-4">
                  Compare: Burp Suite Pro $449/yr · Shodan $49/mo
                </div>
              )}

              <div className="text-white/78 text-xs mb-5 leading-relaxed">
                Everything in VPN Basic <strong className="text-white/83">plus</strong> the complete developer security toolkit — built for pentesters, developers, and security researchers.
              </div>

              {/* VPN features (condensed) */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-primary" />
                </div>
                <span className="text-[12px] text-white/78">All VPN Basic features included</span>
              </div>

              {/* Pro extras */}
              <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/50 mb-2.5 mt-1">Command Center tools</div>
              <ul className="space-y-2 mb-7 flex-1">
                {PRO_EXTRAS.map((f) => (
                  <li key={f.text} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-yellow-400" />
                    </div>
                    <span className="text-[12px] text-white/88">{f.text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {tier === "command_center" ? (
                <div className="w-full flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/25 rounded-xl py-3 text-yellow-400 text-sm font-medium">
                  <Check className="w-4 h-4" /> Current Plan
                </div>
              ) : tier === "vpn" ? (
                <button
                  onClick={() => proPrice && checkout(proPrice.id)}
                  disabled={!!checkingOut || !proPrice}
                  className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:brightness-110 transition-all disabled:opacity-40 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
                >
                  {checkingOut === proPrice?.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Upgrade to Pro</>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => proPrice && checkout(proPrice.id)}
                  disabled={!!checkingOut || !proPrice}
                  className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:brightness-110 transition-all disabled:opacity-40 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
                >
                  {checkingOut === proPrice?.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Get Command Center Pro</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Value comparison */}
      <div className="bg-[#0d1610] border border-white/[0.06] rounded-2xl p-6">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-4 text-center">
          Command Center Pro vs industry tools
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { tool: "Burp Suite Pro", price: "$475/yr", tag: "HTTP proxy + scanner only (no VPN)" },
            { tool: "Shodan Freelancer", price: "$69/mo", tag: "device intelligence only" },
            { tool: "Metasploit Pro", price: "$15,000/yr", tag: "exploit framework only" },
            { tool: "ProxhqVPN Pro", price: "$39.99/mo*", tag: "VPN + full security toolkit", highlight: true },
          ].map((r) => (
            <div key={r.tool} className={`rounded-xl p-3.5 text-center ${
              r.highlight
                ? "bg-yellow-500/8 border border-yellow-500/20"
                : "bg-white/[0.02] border border-white/[0.05]"
            }`}>
              <div className={`text-sm font-bold mb-0.5 ${r.highlight ? "text-yellow-400" : "text-white/83"}`}>
                {r.price}
              </div>
              <div className={`text-[11px] font-semibold mb-0.5 ${r.highlight ? "text-white/93" : "text-white/78"}`}>
                {r.tool}
              </div>
              <div className={`text-[10px] ${r.highlight ? "text-yellow-400/50" : "text-white/70"}`}>
                {r.tag}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-[10px] text-white/70 mt-3">* Annual plan equivalent · $299.99/yr</div>
      </div>

      {/* Guarantees */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { title: "No Logs", body: "We never record your IP, browsing history, or traffic." },
          { title: "30-Day Guarantee", body: "Not satisfied? Full refund within 30 days." },
          { title: "Instant Access", body: "Your VPN is live within 30 seconds of subscribing." },
        ].map((item) => (
          <div key={item.title} className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4 text-center">
            <div className="text-xs font-semibold text-white/88 mb-1">{item.title}</div>
            <div className="text-xs text-white/70 leading-relaxed">{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
