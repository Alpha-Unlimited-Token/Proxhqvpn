import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Shield, Zap, Lock, Globe, Eye, Network, Check, ChevronDown, ChevronUp,
  ArrowRight, Menu, X, Wifi, Server, Clock, Star, Bug, AlertTriangle
} from "lucide-react";

const BASE_API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "WireGuard Protocol",
    desc: "The fastest, most modern VPN protocol available. Up to 3x faster than OpenVPN with a fraction of the code surface — meaning fewer vulnerabilities and lower latency on every connection.",
  },
  {
    icon: Shield,
    title: "AES-256-GCM Encryption",
    desc: "Every packet is encrypted with military-grade AES-256-GCM. The same standard used by governments and intelligence agencies worldwide.",
  },
  {
    icon: Network,
    title: "Double-Hop Anonymity",
    desc: "Route your traffic through two separate servers in two different countries. Websites see the second server — not your IP, not our server.",
  },
  {
    icon: Lock,
    title: "Kill Switch",
    desc: "If your VPN drops for any reason, the kill switch instantly cuts your internet — so your real IP never leaks, even for a millisecond.",
  },
  {
    icon: Eye,
    title: "DNS Leak Protection",
    desc: "All DNS queries are encrypted and routed through our servers. Your ISP cannot see what sites you visit. WebRTC leaks are blocked at the source.",
  },
  {
    icon: Globe,
    title: "Split Tunneling",
    desc: "Choose exactly which apps or websites go through the VPN. Stream local content and use your VPN simultaneously without any performance hit.",
  },
  {
    icon: Server,
    title: "Auto Peer Registration",
    desc: "When you connect, your unique WireGuard key is automatically pushed to our server. No config files to edit, no commands to run. It just works.",
  },
  {
    icon: Wifi,
    title: "SilkWeb Threat Defense",
    desc: "Our proprietary honeypot mesh detects and fingerprints anyone probing your tunnel — hackers, bots, and port scanners get identified and blocked in real time.",
  },
];

const SECURITY = [
  { title: "Zero Logs", body: "We don't log your IP, connection timestamps, DNS queries, or any browsing activity. There is nothing to hand over — because we don't have it." },
  { title: "Own Your Infrastructure", body: "ProxhqVPN runs on your dedicated server. Your traffic never touches a shared data center owned by a corporation you don't control." },
  { title: "Open Protocol", body: "WireGuard is fully open-source and audited by independent security researchers. No proprietary black boxes handling your data." },
  { title: "Beacon Intrusion Detection", body: "Real-time monitoring of your VPN node detects port scans, tunnel probes, and hostile actors — and alerts you the moment they appear." },
  { title: "Traffic Obfuscation", body: "Make your VPN traffic look like normal HTTPS. Bypass deep packet inspection used by ISPs, corporations, and restrictive governments." },
  { title: "Automatic IP Blocking", body: "One click blocks any attacking IP at the firewall level across your entire infrastructure. No SSH, no command line, no delay." },
];

const PRICING_PLANS = [
  {
    name: "Monthly",
    price: "$9.99",
    period: "/month",
    desc: "Cancel any time. No commitment.",
    highlight: false,
    badge: null,
  },
  {
    name: "Annual",
    price: "$69.99",
    period: "/year",
    sub: "Just $5.83/mo — save 42%",
    desc: "Most popular. Best value for regular users.",
    highlight: true,
    badge: "MOST POPULAR",
  },
  {
    name: "Lifetime",
    price: "$149.99",
    period: "one-time",
    desc: "Pay once, protected forever. No renewals.",
    highlight: false,
    badge: "BEST DEAL",
  },
];

const PLAN_FEATURES = [
  "WireGuard AES-256 encryption",
  "Unlimited devices",
  "Kill switch & DNS protection",
  "Double-hop routing",
  "Threat detection & alerts",
  "SilkWeb intrusion defense",
  "No logs policy",
  "30-day money-back guarantee",
];

const FAQS = [
  {
    q: "What is ProxhqVPN?",
    a: "ProxhqVPN is a self-hosted VPN service built by ALPHA UNLIMITED TECHNOLOGIES LLC. Instead of routing your traffic through a shared data center like NordVPN or ExpressVPN, your connection runs through a dedicated private server — giving you maximum control, privacy, and performance.",
  },
  {
    q: "Do you keep any logs?",
    a: "No. We do not log your IP address, DNS queries, browsing history, connection timestamps, or any traffic data. Our system is designed from the ground up to have nothing to hand over — because we never collect it.",
  },
  {
    q: "How fast is ProxhqVPN?",
    a: "ProxhqVPN uses WireGuard, the fastest VPN protocol available. In real-world testing, WireGuard is up to 3x faster than OpenVPN and significantly faster than IKEv2. Most users see speeds within 10-15% of their base internet connection.",
  },
  {
    q: "How does setup work?",
    a: "Sign up, click Connect, and your personal WireGuard tunnel is automatically configured on our server within 30 seconds. Download your config file, import it into the free WireGuard app on any device, and you're connected. No technical knowledge required.",
  },
  {
    q: "How many devices can I use?",
    a: "All plans include unlimited simultaneous device connections. Connect your phone, laptop, tablet, and router all at the same time — no extra charge.",
  },
  {
    q: "What is the double-hop feature?",
    a: "Double-hop routes your traffic through two VPN servers instead of one. Websites see the second server's IP. Even if someone monitored the first server, they'd only see encrypted traffic going to a second VPN — never your activity.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes. All plans come with a 30-day money-back guarantee. If you're not satisfied for any reason, contact us within 30 days for a full refund — no questions asked.",
  },
  {
    q: "What is the Lifetime plan?",
    a: "The Lifetime plan is a single one-time payment of $149.99 that gives you permanent access to ProxhqVPN with no recurring charges, ever. It's the best deal for long-term users.",
  },
];

