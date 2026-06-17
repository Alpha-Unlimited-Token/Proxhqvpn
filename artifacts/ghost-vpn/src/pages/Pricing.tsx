// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { PageSEO } from "@/components/PageSEO";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  Check, Shield, Zap, Loader2, Star, AlertCircle,
  Lock, Cpu, Globe, ShieldCheck, Server, Terminal as TerminalIcon,
  ScanSearch, Globe2, Network, Activity, Send, FolderSearch, Radar,
  MapPin, Database, Code, Package, Key, Copy, Clock, CheckCircle2,
  X, Bitcoin, Users, Building2, Flame, ChevronDown, ChevronUp,
  Phone, Mail, ArrowRight, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/hooks/useAccess";
import { Link } from "wouter";

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

// ── Per-tier feature lists ──────────────────────────────────────────────────

const PERSONAL_FEATURES = [
  { icon: Shield,     text: "WireGuard AES-256-GCM encryption" },
  { icon: Lock,       text: "Kill switch & auto-reconnect (Linux/macOS/Windows + IPv6)" },
  { icon: ShieldCheck, text: "DNS leak, WebRTC & IPv6 leak protection" },
  { icon: Globe,      text: "Ad, tracker & malware blocking (DNS Shield)" },
  { icon: Globe,      text: "6,000+ VPN Gate relay servers" },
  { icon: Zap,        text: "Stealth obfuscation — bypass DPI censorship" },
  { icon: Server,     text: "Unlimited simultaneous devices" },
  { icon: Globe2,     text: "Split tunneling & Smart DNS" },
  { icon: Network,    text: "Basic firewall rules & IP blocklist" },
];

const POWER_EXTRAS = [
  { icon: Network,    text: "Port forwarding — expose services through the tunnel" },
  { icon: Globe,      text: "Advanced DNS (DoH/DoT/custom resolvers)" },
  { icon: Zap,        text: "obfs4 / Shadowsocks / V2Ray / Meek / Snowflake obfuscation" },
  { icon: Cpu,        text: "WireGuard tuning (MTU, PersistentKeepalive, custom endpoints)" },
  { icon: Key,        text: "Multiple WireGuard identities" },
  { icon: MapPin,     text: "GPS spoofing — mask real GPS coordinates" },
  { icon: Network,    text: "Ghost Chain — 7-hop Tor-veiled proxy routing" },
  { icon: Globe2,     text: "Onion Browser — Tor over VPN private browsing" },
  { icon: Cpu,        text: "Meshnet — encrypted peer-to-peer device mesh" },
  { icon: Globe,      text: "Dedicated static exit IP" },
  { icon: Server,     text: "Router config generator (OpenWRT/pfSense/Merlin/GL.iNet)" },
];

const PROFESSIONAL_EXTRAS = [
  { icon: ScanSearch, text: "Vulnerability Scanner (SQLMap + nmap port scan)" },
  { icon: Send,       text: "HTTP Probe — Burp Repeater equivalent" },
  { icon: FolderSearch, text: "Directory Fuzzer — hidden endpoint brute force (ffuf)" },
  { icon: Radar,      text: "Subdomain Scout — certificate transparency + DNS enumeration" },
  { icon: Code,       text: "OAST Tester — out-of-band application security testing" },
  { icon: Activity,   text: "WebSocket Tester — intercept, replay & fuzz WS frames" },
  { icon: ShieldCheck, text: "SAST Scanner — 35+ static vulnerability patterns" },
  { icon: Package,    text: "Dependency Scanner — CVE checks (npm/pip/cargo/maven/go)" },
  { icon: Key,        text: "Token Sequencer — session entropy analysis & prediction" },
  { icon: Activity,   text: "Threat Intelligence — IP reputation, Tor exits, blocklists" },
  { icon: Server,     text: "SilkWeb honeypot decoy network + Beacon intrusion alerts" },
  { icon: ShieldCheck, text: "Security Audit — TLS grader, HTTP headers, WHOIS/RDAP" },
  { icon: Database,   text: "Audit history (SHA3-256 hash chain)" },
  { icon: Network,    text: "OSINT Recon engine — DNS, ASN, email security fingerprinting" },
  { icon: ShieldCheck, text: "Ghost Trap passive honeypot + IP enrichment (AbuseIPDB + GreyNoise)" },
  { icon: Radar,      text: "AI Threat Analysis — plain-English detection explanations (Claude)" },
  { icon: Activity,   text: "Custom Detection Signature Engine — AND/OR rule builder" },
];

const BUSINESS_EXTRAS = [
  { text: "RBAC — 6 roles (owner / security_admin / network_admin / auditor / support / user)" },
  { text: "Team user management — add, remove, assign roles" },
  { text: "Device inventory across your entire team" },
  { text: "Compliance reporting & export" },
  { text: "VPN policy enforcement per user" },
  { text: "Security dashboards (centralized view)" },
  { text: "SIEM unified event log (Beacon / Firewall / GhostTrace / GhostChain)" },
  { text: "Node analytics across your fleet" },
  { text: "Centralized SHA3-256 audit ledger" },
  { text: "Hardening scripts & admin installer downloads" },
  { text: "10-user minimum" },
];

