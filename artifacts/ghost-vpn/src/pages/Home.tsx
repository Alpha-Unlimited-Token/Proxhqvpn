// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import {
  Shield, Zap, Lock, Globe, Eye, Network, Check, ChevronDown, ChevronUp,
  ArrowRight, Menu, X, Wifi, Server, Clock, Star, Bug, AlertTriangle,
  MapPin, Share2, Database, Code2, KeyRound, Swords, ShieldCheck,
  Terminal, Fingerprint, FlaskConical, ScanSearch, Layers, Bell,
  GitMerge, FileCode2, Filter, Crosshair, Package, Search, FileText, Radio,
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
  {
    icon: MapPin,
    title: "GPS Location Spoofing",
    desc: "Broadcast fake GPS coordinates on any device without leaving your real location. Built-in preset locations and custom lat/lng support — essential for mobile privacy and location-based geo-unblocking.",
  },
  {
    icon: Share2,
    title: "Meshnet Peer Networking",
    desc: "Create private encrypted peer-to-peer networks between your own devices. Direct WireGuard tunnels between peers — no central relay, no external routing, no data leaving your control.",
  },
  {
    icon: Database,
    title: "Data Broker Opt-Out",
    desc: "Scan and remove your personal information from 200+ data brokers, people-search engines, and marketing databases with automated opt-out requests and real-time verification tracking.",
  },
  {
    icon: Code2,
    title: "Developer Security Suite",
    desc: "Command Center Pro adds OAST injection testing, dependency vulnerability scanning, JWT/API token sequence analysis, WebSocket security testing, and static code analysis — professional pentest tools in one platform.",
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
    name: "VPN Basic",
    price: "$6.99",
    period: "/month",
    annual: "$59.99/yr",
    annualNote: "Save 29% with annual",
    desc: "Full privacy protection for everyday users.",
    highlight: false,
    badge: null,
    features: [
      "WireGuard AES-256 encryption",
      "Kill switch & DNS leak protection",
      "Double-hop routing",
      "Split tunneling & Smart DNS",
      "SilkWeb threat detection",
      "GPS location spoofing",
      "Port forwarding",
      "Dedicated IP address",
      "Meshnet peer networking",
      "Data broker opt-out scanner",
      "Unlimited devices",
      "No logs policy",
      "30-day money-back guarantee",
    ],
  },
  {
    name: "Command Center Pro",
    price: "$39.99",
    period: "/month",
    annual: "$349.99/yr",
    annualNote: "Save 27% with annual",
    desc: "Advanced security suite for power users and professionals.",
    highlight: true,
    badge: "MOST POPULAR",
    features: [
      "Everything in VPN Basic",
      "Alpha Toolkit (35+ languages, 200+ vuln patterns)",
      "SQLmap vulnerability scanner",
      "HTTP probe & directory fuzzer",
      "Subdomain Scout & Intruder",
      "Ghost Chain Exploit Arsenal",
      "Exploit Importer + 24 vuln guides",
      "OSINT Recon Engine (15+ sources)",
      "OAST injection tester",
      "Dependency vulnerability scanner",
      "JWT / API token sequence analyzer",
      "WebSocket security tester",
      "Static code analysis (SAST)",
      "WAF Analyzer & bypass testing",
      "SIEM, Canary Tokens, Threat Intel",
      "SilkWeb honeypot + Firewall Manager",
    ],
  },
];

const PLAN_FEATURES = [
  "WireGuard AES-256 encryption",
  "Unlimited devices",
  "Kill switch & DNS protection",
  "Double-hop routing",
  "GPS location spoofing",
  "Port forwarding",
  "Dedicated IP address",
  "Meshnet peer networking",
  "Data broker opt-out scanner",
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
    q: "What is the difference between VPN Basic and Command Center Pro?",
    a: "VPN Basic ($6.99/mo) gives you full privacy protection — WireGuard encryption, kill switch, DNS shield, double-hop routing, split tunneling, GPS spoofing, port forwarding, dedicated IP, meshnet networking, and data broker opt-out scanning. Command Center Pro ($39.99/mo) adds the full professional security suite: Alpha Toolkit, SQLmap, HTTP Probe, Directory Fuzzer, Subdomain Scout, Ghost Chain Exploit Arsenal, Exploit Importer (24 step-by-step vuln guides), OSINT Recon, OAST injection tester, dependency vulnerability scanner, JWT/API token sequence analyzer, WebSocket security tester, SAST static code analysis, WAF Analyzer, SIEM, Canary Tokens, and SilkWeb honeypot control — everything a security researcher, pentester, or developer needs.",
  },
];