function NavBar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const id = href.replace("#", "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#080d09]/95 backdrop-blur border-b border-white/[0.06] shadow-lg" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => scrollTo("#home")} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <img src={`${BASE}/icon-final2.png`} alt="" className="w-5 h-5" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <span className="text-base font-bold text-white group-hover:text-primary transition-colors">ProxhqVPN</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => scrollTo(href)}
              className="px-4 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/[0.05] transition-all"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/sign-in" className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up" className="px-4 py-2 text-sm font-semibold bg-primary text-black rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]">
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden bg-[#080d09]/98 border-t border-white/[0.06] px-6 py-4 space-y-1">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => scrollTo(href)}
              className="block w-full text-left px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all"
            >
              {label}
            </button>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link href="/sign-in" className="block text-center py-3 text-sm text-white/70 border border-white/[0.1] rounded-xl hover:border-white/20 transition-all">
              Sign In
            </Link>
            <Link href="/sign-up" className="block text-center py-3 text-sm font-semibold bg-primary text-black rounded-xl hover:brightness-110 transition-all">
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.07] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm font-medium text-white/90 pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-white/50 leading-relaxed border-t border-white/[0.05]">
          <div className="pt-4">{a}</div>
        </div>
      )}
    </div>
  );
}

const NODE_LOCATIONS = [
  { city: "Chicago",        country: "USA",    flag: "🇺🇸", latency: "12ms",  status: "online" },
  { city: "London",         country: "UK",     flag: "🇬🇧", latency: "18ms",  status: "online" },
  { city: "Los Angeles",    country: "USA",    flag: "🇺🇸", latency: "22ms",  status: "online" },
  { city: "Tokyo",          country: "Japan",  flag: "🇯🇵", latency: "38ms",  status: "online" },
];