const ENTERPRISE_EXTRAS = [
  { text: "Zero Trust Network Access (ZTNA) — device posture scoring" },
  { text: "SIEM fanout — Splunk HEC + custom webhook" },
  { text: "Full Command Center (offensive + defensive operations)" },
  { text: "Deception platform — Ghost Trap, SilkWeb, Honeypot Command" },
  { text: "Ghost Nodes — ephemeral exit VPS (RAM-only keys, no-logs architecture)" },
  { text: "Ghost Routing Mode — rotating exit IP with instant Burn & Reprovision" },
  { text: "QuantumAudit — blockchain security scanner (classical + post-quantum)" },
  { text: "Signature Mining Engine (ECDSA nonce reuse, Peel Chain, Hybrid Worm)" },
  { text: "Custom node deployment & Vultr fleet management" },
  { text: "SSO / SAML (Clerk enterprise identity)" },
  { text: "Dedicated account manager + custom SLA" },
  { text: "24/7 priority support" },
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

function savings(monthly: number, annual: number) {
  return Math.round(100 - (annual / 12 / monthly * 100));
}

function PriceDisplay({ cents, period }: { cents: number; period: string }) {
  const whole = Math.floor(cents / 100);
  const frac  = cents % 100;
  return (
    <div className="flex items-start">
      <span className="text-white/70 text-base mt-1.5 mr-0.5">$</span>
      <span className="text-5xl font-bold text-white leading-none">{whole}</span>
      {frac !== 0 && (
        <span className="text-white/80 text-2xl mt-2">.{String(frac).padStart(2, "0")}</span>
      )}
      <span className="text-white/50 text-sm mt-auto pb-1 ml-1">/{period}</span>
    </div>
  );
}

function FeatureRow({ text, dimmed = false }: { text: string; dimmed?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
        <Check className="w-2.5 h-2.5 text-primary" />
      </div>
      <span className={`text-[12px] leading-relaxed ${dimmed ? "text-white/70" : "text-white/88"}`}>{text}</span>
    </li>
  );
}

function ContactSalesBtn({ label }: { label: string }) {
  return (
    <a
      href="mailto:alphaunlimitedtechnologies@gmail.com?subject=ProxhqVPN%20Inquiry"
      className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-white/[0.06] border border-white/[0.12] text-white hover:bg-white/[0.10] hover:border-white/20 transition-all"
    >
      <Mail className="w-4 h-4" /> {label}
    </a>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function Pricing() {
  const { user } = useUser();
  const { toast } = useToast();
  const { tier, hasAccess, hasCommandCenter } = useAccess();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState(() => sessionStorage.getItem("proxhq_promo_code") ?? "");
  const [promoStatus, setPromoStatus] = useState<null | "valid" | "invalid">(null);
  const [promoAmbassador, setPromoAmbassador] = useState<string | null>(null);
  const [showPowerFeatures, setShowPowerFeatures] = useState(false);
  const [showProFeatures, setShowProFeatures] = useState(false);

  // Crypto payment state
  const [cryptoModal, setCryptoModal] = useState<{ plan: string; planLabel: string } | null>(null);
  const [cryptoCurrency, setCryptoCurrency] = useState<"BTC" | "ETH">("BTC");
  const [cryptoInvoice, setCryptoInvoice] = useState<any | null>(null);
  const [cryptoStatus, setCryptoStatus] = useState<"idle" | "creating" | "awaiting" | "confirmed" | "expired" | "error">("idle");
  const [cryptoError, setCryptoError] = useState<string>("");
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [countdown, setCountdown] = useState(0);

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

  const createCryptoInvoice = useCallback(async (plan: string, currency: "BTC" | "ETH") => {
    setCryptoStatus("creating");
    setCryptoInvoice(null);
    try {
      const data = await apiFetch("/api/payments/crypto/create", {
        method: "POST",
        body: JSON.stringify({ plan, currency }),
      });
      setCryptoInvoice(data);
      setCryptoStatus("awaiting");
      const secs = Math.max(0, Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    } catch (e: any) {
      setCryptoError(e.message ?? "Unknown error");
      setCryptoStatus("error");
    }
  }, []);

  useEffect(() => {
    if (cryptoStatus !== "awaiting" || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => {
      if (c <= 1) { setCryptoStatus("expired"); clearInterval(t); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [cryptoStatus, countdown]);

  useEffect(() => {
    if (cryptoStatus !== "awaiting" || !cryptoInvoice?.invoiceId) return;
    const poll = async () => {
      try {
        const data = await apiFetch(`/api/payments/crypto/status/${cryptoInvoice.invoiceId}`);
        if (data.status === "confirmed") {
          setCryptoStatus("confirmed");
          toast({ title: "Payment confirmed!", description: "Your subscription is now active." });
        } else if (data.status === "expired") {
          setCryptoStatus("expired");
        }
      } catch {}
    };
    const t = setInterval(poll, 15000);
    poll();
    return () => clearInterval(t);
  }, [cryptoStatus, cryptoInvoice?.invoiceId, toast]);

  const copyText = (text: string, type: "address" | "amount") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const fmtCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const openCrypto = (plan: string, label: string) => {
    setCryptoModal({ plan, planLabel: label });
    setCryptoInvoice(null);
    setCryptoStatus("idle");
    setCryptoError("");
    setCryptoCurrency("BTC");
    setCountdown(0);
  };

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

  // Map Stripe products to tiers
  const personalProduct    = products.find(p => p.metadata?.tier === "vpn") ?? null;
  const professionalProduct = products.find(p => p.metadata?.tier === "command_center") ?? null;
  const personalPrice      = personalProduct    ? getPriceForPeriod(personalProduct.prices,    period) : null;
  const professionalPrice  = professionalProduct ? getPriceForPeriod(professionalProduct.prices, period) : null;

  const checkout = (priceId: string) => {
    setCheckingOut(priceId);
    checkoutMutation.mutate(priceId);
  };

  // Static fallback prices (cents)
  const personalMonthly  = personalProduct    ? (getPriceForPeriod(personalProduct.prices,    "monthly")?.unitAmount ?? 999)  : 999;
  const proMonthly       = professionalProduct ? (getPriceForPeriod(professionalProduct.prices, "monthly")?.unitAmount ?? 3999) : 3999;
  const personalAnnual   = personalProduct    ? (getPriceForPeriod(personalProduct.prices,    "annual")?.unitAmount  ?? 8999) : 8999;
  const proAnnual        = professionalProduct ? (getPriceForPeriod(professionalProduct.prices, "annual")?.unitAmount  ?? 39900) : 39900;

  const personalSave = savings(personalMonthly, personalAnnual);
  const proSave      = savings(proMonthly, proAnnual);

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-2">
      <PageSEO
        title="Pricing — ProxhqVPN Personal, Pro, Business &amp; Enterprise"
        description="ProxhqVPN tiered plans: Personal from $9.99/mo, Power User $19.99/mo, Professional $39.99/mo, Business from $150/mo, Enterprise custom. VPN + Zero Trust + Security Platform."
        path="/pricing"
      />

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
          <Star className="w-3 h-3 text-primary" />
          <span className="text-xs text-primary font-medium">Four products. One platform.</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          VPN + Zero Trust + Security Platform
        </h1>
        <p className="text-white/70 text-sm max-w-2xl mx-auto">
          Start with personal privacy and grow into a full security operations platform. Every tier is built on the same WireGuard infrastructure — your plan determines which layers you can access.
        </p>
      </div>

      {/* Active plan banner */}
      {hasAccess && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-primary/8 border border-primary/25 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2.5 text-sm text-primary font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              Active plan: <strong>{tier === "command_center" ? "Professional" : "Personal"}</strong>
              {tier === "vpn" && <span className="text-white/70 font-normal ml-1">— upgrade to Professional to unlock the full security toolkit</span>}
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
                period === p ? "bg-primary text-black" : "text-white/70 hover:text-white/90"
              }`}
            >
              {p === "monthly" ? "Monthly" : "Annual"}
              {p === "annual" && period !== "annual" && (
                <span className="absolute -top-2.5 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  SAVE {personalSave}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Promo code */}
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
                className="bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-primary/50 rounded-lg tracking-widest w-56"
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

      {/* ── Self-serve tier cards (Personal / Power User / Professional) ─── */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4 text-center">
          Self-Serve Plans — Instant Access
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-white/70 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading plans...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* ── Tier 1: Personal ─────────────────────────────────────────── */}
            <div className={`bg-[#0d1610] border rounded-2xl overflow-hidden flex flex-col ${
              tier === "vpn" ? "border-primary/40 shadow-[0_0_40px_rgba(0,255,136,0.06)]" : "border-white/[0.07]"
            }`}>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-0.5">Tier 1</div>
                    <div className="text-base font-bold text-white">Personal</div>
                    <div className="text-[11px] text-white/50">Privacy + protection</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-primary/70" />
                  </div>
                </div>

                <PriceDisplay
                  cents={period === "monthly" ? personalMonthly : personalAnnual}
                  period={period === "monthly" ? "month" : "year"}
                />
                {period === "annual" ? (
                  <div className="text-primary/60 text-[11px] font-medium mt-1 mb-4">
                    ${(personalAnnual / 12 / 100).toFixed(2)}/mo · save {personalSave}% vs monthly
                  </div>
                ) : <div className="mb-4" />}

                <div className="text-white/60 text-[11px] mb-5 leading-relaxed">
                  Everything you need for personal privacy, ad blocking, and secure browsing on all your devices.
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {PERSONAL_FEATURES.map((f) => <FeatureRow key={f.text} text={f.text} />)}
                </ul>

                {tier === "vpn" ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/25 rounded-xl py-3 text-primary text-sm font-medium">
                    <Check className="w-4 h-4" /> Current Plan
                  </div>
                ) : tier === "command_center" ? (
                  <div className="w-full flex items-center justify-center bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 text-white/50 text-sm">
                    Included in your plan
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => personalPrice && checkout(personalPrice.id)}
                      disabled={!!checkingOut || !personalPrice}
                      className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                    >
                      {checkingOut === personalPrice?.id
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                        : <><Shield className="w-4 h-4" /> Get Personal</>
                      }
                    </button>
                    <button
                      onClick={() => openCrypto(period === "monthly" ? "vpn_monthly" : "vpn_annual", `Personal — ${period === "monthly" ? "Monthly" : "Annual"}`)}
                      className="w-full py-2 rounded-xl text-[11px] flex items-center justify-center gap-2 border border-orange-500/20 text-orange-400/70 hover:bg-orange-500/8 transition-all"
                    >
                      <Bitcoin className="w-3 h-3" /> Pay with Bitcoin/ETH
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tier 2: Power User ───────────────────────────────────────── */}
            <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col">
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-0.5">Tier 2</div>
                    <div className="text-base font-bold text-white">Power User</div>
                    <div className="text-[11px] text-white/50">Advanced + developer</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-blue-400/70" />
                  </div>
                </div>

                <div className="flex items-start mb-1">
                  <span className="text-white/70 text-base mt-1.5 mr-0.5">$</span>
                  <span className="text-5xl font-bold text-white leading-none">
                    {period === "monthly" ? "19" : "179"}
                  </span>
                  <span className="text-white/50 text-sm mt-auto pb-1 ml-1">/{period === "monthly" ? "month" : "year"}</span>
                </div>
                {period === "annual" ? (
                  <div className="text-blue-400/60 text-[11px] font-medium mt-1 mb-4">
                    $14.92/mo · save {savings(1999, 17900)}% vs monthly
                  </div>
                ) : <div className="mb-4" />}

                <div className="text-white/60 text-[11px] mb-4 leading-relaxed">
                  Everything in Personal, plus advanced routing, multiple identities, and developer-focused features.
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/50 mb-3">
                  <Check className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                  All Personal features included
                </div>

                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/40 mb-2">Power User additions</div>
                <ul className="space-y-2 mb-4 flex-1">
                  {(showPowerFeatures ? POWER_EXTRAS : POWER_EXTRAS.slice(0, 5)).map((f) => (
                    <FeatureRow key={f.text} text={f.text} dimmed />
                  ))}
                </ul>

                {POWER_EXTRAS.length > 5 && (
                  <button
                    onClick={() => setShowPowerFeatures(!showPowerFeatures)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-4"
                  >
                    {showPowerFeatures ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showPowerFeatures ? "Show less" : `+${POWER_EXTRAS.length - 5} more features`}
                  </button>
                )}

                <ContactSalesBtn label="Contact Sales" />
              </div>
            </div>

            {/* ── Tier 3: Professional ─────────────────────────────────────── */}
            <div className={`bg-[#0d1610] border rounded-2xl overflow-hidden flex flex-col relative ${
              tier === "command_center"
                ? "border-primary/40 shadow-[0_0_50px_rgba(0,255,136,0.07)]"
                : "border-primary/25 shadow-[0_0_40px_rgba(0,255,136,0.04)]"
            }`}>
              <div className="bg-gradient-to-r from-primary to-primary/70 text-black text-center text-[10px] font-bold tracking-widest py-1.5">
                SECURITY TOOLKIT — BEST VALUE
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Tier 3</div>
                    <div className="text-base font-bold text-white">Professional</div>
                    <div className="text-[11px] text-white/50">Security research + ops</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <ScanSearch className="w-4 h-4 text-primary/70" />
                  </div>
                </div>

                <PriceDisplay
                  cents={period === "monthly" ? proMonthly : proAnnual}
                  period={period === "monthly" ? "month" : "year"}
                />
                {period === "annual" ? (
                  <div className="text-primary/60 text-[11px] font-medium mt-1 mb-4">
                    ${(proAnnual / 12 / 100).toFixed(2)}/mo · save {proSave}% vs monthly
                  </div>
                ) : (
                  <div className="text-white/30 text-[11px] mt-1 mb-4">
                    Compare: Burp Suite Pro $475/yr · Shodan $69/mo
                  </div>
                )}

                <div className="text-white/60 text-[11px] mb-4 leading-relaxed">
                  Everything in Power User, plus the complete security research and penetration testing toolkit.
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/50 mb-3">
                  <Check className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                  All Personal + Power User features included
                </div>

                <div className="text-[10px] font-bold uppercase tracking-widest text-primary/40 mb-2">Professional additions</div>
                <ul className="space-y-2 mb-4 flex-1">
                  {(showProFeatures ? PROFESSIONAL_EXTRAS : PROFESSIONAL_EXTRAS.slice(0, 6)).map((f) => (
                    <FeatureRow key={f.text} text={f.text} dimmed />
                  ))}
                </ul>

                {PROFESSIONAL_EXTRAS.length > 6 && (
                  <button
                    onClick={() => setShowProFeatures(!showProFeatures)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-4"
                  >
                    {showProFeatures ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showProFeatures ? "Show less" : `+${PROFESSIONAL_EXTRAS.length - 6} more features`}
                  </button>
                )}

                {tier === "command_center" ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/25 rounded-xl py-3 text-primary text-sm font-medium">
                    <Check className="w-4 h-4" /> Current Plan
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => professionalPrice && checkout(professionalPrice.id)}
                      disabled={!!checkingOut || !professionalPrice}
                      className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-primary text-black hover:brightness-110 transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(0,255,136,0.15)]"
                    >
                      {checkingOut === professionalPrice?.id
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                        : tier === "vpn"
                          ? <><ScanSearch className="w-4 h-4" /> Upgrade to Professional</>
                          : <><ScanSearch className="w-4 h-4" /> Get Professional</>
                      }
                    </button>
                    <button
                      onClick={() => openCrypto(period === "monthly" ? "pro_monthly" : "pro_annual", `Professional — ${period === "monthly" ? "Monthly" : "Annual"}`)}
                      className="w-full py-2 rounded-xl text-[11px] flex items-center justify-center gap-2 border border-orange-500/20 text-orange-400/70 hover:bg-orange-500/8 transition-all"
                    >
                      <Bitcoin className="w-3 h-3" /> Pay with Bitcoin/ETH
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Business + Enterprise ────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4 text-center">
          Business & Enterprise — Contact Sales
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Tier 4: Business */}
          <div className="bg-[#0d1610] border border-blue-500/20 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-7 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-0.5">Tier 4</div>
                  <div className="text-lg font-bold text-white">Business</div>
                  <div className="text-xs text-white/50 mt-0.5">SMBs · MSPs · IT teams</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-400/70" />
                </div>
              </div>

              <div className="mb-1">
                <span className="text-3xl font-bold text-white">$12–15</span>
                <span className="text-white/50 text-sm ml-1">/user/month</span>
              </div>
              <div className="text-blue-400/60 text-[11px] font-medium mb-5">10-user minimum · ~$150/mo to start</div>

              <div className="text-white/60 text-xs mb-5 leading-relaxed">
                Everything in Professional, plus team management, RBAC, device inventory, compliance reporting, and centralized security dashboards for your entire organization.
              </div>

              <div className="flex items-center gap-2 text-xs text-white/50 mb-3">
                <Check className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                All Personal + Power User + Professional features included
              </div>

              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/40 mb-2.5">Business additions</div>
              <ul className="space-y-2 mb-6 flex-1">
                {BUSINESS_EXTRAS.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-blue-400" />
                    </div>
                    <span className="text-[12px] text-white/70 leading-relaxed">{f.text}</span>
                  </li>
                ))}
              </ul>

              <a
                href="mailto:alphaunlimitedtechnologies@gmail.com?subject=ProxhqVPN%20Business%20Inquiry"
                className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 hover:border-blue-500/50 transition-all"
              >
                <Mail className="w-4 h-4" /> Contact Sales for Business
              </a>
            </div>
          </div>

          {/* Tier 5: Enterprise */}
          <div className="bg-[#0d1610] border border-purple-500/25 rounded-2xl overflow-hidden flex flex-col relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/[0.03] to-transparent pointer-events-none" />
            <div className="p-7 flex flex-col flex-1 relative">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400/60 mb-0.5">Tier 5</div>
                  <div className="text-lg font-bold text-white">Enterprise</div>
                  <div className="text-xs text-white/50 mt-0.5">Corporations · Security teams</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-purple-400/70" />
                </div>
              </div>

              <div className="mb-1">
                <span className="text-3xl font-bold text-white">Custom</span>
              </div>
              <div className="text-purple-400/60 text-[11px] font-medium mb-5">$500–$5,000+/month · based on users & nodes</div>

              <div className="text-white/60 text-xs mb-5 leading-relaxed">
                Everything in Business, plus Zero Trust Network Access, full Command Center, Ghost Nodes, deception platform, SIEM integrations, and a dedicated account manager.
              </div>

              <div className="flex items-center gap-2 text-xs text-white/50 mb-3">
                <Check className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                All lower-tier features included
              </div>

              <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400/40 mb-2.5">Enterprise additions</div>
              <ul className="space-y-2 mb-6 flex-1">
                {ENTERPRISE_EXTRAS.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-purple-400" />
                    </div>
                    <span className="text-[12px] text-white/70 leading-relaxed">{f.text}</span>
                  </li>
                ))}
              </ul>

              <a
                href="mailto:alphaunlimitedtechnologies@gmail.com?subject=ProxhqVPN%20Enterprise%20Inquiry"
                className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 hover:border-purple-500/50 transition-all"
              >
                <Mail className="w-4 h-4" /> Contact Sales for Enterprise
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add-ons ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Firewall Add-On */}
        <div className="bg-[#0d1610] border border-orange-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-orange-400/70" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400/50 mb-0.5">Add-On</div>
              <div className="text-sm font-bold text-white">Firewall Suite</div>
            </div>
          </div>
          <p className="text-xs text-white/60 leading-relaxed mb-4">
            Full DPI-aware firewall with IPS engine, ATR (Adaptive Threat Response), GeoIP blocking, traffic decision tables, iptables export, and NodeSync hardening scripts.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              { label: "Personal", price: "+$4.99/mo" },
              { label: "Business", price: "+$5/user/mo" },
              { label: "Enterprise", price: "Included" },
            ].map(({ label, price }) => (
              <div key={label} className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-2.5">
                <div className="text-white/40 mb-1">{label}</div>
                <div className="text-orange-300 font-semibold">{price}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ContactSalesBtn label="Add Firewall Suite" />
          </div>
        </div>

        {/* Developer Tools */}
        <div className="bg-[#0d1610] border border-green-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <Code className="w-4 h-4 text-green-400/70" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-green-400/50 mb-0.5">Separate Product</div>
              <div className="text-sm font-bold text-white">ProxhqVPN Developer</div>
            </div>
          </div>
          <p className="text-xs text-white/60 leading-relaxed mb-4">
            API access, SDKs, node management APIs, automation APIs, and audit APIs. Build your own security workflows on the ProxhqVPN infrastructure — without the consumer VPN interface.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              { label: "Individual", price: "$49/mo" },
              { label: "Team", price: "$149/mo" },
              { label: "Enterprise", price: "Custom" },
            ].map(({ label, price }) => (
              <div key={label} className="bg-green-500/5 border border-green-500/15 rounded-xl p-2.5">
                <div className="text-white/40 mb-1">{label}</div>
                <div className="text-green-300 font-semibold">{price}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ContactSalesBtn label="Get Developer Access" />
          </div>
        </div>
      </div>

      {/* ── Tier comparison table ────────────────────────────────────────────── */}
      <div className="bg-[#0d1610] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06] text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Platform Architecture</div>
          <div className="text-base font-bold text-white">Personal · Professional · Enterprise</div>
          <div className="text-[11px] text-white/40 mt-1">Every tier is built on the same infrastructure — your plan unlocks layers.</div>
        </div>

        <div className="grid grid-cols-4 border-b border-white/[0.05]">
          <div className="px-4 py-3" />
          {[
            { label: "PERSONAL", sub: "Tier 1–2", color: "text-green-400", bg: "bg-green-500/[0.06] border-green-500/20" },
            { label: "PROFESSIONAL", sub: "Tier 3", color: "text-primary", bg: "bg-primary/[0.06] border-primary/20" },
            { label: "ENTERPRISE", sub: "Tier 5", color: "text-purple-400", bg: "bg-purple-500/[0.06] border-purple-500/20" },
          ].map((t) => (
            <div key={t.label} className={`px-3 py-3 border-l border-white/[0.05] text-center ${t.bg} border`}>
              <div className={`text-[9px] font-bold uppercase tracking-widest ${t.color} mb-0.5`}>{t.label}</div>
              <div className="text-[10px] text-white/40">{t.sub}</div>
            </div>
          ))}
        </div>

        {[
          { category: "🔒 VPN & Privacy", rows: [
            { feature: "WireGuard AES-256-GCM", t1: true, t3: true, t5: true },
            { feature: "Kill Switch + leak protection", t1: true, t3: true, t5: true },
            { feature: "DNS Shield (ad/tracker/malware)", t1: true, t3: true, t5: true },
            { feature: "Split tunneling & Smart DNS", t1: true, t3: true, t5: true },
            { feature: "Stealth obfuscation (obfs4, V2Ray…)", t1: true, t3: true, t5: true },
            { feature: "Port forwarding + multiple identities", t1: false, t3: true, t5: true },
            { feature: "Ghost Chain — 7-hop Tor routing", t1: false, t3: true, t5: true },
            { feature: "GPS Spoofing + Meshnet", t1: false, t3: true, t5: true },
          ]},
          { category: "🛡️ Security Research (Professional)", rows: [
            { feature: "Vulnerability Scanner (SQLMap + nmap)", t1: false, t3: true, t5: true },
            { feature: "HTTP Probe / Dir Fuzzer / Subdomain Scout", t1: false, t3: true, t5: true },
            { feature: "SAST / Dependency / WebSocket / OAST scanners", t1: false, t3: true, t5: true },
            { feature: "Threat Intelligence + OSINT Recon", t1: false, t3: true, t5: true },
            { feature: "SHA3-256 Audit Chain", t1: false, t3: true, t5: true },
            { feature: "SilkWeb Honeypot + Beacon Alerts", t1: false, t3: true, t5: true },
            { feature: "Security Audit (TLS / HTTP / WHOIS)", t1: false, t3: true, t5: true },
          ]},
          { category: "🏢 Business Management", rows: [
            { feature: "RBAC (6 roles)", t1: false, t3: false, t5: true },
            { feature: "Team user management", t1: false, t3: false, t5: true },
            { feature: "Device inventory (fleet-wide)", t1: false, t3: false, t5: true },
            { feature: "Compliance reporting", t1: false, t3: false, t5: true },
            { feature: "Centralized audit ledger", t1: false, t3: false, t5: true },
          ]},
          { category: "🔬 Enterprise & Command Center", rows: [
            { feature: "Zero Trust / ZTNA device posture", t1: false, t3: false, t5: true },
            { feature: "SIEM fanout (Splunk HEC + webhook)", t1: false, t3: false, t5: true },
            { feature: "Ghost Nodes — ephemeral exit VPS", t1: false, t3: false, t5: true },
            { feature: "Deception platform (Ghost Trap, Honeypot)", t1: false, t3: false, t5: true },
            { feature: "QuantumAudit + Signature Mining Engine", t1: false, t3: false, t5: true },
            { feature: "SSO / SAML + dedicated account manager", t1: false, t3: false, t5: true },
          ]},
        ].map(({ category, rows }) => (
          <div key={category}>
            <div className="px-4 py-2 bg-white/[0.02] border-y border-white/[0.04]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{category}</span>
            </div>
            {rows.map(({ feature, t1, t3, t5 }, ri) => (
              <div key={feature} className={`grid grid-cols-4 ${ri < rows.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <div className="px-4 py-2.5">
                  <span className="text-[12px] text-white/60">{feature}</span>
                </div>
                {[
                  { val: t1, color: "text-green-400",  bg: "bg-green-500/[0.06]"  },
                  { val: t3, color: "text-primary",     bg: "bg-primary/[0.06]"    },
                  { val: t5, color: "text-purple-400",  bg: "bg-purple-500/[0.06]" },
                ].map(({ val, color, bg }, ci) => (
                  <div key={ci} className={`border-l border-white/[0.05] flex items-center justify-center py-2.5 ${val ? bg : ""}`}>
                    {val
                      ? <Check className={`w-3.5 h-3.5 ${color}`} />
                      : <span className="text-white/12 text-base leading-none">—</span>
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        <div className="px-6 py-4 border-t border-white/[0.05] text-center">
          <span className="text-[10px] text-white/25">Business (Tier 4) has all Professional features + team management. Enterprise (Tier 5) has everything.</span>
        </div>
      </div>

      {/* Revenue example */}
      <div className="bg-[#0d1610] border border-white/[0.06] rounded-2xl p-6">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4 text-center">
          Industry Comparison
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { tool: "NordVPN / ExpressVPN", price: "$3–13/mo", tag: "consumer VPN only — no security tools" },
            { tool: "Burp Suite Pro", price: "$475/yr", tag: "HTTP proxy + scanner only, no VPN" },
            { tool: "Splunk Enterprise", price: "$2,000+/mo", tag: "SIEM only — no VPN or deception" },
            { tool: "ProxhqVPN Professional", price: "$39.99/mo", tag: "VPN + full security research toolkit", highlight: true },
          ].map((r) => (
            <div key={r.tool} className={`rounded-xl p-3.5 text-center ${
              r.highlight
                ? "bg-primary/8 border border-primary/20"
                : "bg-white/[0.02] border border-white/[0.05]"
            }`}>
              <div className={`text-sm font-bold mb-0.5 ${r.highlight ? "text-primary" : "text-white/80"}`}>
                {r.price}
              </div>
              <div className={`text-[11px] font-semibold mb-1 ${r.highlight ? "text-white/90" : "text-white/70"}`}>
                {r.tool}
              </div>
              <div className={`text-[10px] leading-snug ${r.highlight ? "text-primary/50" : "text-white/40"}`}>
                {r.tag}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guarantees */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { title: "No Logs",          body: "We never record your IP, browsing history, or traffic." },
          { title: "30-Day Guarantee", body: "Not satisfied? Full refund within 30 days of purchase." },
          { title: "Instant Access",   body: "Your VPN is live within 30 seconds of subscribing." },
        ].map((item) => (
          <div key={item.title} className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4 text-center">
            <div className="text-xs font-semibold text-white/88 mb-1">{item.title}</div>
            <div className="text-xs text-white/60 leading-relaxed">{item.body}</div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-white/40">
        All self-serve plans include a 30-day money-back guarantee. Cancel any time.{" "}
        <a href="mailto:alphaunlimitedtechnologies@gmail.com" className="text-primary/50 hover:text-primary transition-colors">
          Questions? Contact us →
        </a>
      </p>

      {/* ── Crypto Payment Modal ──────────────────────────────────────────────── */}
      {cryptoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0a0f0c] border border-orange-500/25 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-orange-500/15">
              <div className="flex items-center gap-2.5">
                <Bitcoin className="w-5 h-5 text-orange-400" />
                <div>
                  <div className="text-sm font-bold text-white">Anonymous Crypto Payment</div>
                  <div className="text-[11px] text-orange-400/70 font-mono">{cryptoModal.planLabel}</div>
                </div>
              </div>
              <button onClick={() => setCryptoModal(null)} className="text-white/40 hover:text-white/70 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {cryptoStatus === "confirmed" && (
                <div className="text-center space-y-3 py-4">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                  <div className="text-white font-bold text-lg">Payment Confirmed!</div>
                  <div className="text-white/60 text-sm">Your subscription is now active. You have full access.</div>
                  <button onClick={() => { setCryptoModal(null); window.location.reload(); }}
                    className="mt-4 px-6 py-2.5 bg-primary text-black rounded-xl font-semibold text-sm hover:brightness-110 transition-all">
                    Continue to Dashboard
                  </button>
                </div>
              )}

              {cryptoStatus === "expired" && (
                <div className="text-center space-y-3 py-4">
                  <Clock className="w-10 h-10 text-red-400 mx-auto" />
                  <div className="text-white font-bold">Invoice Expired</div>
                  <div className="text-white/60 text-sm">The 2-hour payment window has closed. Create a new invoice to try again.</div>
                  <button onClick={() => { setCryptoInvoice(null); setCryptoStatus("idle"); }}
                    className="mt-2 px-5 py-2 border border-orange-500/30 text-orange-400 rounded-xl text-sm hover:bg-orange-500/10 transition-all">
                    Create New Invoice
                  </button>
                </div>
              )}

              {cryptoStatus === "idle" && (
                <div className="space-y-4">
                  <div className="text-xs text-white/60 leading-relaxed">
                    Pay anonymously — no name, no email, no card required. Your blockchain transaction activates access automatically.
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Select currency</div>
                    <div className="grid grid-cols-2 gap-3">
                      {(["BTC", "ETH"] as const).map((c) => (
                        <button key={c} onClick={() => setCryptoCurrency(c)}
                          className={`p-4 rounded-xl border text-sm font-bold transition-all flex flex-col items-center gap-1.5 ${
                            cryptoCurrency === c
                              ? "bg-orange-500/15 border-orange-500/50 text-orange-300"
                              : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-orange-500/30"
                          }`}>
                          <Bitcoin className="w-5 h-5" />
                          {c}
                          <span className="text-[10px] font-normal text-white/40">
                            {c === "BTC" ? "Bitcoin · ~10 min" : "Ethereum · ~30 sec"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-3 space-y-1">
                    <div className="text-[10px] text-orange-400/70 font-mono uppercase tracking-widest">Privacy note</div>
                    <div className="text-[11px] text-white/60 leading-relaxed">
                      A unique exact amount is generated per invoice — this fingerprints your payment on-chain.
                      For maximum anonymity, send from a non-KYC wallet or use a mixing service first.
                    </div>
                  </div>
                  <button
                    onClick={() => createCryptoInvoice(cryptoModal.plan, cryptoCurrency)}
                    className="w-full py-3 rounded-xl bg-orange-500 text-black font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Bitcoin className="w-4 h-4" /> Generate {cryptoCurrency} Invoice
                  </button>
                </div>
              )}

              {cryptoStatus === "creating" && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  <div className="text-white/60 text-sm">Fetching exchange rate and generating address...</div>
                </div>
              )}

              {cryptoStatus === "awaiting" && cryptoInvoice && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Checking blockchain every 15 seconds...
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-mono font-bold ${countdown < 300 ? "text-red-400" : "text-white/50"}`}>
                      <Clock className="w-3 h-3" />
                      {fmtCountdown(countdown)}
                    </div>
                  </div>

                  <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-white/40 font-mono uppercase">Send exact amount</div>
                      <div className="text-[10px] text-white/30 font-mono">≈ ${cryptoInvoice.amountUsd} USD</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-orange-300 text-lg font-bold flex-1 break-all">
                        {cryptoInvoice.amountCrypto} {cryptoInvoice.currency}
                      </div>
                      <button onClick={() => copyText(cryptoInvoice.amountCrypto, "amount")}
                        className="shrink-0 p-1.5 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
                        {copied === "amount" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4 space-y-2">
                    <div className="text-[10px] text-white/40 font-mono uppercase">To address</div>
                    <div className="flex items-start gap-2">
                      <div className="font-mono text-white/80 text-[11px] flex-1 break-all leading-relaxed">
                        {cryptoInvoice.address}
                      </div>
                      <button onClick={() => copyText(cryptoInvoice.address, "address")}
                        className="shrink-0 p-1.5 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition-all mt-0.5">
                        {copied === "address" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <a href={cryptoInvoice.uriScheme}
                      className="inline-flex items-center gap-1.5 text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors font-mono mt-1">
                      <Bitcoin className="w-3 h-3" /> Open in wallet app ↗
                    </a>
                  </div>

                  <div className="space-y-1.5">
                    {cryptoInvoice.instructions?.map((inst: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] text-white/50 font-mono">
                        <span className="text-orange-500/50 shrink-0">{i + 1}.</span>
                        <span>{inst}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-white/30 text-center font-mono">
                    Exchange rate: 1 {cryptoInvoice.currency} = ${parseFloat(cryptoInvoice.exchangeRate).toLocaleString()} USD
                  </div>
                </div>
              )}

              {cryptoStatus === "error" && (
                <div className="text-center space-y-4 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <div className="text-white font-bold">Payment Error</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-left">
                    <div className="text-[11px] text-red-300/80 font-mono break-all">{cryptoError}</div>
                  </div>
                  <button onClick={() => { setCryptoInvoice(null); setCryptoStatus("idle"); setCryptoError(""); }}
                    className="px-5 py-2 border border-orange-500/30 text-orange-400 rounded-xl text-sm hover:bg-orange-500/10 transition-all">
                    Try Again
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
