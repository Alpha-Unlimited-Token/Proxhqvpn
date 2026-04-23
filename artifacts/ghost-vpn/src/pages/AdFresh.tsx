import { useEffect, useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATS = [
  { value: "6,000+", label: "VPN Gate Nodes" },
  { value: "AES-256", label: "Encryption Standard" },
  { value: "0", label: "Logs Kept" },
  { value: "30s", label: "Time to Connect" },
];

const PILLARS = [
  {
    icon: "🛡",
    title: "Invisible Online",
    body: "WireGuard tunnels hide your IP, encrypt every packet, and leave zero trace in our logs.",
  },
  {
    icon: "⚡",
    title: "Developer Toolkit",
    body: "HTTP Probe, SQLMap, Intruder, Ghost Chain — every offensive tool a researcher needs, built in.",
  },
  {
    icon: "🕸",
    title: "Honeypot Mesh",
    body: "SilkWeb decoy network fingerprints attackers. Ghost Trace detects exfiltration before it happens.",
  },
];

export default function AdFresh() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const activeIdx = tick % PILLARS.length;

  return (
    <div className="min-h-screen bg-[#020704] text-white overflow-hidden select-none">
      {/* Animated background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,136,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radial glow top center */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00ff88]/5 blur-[100px] rounded-full" />

      {/* ─── NAVBAR ─── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-[#00ff88]/8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/25 flex items-center justify-center">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-6 h-6" />
          </div>
          <div>
            <span className="font-black text-lg tracking-tight text-white">ProxhqVPN</span>
            <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#00ff88]/50">by Alpha Unlimited</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-white/40">Starting at</span>
          <span className="text-sm font-black text-[#00ff88]">$6.99</span>
          <span className="text-xs text-white/40">/mo</span>
          <span className="mx-3 text-white/10">|</span>
          <a
            href="https://proxhqvpn.com"
            className="text-xs font-bold bg-[#00ff88] text-black px-5 py-2 rounded-lg hover:brightness-110 transition-all"
          >
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16">
        {/* Floating logo mark */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-2xl bg-[#00ff88]/20 blur-2xl scale-150" />
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#00ff88]/15 to-[#00ff88]/5 border border-[#00ff88]/30 flex items-center justify-center shadow-2xl shadow-[#00ff88]/10">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-14 h-14" />
          </div>
        </div>

        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <span className="w-8 h-px bg-[#00ff88]/40" />
          <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#00ff88]/70">
            Self-Hosted WireGuard VPN
          </span>
          <span className="w-8 h-px bg-[#00ff88]/40" />
        </div>

        <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight text-white mb-6">
          Ghost-level<br />
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #00ff88 0%, #00cc66 50%, #00ff88 100%)" }}
          >
            privacy.
          </span>
        </h1>

        <p className="text-lg text-white/50 max-w-xl leading-relaxed mb-10">
          The only VPN platform that combines military-grade tunneling, a full penetration-testing suite, 
          and an AI-powered honeypot mesh — in one subscription.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <a
            href="https://proxhqvpn.com"
            className="group flex items-center gap-2 px-10 py-4 bg-[#00ff88] text-black font-black text-base rounded-xl hover:brightness-110 transition-all shadow-2xl shadow-[#00ff88]/20"
          >
            Get Protected Now
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <a
            href="https://proxhqvpn.com"
            className="text-sm text-[#00ff88]/70 hover:text-[#00ff88] transition-colors underline underline-offset-4"
          >
            See all features →
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 w-full max-w-2xl">
          {STATS.map(({ value, label }) => (
            <div key={label} className="bg-[#00ff88]/4 border border-[#00ff88]/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-[#00ff88] mb-0.5">{value}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── THREE PILLARS (animated) ─── */}
      <section className="relative z-10 px-6 py-12 border-t border-[#00ff88]/8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#00ff88]/50 mb-3">Three platforms. One price.</div>
            <div className="text-3xl font-black text-white">Built for privacy purists &amp; security pros.</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PILLARS.map((p, i) => (
              <div
                key={p.title}
                className={`rounded-2xl p-6 border transition-all duration-500 ${
                  activeIdx === i
                    ? "bg-[#00ff88]/8 border-[#00ff88]/30 shadow-xl shadow-[#00ff88]/8"
                    : "bg-white/[0.02] border-white/6"
                }`}
              >
                <div className="text-3xl mb-3">{p.icon}</div>
                <div className={`text-base font-black mb-2 transition-colors ${activeIdx === i ? "text-[#00ff88]" : "text-white"}`}>
                  {p.title}
                </div>
                <div className="text-sm text-white/50 leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLAN CARDS ─── */}
      <section className="relative z-10 px-6 py-12 border-t border-[#00ff88]/8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#00ff88]/50 mb-3">Simple Pricing</div>
            <div className="text-3xl font-black text-white">Pick your plan.</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VPN Basic */}
            <div className="rounded-2xl p-6 bg-white/[0.02] border border-white/10">
              <div className="text-xs font-bold uppercase tracking-widest text-[#00ff88]/60 mb-3">VPN Basic</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-white">$6.99</span>
                <span className="text-sm text-white/40 mb-1">/mo</span>
              </div>
              <div className="text-xs text-white/30 mb-5">or $59.99/yr · Save 28%</div>
              {["WireGuard AES-256-GCM", "Kill switch & DNS shield", "6,000+ VPN Gate nodes", "Double-hop routing", "Unlimited devices"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/70 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]/60 shrink-0" />
                  {f}
                </div>
              ))}
              <a
                href="https://proxhqvpn.com"
                className="mt-6 block text-center py-3 border border-[#00ff88]/30 text-[#00ff88] font-bold text-sm rounded-xl hover:bg-[#00ff88]/8 transition-all"
              >
                Get VPN Basic
              </a>
            </div>

            {/* Command Center Pro */}
            <div className="relative rounded-2xl p-6 bg-[#00ff88]/6 border border-[#00ff88]/30 shadow-xl shadow-[#00ff88]/8">
              <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-[#00ff88] text-black px-2 py-1 rounded-full">
                Best Value
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#00ff88]/80 mb-3">Command Center Pro</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-white">$39.99</span>
                <span className="text-sm text-white/40 mb-1">/mo</span>
              </div>
              <div className="text-xs text-white/30 mb-5">or $349.99/yr · Save 27%</div>
              {["All VPN Basic features", "SQLMap vulnerability scanner", "HTTP Probe & Intruder", "Ghost Chain + SilkWeb honeypot", "OSINT recon + threat intel"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/80 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shrink-0" />
                  {f}
                </div>
              ))}
              <a
                href="https://proxhqvpn.com"
                className="mt-6 block text-center py-3 bg-[#00ff88] text-black font-black text-sm rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#00ff88]/20"
              >
                Get Command Center Pro
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="relative z-10 px-6 py-10 border-t border-[#00ff88]/8">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          {[
            { icon: "🔒", title: "Zero Logs", body: "We never record your IP, traffic, or browsing history." },
            { icon: "↩", title: "30-Day Guarantee", body: "Full refund within 30 days. No questions asked." },
            { icon: "⚡", title: "Instant Access", body: "Your VPN is live within 30 seconds of subscribing." },
          ].map(({ icon, title, body }) => (
            <div key={title} className="flex-1">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-sm font-bold text-white/90 mb-1">{title}</div>
              <div className="text-xs text-white/40 leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-10 px-6 py-20 text-center border-t border-[#00ff88]/8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#00ff88]/4 to-transparent" />
        <div className="relative z-10">
          <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-16 h-16 mx-auto mb-5 opacity-80" />
          <div className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Your data is yours.<br />
            <span className="text-[#00ff88]">Keep it that way.</span>
          </div>
          <p className="text-white/40 text-sm max-w-sm mx-auto mb-8">
            Join thousands of security professionals and privacy advocates on ProxhqVPN.
          </p>
          <a
            href="https://proxhqvpn.com"
            className="inline-block px-12 py-4 bg-[#00ff88] text-black font-black text-base rounded-xl hover:brightness-110 transition-all shadow-2xl shadow-[#00ff88]/25"
          >
            proxhqvpn.com
          </a>
          <div className="mt-8 text-[10px] text-white/20 uppercase tracking-[0.2em]">
            © 2026 Alpha Unlimited Technologies LLC
          </div>
        </div>
      </section>
    </div>
  );
}