// ── Ambassador section (public, no auth required) ─────────────────────────────
interface AmbHit { id: number; name: string; bio: string | null; promoCode: string; avatarUrl: string | null; videos: { title: string; embedUrl: string | null }[] }

function AmbassadorsSection() {
  const [ambs, setAmbs] = useState<AmbHit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BASE_API}/ambassadors`)
      .then(r => r.json())
      .then(d => setAmbs(Array.isArray(d) ? d.slice(0, 4) : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section className="py-24 px-6 border-t border-white/[0.05] bg-[#080d09]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Ambassador Community</div>
            <h2 className="text-4xl font-bold tracking-tight mb-3">Learn from real users</h2>
            <p className="text-white/78 text-base leading-relaxed max-w-xl">
              Our ambassadors create free YouTube tutorials for every platform. Watch a setup guide, use their promo code at checkout, and they earn 10% — no extra cost to you.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/ambassadors"
              className="px-5 py-2.5 text-sm font-semibold border border-white/[0.12] text-white/88 hover:border-white/25 hover:text-white rounded-xl transition-all">
              Browse All
            </Link>
            <Link href="/sign-up"
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-black rounded-xl hover:brightness-110 transition-all">
              Become an Ambassador →
            </Link>
          </div>
        </div>

        {loaded && ambs.length === 0 ? (
          /* No ambassadors yet — show the program pitch */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Upload to YouTube", body: "Record a setup tutorial for any platform — Windows, Fire Stick, Android, router. Upload to your YouTube channel." },
              { step: "02", title: "Add Your Link", body: "Paste your YouTube video URL into your ambassador profile. It embeds directly on our website for all visitors to watch." },
              { step: "03", title: "Earn 10% Forever", body: "Every subscriber who uses your promo code at checkout earns you 10% recurring commission for the life of their subscription." },
            ].map(({ step, title, body }) => (
              <div key={step} className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 hover:border-primary/20 transition-all">
                <div className="text-3xl font-black text-primary/15 mb-4 font-mono">{step}</div>
                <div className="font-semibold text-white mb-2">{title}</div>
                <p className="text-sm text-white/78 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        ) : (
          /* Featured ambassadors with YouTube thumbnails */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ambs.map(a => {
              const vid = a.videos[0];
              const ytId = vid?.embedUrl?.match(/embed\/([^?]+)/)?.[1];
              const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
              return (
                <Link key={a.id} href="/ambassadors"
                  className="group bg-[#0d1610] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-primary/25 transition-all">
                  {/* Video thumbnail */}
                  <div className="relative aspect-video bg-black/60 overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt={vid?.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-primary/40 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
                        <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {a.avatarUrl ? (
                        <img src={a.avatarUrl} alt={a.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[9px] font-bold text-primary">
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-white">{a.name}</span>
                    </div>
                    {a.bio && <p className="text-xs text-white/78 leading-relaxed line-clamp-2 mb-3">{a.bio}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-primary/60 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">{a.promoCode}</span>
                      <span className="text-[10px] text-white/70">{a.videos.length} tutorial{a.videos.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Commission badge */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-3 border border-primary/15 rounded-2xl px-6 py-4 bg-primary/5">
            <div className="text-3xl font-black text-primary">10%</div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Commission on every referral</div>
              <div className="text-xs text-white/78">Recurring — paid every billing cycle</div>
            </div>
          </div>
          <div className="text-white/70 text-sm">+</div>
          <div className="border border-white/[0.07] rounded-2xl px-6 py-4 bg-[#0d1610]">
            <div className="text-sm font-semibold text-white mb-0.5">Free to join</div>
            <div className="text-xs text-white/78">No fees. No minimums. Just sign up and start.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
              className="px-4 py-2 text-sm text-white/88 hover:text-white rounded-lg hover:bg-white/[0.05] transition-all"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/sign-in" className="px-4 py-2 text-sm text-white/88 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up" className="px-4 py-2 text-sm font-semibold bg-primary text-black rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]">
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/88 hover:text-white hover:bg-white/[0.06] transition-all"
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
              className="block w-full text-left px-4 py-3 text-sm text-white/88 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all"
            >
              {label}
            </button>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link href="/sign-in" className="block text-center py-3 text-sm text-white/88 border border-white/[0.1] rounded-xl hover:border-white/20 transition-all">
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
        <span className="text-sm font-medium text-white/97 pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-white/78 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/78 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-white/83 leading-relaxed border-t border-white/[0.05]">
          <div className="pt-4">{a}</div>
        </div>
      )}
    </div>
  );
}

const NODE_LOCATIONS = [
  { city: "Chicago",        country: "USA",    flag: "🇺🇸", latency: "12ms",  status: "online" },
  { city: "Los Angeles",    country: "USA",    flag: "🇺🇸", latency: "22ms",  status: "online" },
  { city: "Tokyo",          country: "Japan",  flag: "🇯🇵", latency: "38ms",  status: "online" },
  { city: "Seattle",        country: "USA",    flag: "🇺🇸", latency: "18ms",  status: "online" },
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

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#080d09] text-white">
      <PageSEO
        title="ProxhqVPN — Self-Hosted WireGuard VPN with Double-Hop & Tor Ghost Chain"
        description="Military-grade self-hosted VPN. WireGuard + AES-256-GCM encryption, double-hop anonymity, SilkWeb honeypot protection, and Tor Ghost Chain routing. From $6.99/month. By ALPHA UNLIMITED TECHNOLOGIES LLC."
        path="/"
        schema={faqSchema}
      />
      <NavBar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* ── HERO ── */}
      <section id="home" className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-medium">
                4 Nodes Online — Chicago · LA · Tokyo · Seattle
              </span>
            </div>
            <div className="inline-flex items-center gap-2 bg-blue-400/10 border border-blue-400/25 rounded-full px-4 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-300 font-medium">New — Dark Web Monitor &amp; OmniStrike Now Live</span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            Privacy you{" "}
            <span className="text-primary drop-shadow-[0_0_30px_rgba(0,255,136,0.4)]">actually</span>
            <br />own.
          </h1>

          <p className="text-white/83 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            ProxhqVPN combines self-hosted WireGuard privacy, real-time intrusion defense, and a full
            professional security toolkit — so you protect yourself and strike back, all from one platform.
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
              className="px-8 py-4 border border-white/[0.1] text-white/88 hover:text-white hover:border-white/20 rounded-2xl transition-all text-base"
            >
              See Pricing
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {[
              { value: "4", label: "Global Nodes", live: false },
              { value: liveStats ? String(liveStats.honeypotNodes) : "—", label: "Honeypot Traps", live: true },
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
                <div className="text-xs text-white/78 mt-0.5">{label}</div>
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
            <p className="text-white/78 text-lg max-w-2xl mx-auto">
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
                <p className="text-xs text-white/78 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT'S NEW PROMO STRIP ── */}
      <section className="py-16 px-6 border-t border-white/[0.05] bg-gradient-to-b from-[#080d09] to-[#0a1210]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <div className="flex items-center gap-2 bg-blue-400/10 border border-blue-400/20 rounded-full px-4 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] text-blue-300 font-semibold uppercase tracking-widest">Recently Added</span>
            </div>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Dark Web Monitor */}
            <Link href="/sign-up" className="group bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 hover:border-primary/25 hover:shadow-[0_0_30px_rgba(0,255,136,0.06)] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <KeyRound className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/25 rounded-full px-2.5 py-1">Free + Pro</span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">Dark Web Monitor</h3>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                Check any password against billions of breached credentials for free — no account needed.
                Upgrade to scan email addresses across 700+ data breaches and enable continuous monitoring.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary/70 group-hover:text-primary transition-colors font-medium">
                Try it free <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* OmniStrike */}
            <Link href="/sign-up" className="group bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 hover:border-red-400/25 hover:shadow-[0_0_30px_rgba(248,113,113,0.05)] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center group-hover:bg-red-400/15 transition-colors">
                  <Swords className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest bg-red-400/10 text-red-400 border border-red-400/20 rounded-full px-2.5 py-1">Command Center</span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">OmniStrike</h3>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                Multi-vector offensive security platform built for penetration testers. Orchestrate exploit chains,
                manage payloads, and coordinate attacks across your full target surface from a single panel.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-red-400/70 group-hover:text-red-400 transition-colors font-medium">
                Unlock with Command Center <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Developer Suite */}
            <Link href="/sign-up" className="group bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 hover:border-yellow-400/25 hover:shadow-[0_0_30px_rgba(250,204,21,0.04)] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center group-hover:bg-yellow-400/15 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded-full px-2.5 py-1">5 New Tools</span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">Developer Security Suite</h3>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                Five new tools just landed: OAST blind injection tester, dependency vulnerability scanner,
                JWT token sequence analyzer, WebSocket security tester, and SAST static code analysis.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-yellow-400/70 group-hover:text-yellow-400 transition-colors font-medium">
                Explore the suite <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SERVER LOCATIONS ── */}
      <section className="py-20 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Global Infrastructure</div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">4 dedicated nodes. All online.</h2>
            <p className="text-white/78 max-w-xl mx-auto">
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
                <div className="text-xs text-white/78 mb-3">{country}</div>
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

          {/* Ghost Trap — How It Works */}
          <div className="bg-[#0d1610] border border-yellow-500/20 rounded-2xl overflow-hidden">
            {/* Banner header */}
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 border-b border-yellow-500/10">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <Bug className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="font-bold text-white mb-1">Ghost Trap — Active Counter-Intelligence</div>
                <p className="text-sm text-white/60">
                  Every ProxhqVPN node runs a honeypot that silently lures, fingerprints, and traps attackers —
                  feeding them poisoned data while tracking their real identity through the VPN layers.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">{liveStats ? liveStats.trappedAttackers : "—"}</div>
                  <div className="text-[10px] text-white/50 uppercase tracking-widest">Trapped</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{liveStats ? liveStats.silkRoutes : "—"}</div>
                  <div className="text-[10px] text-white/50 uppercase tracking-widest">Web Routes</div>
                </div>
              </div>
            </div>

            {/* How It Works — 7-stage flow */}
            <div className="p-6">
              <div className="text-xs font-semibold text-yellow-400/60 uppercase tracking-widest mb-5">How Ghost Trap Combats Hackers</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {[
                  {
                    step: "01",
                    color: "text-red-400",
                    bg: "bg-red-500/8",
                    border: "border-red-500/20",
                    icon: <AlertTriangle className="w-4 h-4" />,
                    title: "Attacker Probes",
                    desc: "A hacker scans your node's ports or hits a common attack path (e.g. /admin, /.env, /login). Ghost Trap's lure endpoints are always listening and look exactly like a vulnerable server.",
                  },
                  {
                    step: "02",
                    color: "text-orange-400",
                    bg: "bg-orange-500/8",
                    border: "border-orange-500/20",
                    icon: <Clock className="w-4 h-4" />,
                    title: "Tarpit Delay",
                    desc: "The response is artificially slowed by 1.5–8 seconds per request. This wastes the attacker's time and scanner throughput while we silently log everything about their connection.",
                  },
                  {
                    step: "03",
                    color: "text-yellow-400",
                    bg: "bg-yellow-500/8",
                    border: "border-yellow-500/20",
                    icon: <Search className="w-4 h-4" />,
                    title: "Deep Fingerprinting",
                    desc: "IP address, source port, user agent, HTTP headers, attack vector payload, geo-location, ISP, ASN, and VPN/Tor detection are all captured and stored for every single probe.",
                  },
                  {
                    step: "04",
                    color: "text-primary",
                    bg: "bg-primary/8",
                    border: "border-primary/20",
                    icon: <FileText className="w-4 h-4" />,
                    title: "Poisoned Response",
                    desc: "The attacker receives convincing but entirely fake data — fake database credentials, fake admin panels, fake API keys — all laced with invisible tracking beacons that phone home.",
                  },
                ].map(({ step, color, bg, border, icon, title, desc }) => (
                  <div key={step} className={`rounded-xl border ${border} ${bg} p-4 space-y-2`}>
                    <div className={`flex items-center gap-2 ${color}`}>
                      {icon}
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{step}</span>
                    </div>
                    <div className={`text-sm font-semibold ${color}`}>{title}</div>
                    <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    step: "05",
                    color: "text-red-300",
                    bg: "bg-red-400/8",
                    border: "border-red-400/20",
                    icon: <Radio className="w-4 h-4" />,
                    title: "Beacon Fires",
                    desc: "When the attacker opens or uses the poisoned data, a tracking beacon fires back to us — confirming their live browser session, real device, and often their real IP behind the VPN.",
                  },
                  {
                    step: "06",
                    color: "text-purple-400",
                    bg: "bg-purple-500/8",
                    border: "border-purple-500/20",
                    icon: <Network className="w-4 h-4" />,
                    title: "Silk Web Trap",
                    desc: "After repeated probing, the attacker's IP is silently redirected into the SilkWeb decoy network — a maze of dead-end and collapse-zone routes that loop them endlessly, burning their resources while we gather more data.",
                  },
                  {
                    step: "07",
                    color: "text-cyan-400",
                    bg: "bg-cyan-500/8",
                    border: "border-cyan-500/20",
                    icon: <Shield className="w-4 h-4" />,
                    title: "Auto-Block + Report",
                    desc: "The IP is automatically added to your firewall block list. A full authority report is generated — containing every captured detail — ready to submit to ISPs, hosting providers, or law enforcement.",
                  },
                ].map(({ step, color, bg, border, icon, title, desc }) => (
                  <div key={step} className={`rounded-xl border ${border} ${bg} p-4 space-y-2`}>
                    <div className={`flex items-center gap-2 ${color}`}>
                      {icon}
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{step}</span>
                    </div>
                    <div className={`text-sm font-semibold ${color}`}>{title}</div>
                    <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                  </div>
                ))}
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
              <p className="text-white/83 text-base leading-relaxed mb-8">
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
                  <p className="text-xs text-white/78 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMAND CENTER PRO PROMO ── */}
      <section className="py-24 px-6 border-t border-white/[0.05] bg-[#080d09] relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/[0.04] via-transparent to-yellow-900/[0.03] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-red-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          {/* Header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-full px-4 py-1.5 mb-5">
              <Swords className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-300 font-semibold uppercase tracking-widest">Command Center Pro</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Not just a VPN.{" "}
              <span className="text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.3)]">A full security platform.</span>
            </h2>
            <p className="text-white/78 text-lg max-w-3xl mx-auto leading-relaxed">
              Command Center Pro gives developers, security researchers, and IT professionals a complete
              offensive and defensive toolkit built directly into their VPN. Test your own apps, audit
              client infrastructure, hunt vulnerabilities, and monitor for threats — all from one dashboard,
              protected by the same private tunnel you use every day.
            </p>
          </div>

          {/* Who it's for */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-14">
            {[
              { icon: Code2,       label: "Software Developers" },
              { icon: Globe,       label: "Web & App Builders" },
              { icon: Shield,      label: "Security Auditors" },
              { icon: Swords,      label: "Penetration Testers" },
              { icon: Terminal,    label: "DevOps & SysAdmins" },
              { icon: ShieldCheck, label: "Firewall Engineers" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 text-center hover:border-red-400/15 transition-all">
                <Icon className="w-5 h-5 text-red-400/70" />
                <span className="text-[10px] text-white/60 font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>

          {/* Tool categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {[
              {
                category: "Offensive Testing",
                color: "red",
                desc: "Professional-grade tools for ethical hacking and penetration testing.",
                tools: [
                  { icon: Swords,    name: "OmniStrike",        detail: "Multi-vector exploit orchestration" },
                  { icon: ScanSearch, name: "SQLmap Scanner",   detail: "Automated SQL injection & DB takeover" },
                  { icon: Bug,       name: "Directory Fuzzer",   detail: "Brute-force hidden paths & endpoints" },
                  { icon: Layers,    name: "Ghost Chain",        detail: "Chained exploit delivery arsenal" },
                ],
              },
              {
                category: "Recon & Intelligence",
                color: "orange",
                desc: "Map your target's full attack surface before a single packet is sent.",
                tools: [
                  { icon: Fingerprint, name: "OSINT Recon",     detail: "15+ source open-source intelligence" },
                  { icon: Globe,      name: "Subdomain Scout",   detail: "Automated subdomain enumeration" },
                  { icon: Eye,        name: "HTTP Probe",        detail: "Live endpoint fingerprinting" },
                  { icon: Database,   name: "CVE Lookup",        detail: "Real-time vulnerability database" },
                ],
              },
              {
                category: "Developer Security",
                color: "yellow",
                desc: "Integrate security into your dev workflow — catch issues before they ship.",
                tools: [
                  { icon: FileCode2,  name: "SAST Analyzer",    detail: "Static code analysis for 35+ languages" },
                  { icon: Package,    name: "Dependency Scanner", detail: "Find vulnerable packages before prod" },
                  { icon: Crosshair,  name: "OAST Tester",      detail: "Blind injection via async callbacks" },
                  { icon: FlaskConical, name: "API Security Tester", detail: "Auth, injection, and logic flaws" },
                ],
              },
              {
                category: "Defense & Monitoring",
                color: "green",
                desc: "Detect, log, and respond to threats against your own infrastructure.",
                tools: [
                  { icon: Bell,       name: "Canary Tokens",    detail: "Tripwire alerts for file & link access" },
                  { icon: Database,   name: "SIEM Event Log",   detail: "Centralized security event correlation" },
                  { icon: Filter,     name: "HTTP Interceptor", detail: "Inspect & modify live HTTP traffic" },
                  { icon: Shield,     name: "WAF Analyzer",     detail: "Identify & test firewall bypass vectors" },
                ],
              },
            ].map(({ category, color, desc, tools }) => {
              const borderColor = { red: "border-red-400/15 hover:border-red-400/30", orange: "border-orange-400/15 hover:border-orange-400/30", yellow: "border-yellow-400/15 hover:border-yellow-400/30", green: "border-primary/15 hover:border-primary/30" }[color];
              const labelColor  = { red: "text-red-400", orange: "text-orange-400", yellow: "text-yellow-400", green: "text-primary" }[color];
              const bgColor     = { red: "bg-red-400/8", orange: "bg-orange-400/8", yellow: "bg-yellow-400/8", green: "bg-primary/8" }[color];
              return (
                <div key={category} className={`bg-[#0d1610] border ${borderColor} rounded-2xl p-5 transition-all`}>
                  <div className={`text-[9px] font-bold uppercase tracking-widest ${labelColor} mb-1`}>{category}</div>
                  <p className="text-[10px] text-white/50 mb-4 leading-relaxed">{desc}</p>
                  <div className="space-y-2.5">
                    {tools.map(({ icon: Icon, name, detail }) => (
                      <div key={name} className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-lg ${bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`w-3 h-3 ${labelColor}`} />
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-white/90">{name}</div>
                          <div className="text-[9px] text-white/40 leading-tight">{detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom CTA banner */}
          <div className="bg-gradient-to-r from-[#0d1610] via-[#0f1a10] to-[#0d1610] border border-red-400/15 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="text-xl font-bold text-white mb-2">
                Everything you need. One subscription. One platform.
              </div>
              <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                Command Center Pro includes every tool listed above plus the full VPN Basic plan — WireGuard
                encryption, kill switch, GPS spoofing, meshnet networking, and data broker opt-out scanning.
                No separate subscriptions. No tool limits. Starting at{" "}
                <span className="text-white/90 font-semibold">$39.99/month</span>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
                className="px-6 py-3 border border-white/[0.1] text-white/88 hover:text-white hover:border-white/20 rounded-xl transition-all text-sm font-medium"
              >
                See Pricing
              </button>
              <Link
                href="/sign-up"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-400 transition-all text-sm shadow-[0_0_30px_rgba(239,68,68,0.2)]"
              >
                Get Command Center <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-3">Transparent Pricing</div>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Two tiers. No surprises.</h2>
            <p className="text-white/78 text-lg">Start with VPN Basic or unlock the full security suite with Command Center Pro.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {PRICING_PLANS.map(({ name, price, period, annual, annualNote, desc, highlight, badge, features }) => (
              <div
                key={name}
                className={`relative rounded-2xl overflow-hidden border transition-all ${
                  highlight
                    ? "border-primary/50 shadow-[0_0_40px_rgba(0,255,136,0.08)]"
                    : "border-white/[0.07]"
                } bg-[#0d1610]`}
              >
                {badge && (
                  <div className="text-center text-xs font-bold tracking-widest py-2 bg-primary text-black">
                    {badge}
                  </div>
                )}
                <div className="p-8">
                  <div className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2">{name}</div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-white">{price}</span>
                    <span className="text-white/78 text-sm pb-1">{period}</span>
                  </div>
                  <div className="text-primary/70 text-xs font-medium mb-1">{annual} · <span className="text-primary/50">{annualNote}</span></div>
                  <p className="text-white/78 text-xs mb-6 leading-relaxed mt-2">{desc}</p>
                  <Link
                    href="/pricing"
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all mb-6 ${
                      highlight
                        ? "bg-primary text-black hover:brightness-110 shadow-[0_0_20px_rgba(0,255,136,0.2)]"
                        : "border border-white/[0.1] text-white hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    Get Started
                  </Link>
                  <div className="space-y-2.5">
                    {features.map((f) => (
                      <div key={f} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <span className="text-xs text-white/83">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-white/70">All plans include a 30-day money-back guarantee. Cancel any time.</p>
        </div>
      </section>

      {/* ── TESTIMONIAL STRIP ── */}
      <section className="py-16 px-6 border-t border-white/[0.05] bg-[#0a0f0b]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
          </div>
          <blockquote className="text-lg text-white/88 italic leading-relaxed max-w-2xl mx-auto mb-4">
            "Finally a VPN that gives me real control. Setup took less than a minute, and knowing my traffic runs on my own server — not some shared data center — makes all the difference."
          </blockquote>
          <div className="text-sm text-white/70">— ProxhqVPN subscriber</div>
        </div>
      </section>

      {/* ── AMBASSADORS ── */}
      <AmbassadorsSection />

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
          <p className="text-white/78 text-lg mb-8 leading-relaxed">
            Set up your personal VPN in under 60 seconds. 30-day money-back guarantee on all plans.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-10 py-4 bg-primary text-black font-bold rounded-2xl hover:brightness-110 transition-all shadow-[0_0_40px_rgba(0,255,136,0.3)] text-base"
          >
            Start Free Today <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="text-white/70 text-sm mt-4">No credit card required to sign up · Cancel any time</div>
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
              <span className="text-white/70 text-xs ml-1">by ALPHA UNLIMITED TECHNOLOGIES LLC</span>
            </div>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {NAV_LINKS.map(({ label, href }) => (
                <button
                  key={label}
                  onClick={() => document.getElementById(href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" })}
                  className="text-xs text-white/70 hover:text-white/60 transition-colors"
                >
                  {label}
                </button>
              ))}
              <Link href="/ambassadors" className="text-xs text-white/70 hover:text-white/60 transition-colors">
                Ambassadors
              </Link>
            </div>
            <div className="text-xs text-white/70">
              © {new Date().getFullYear()} All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