function useLiveStats() {
  const [stats, setStats] = useState<{
    activeNodes: number; trappedAttackers: number; silkRoutes: number;
    honeypotNodes: number; sqlmapJobs: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${BASE_API}/silkweb/stats`);
        if (r.ok) setStats(await r.json());
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return stats;
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const liveStats = useLiveStats();

  return (
    <div className="min-h-screen bg-[#080d09] text-white">
      <NavBar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* ── HERO ── */}
      <section id="home" className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">
              4 Nodes Online — Chicago · London · LA · Tokyo
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            Privacy you{" "}
            <span className="text-primary drop-shadow-[0_0_30px_rgba(0,255,136,0.4)]">actually</span>
            <br />own.
          </h1>

          <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            ProxhqVPN uses WireGuard encryption, automatic peer registration, and real-time intrusion detection 
            to protect your privacy — without a shared data center or a corporation between you and your data.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 px-8 py-4 bg-primary text-black font-semibold rounded-2xl hover:brightness-110 transition-all shadow-[0_0_40px_rgba(0,255,136,0.25)] text-base"
            >
              Get Protected Now <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-4 border border-white/[0.1] text-white/70 hover:text-white hover:border-white/20 rounded-2xl transition-all text-base"
            >
              See Pricing
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {[
              { value: "4", label: "Global Nodes", live: false },
              { value: "4", label: "Honeypot Traps", live: false },
              { value: liveStats ? String(liveStats.trappedAttackers) : "—", label: "Attackers Trapped", live: true },
              { value: "< 30s", label: "Setup Time", live: false },
            ].map(({ value, label, live }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-4 relative overflow-hidden">
                {live && (
                  <div className="absolute top-1.5 right-2 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                    <span className="text-[8px] text-primary/50 uppercase tracking-widest">live</span>
                  </div>
                )}
                <div className="text-xl font-bold text-primary">{value}</div>
                <div className="text-xs text-white/35 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Everything Included</div>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Built different from day one.</h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto">
              Every feature you need to stay private, every tool to stay in control — all included in every plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 hover:border-primary/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVER LOCATIONS ── */}
      <section className="py-20 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Global Infrastructure</div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">4 dedicated nodes. All online.</h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Each node runs WireGuard, a honeypot spider, and a beacon intrusion sensor — all reporting live to your dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {NODE_LOCATIONS.map(({ city, country, flag, latency, status }) => (
              <div key={city} className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-5 hover:border-primary/20 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{flag}</span>
                  <span className="flex items-center gap-1 text-[10px] text-primary font-mono uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {status}
                  </span>
                </div>
                <div className="font-bold text-white">{city}</div>
                <div className="text-xs text-white/40 mb-3">{country}</div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1 text-primary/60">
                    <Zap className="w-3 h-3" /> {latency}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-400/60">
                    <AlertTriangle className="w-3 h-3" /> Honeypot
                  </span>
                  <span className="flex items-center gap-1 text-primary/60">
                    <Bug className="w-3 h-3" /> Spider
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Honeypot mesh banner */}
          <div className="bg-[#0d1610] border border-yellow-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
              <Bug className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="font-bold text-white mb-1">SilkWeb Honeypot Mesh</div>
              <p className="text-sm text-white/45">
                Every node runs a spider that emulates an open HTTP port — luring attackers in with a convincing fake server.
                When they connect, they're silently fingerprinted and trapped in the SilkWeb decoy network. 
                As the owner, you can then launch a full SQL injection scan against the trapped attacker's IP directly from your dashboard.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-yellow-400">{liveStats ? liveStats.trappedAttackers : "—"}</div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest">Trapped</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-primary">{liveStats ? liveStats.silkRoutes : "—"}</div>
                <div className="text-[10px] text-white/35 uppercase tracking-widest">Web Routes</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section id="security" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Security First</div>
              <h2 className="text-4xl font-bold tracking-tight mb-6">
                We built ProxhqVPN so there's nothing to compromise.
              </h2>
              <p className="text-white/45 text-base leading-relaxed mb-8">
                Most VPN providers store connection logs "for troubleshooting." We don't. Your server, your data, your rules. 
                If we don't have it, nobody can get it — not hackers, not subpoenas, not anyone.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black font-semibold rounded-xl hover:brightness-110 transition-all text-sm"
              >
                Start Protected <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECURITY.map(({ title, body }) => (
                <div key={title} className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-5 hover:border-primary/15 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-white">{title}</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Simple Pricing</div>
            <h2 className="text-4xl font-bold tracking-tight mb-4">One plan. All features. Pick your term.</h2>
            <p className="text-white/40 text-lg">No tiers, no limits, no surprises. Every plan includes everything.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {PRICING_PLANS.map(({ name, price, period, sub, desc, highlight, badge }) => (
              <div
                key={name}
                className={`relative rounded-2xl overflow-hidden border transition-all ${
                  highlight
                    ? "border-primary/50 shadow-[0_0_40px_rgba(0,255,136,0.08)]"
                    : "border-white/[0.07]"
                } bg-[#0d1610]`}
              >
                {badge && (
                  <div className={`text-center text-xs font-bold tracking-widest py-2 ${
                    highlight ? "bg-primary text-black" : "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
                  }`}>
                    {badge}
                  </div>
                )}
                <div className="p-8">
                  <div className="text-sm font-semibold text-white/60 mb-4">{name}</div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-white">{price}</span>
                    <span className="text-white/40 text-sm pb-1">{period}</span>
                  </div>
                  {sub && <div className="text-primary text-sm font-medium mb-3">{sub}</div>}
                  <p className="text-white/40 text-xs mb-6 leading-relaxed">{desc}</p>
                  <Link
                    href="/sign-up"
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                      highlight
                        ? "bg-primary text-black hover:brightness-110 shadow-[0_0_20px_rgba(0,255,136,0.2)]"
                        : "border border-white/[0.1] text-white hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Plan features list */}
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-8">
            <div className="text-sm font-semibold text-white/60 mb-6 text-center">All plans include every feature</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PLAN_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs text-white/55">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL STRIP ── */}
      <section className="py-16 px-6 border-t border-white/[0.05] bg-[#0a0f0b]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
          </div>
          <blockquote className="text-lg text-white/70 italic leading-relaxed max-w-2xl mx-auto mb-4">
            "Finally a VPN that gives me real control. Setup took less than a minute, and knowing my traffic runs on my own server — not some shared data center — makes all the difference."
          </blockquote>
          <div className="text-sm text-white/30">— ProxhqVPN subscriber</div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Got Questions?</div>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Ready to take back your privacy?
          </h2>
          <p className="text-white/40 text-lg mb-8 leading-relaxed">
            Set up your personal VPN in under 60 seconds. 30-day money-back guarantee on all plans.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-10 py-4 bg-primary text-black font-bold rounded-2xl hover:brightness-110 transition-all shadow-[0_0_40px_rgba(0,255,136,0.3)] text-base"
          >
            Start Free Today <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="text-white/25 text-sm mt-4">No credit card required to sign up · Cancel any time</div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.05] px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-bold text-white">ProxhqVPN</span>
              <span className="text-white/20 text-xs ml-1">by ALPHA UNLIMITED TECHNOLOGIES LLC</span>
            </div>
            <div className="flex items-center gap-6">
              {NAV_LINKS.map(({ label, href }) => (
                <button
                  key={label}
                  onClick={() => document.getElementById(href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" })}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-xs text-white/20">
              © {new Date().getFullYear()} All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
