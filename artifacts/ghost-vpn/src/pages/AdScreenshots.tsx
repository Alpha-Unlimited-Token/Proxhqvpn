import screenshotPricing from "@assets/Screenshot_20260423-005035_Chrome_1776922328389.png";
import screenshotConnect from "@assets/Screenshot_2026-04-23_at_1.25.52_AM_1776922413463.png";
import screenshotGuide from "@assets/Screenshot_2026-04-23_at_12.02.44_AM_1776922413527.png";
import screenshotKillSwitch from "@assets/Screenshot_2026-04-23_at_12.11.09_AM_1776922413651.png";
import screenshotGhostTrace from "@assets/Screenshot_2026-04-23_at_12.13.21_AM_1776922413682.png";
import screenshotVpnGate from "@assets/Screenshot_2026-04-23_at_12.19.51_AM_1776922413778.png";
import screenshotDns from "@assets/Screenshot_2026-04-23_at_12.17.07_AM_1776922413743.png";
import screenshotObfuscation from "@assets/Screenshot_2026-04-23_at_12.18.44_AM_1776922413849.png";
import screenshotGhostChain from "@assets/Screenshot_2026-04-23_at_12.21.14_AM_1776922413812.png";
import screenshotIpExposure from "@assets/Screenshot_2026-04-23_at_12.14.47_AM_1776922413714.png";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  { label: "WireGuard AES-256", desc: "Military-grade encryption" },
  { label: "Kill Switch", desc: "Auto-block on VPN drop" },
  { label: "Double-Hop", desc: "Two-layer anonymity" },
  { label: "DNS Sinkhole", desc: "Block ads, trackers, malware" },
  { label: "Ghost Chain", desc: "7-hop Tor-veiled routing" },
  { label: "6,000+ Nodes", desc: "Global VPN Gate network" },
];

export default function AdScreenshots() {
  return (
    <div className="min-h-screen bg-[#040a06] text-white font-mono overflow-hidden selection:bg-[#00ff88] selection:text-black">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.4) 2px, rgba(0,255,136,0.4) 4px)",
        }}
      />

      {/* ─── HERO ─── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16 pb-10 overflow-hidden">
        {/* Glow rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[#00ff88]/8 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[#00ff88]/12 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full bg-[#00ff88]/5 blur-2xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-8 h-8" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ProxhqVPN</span>
        </div>

        <div className="relative z-10 text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff88]/70 mb-4">
          Alpha Unlimited Technologies LLC
        </div>
        <h1 className="relative z-10 text-4xl md:text-6xl font-black tracking-tight leading-none text-white mb-3">
          PRIVACY.<br />
          <span className="text-[#00ff88]">POWER.</span><br />
          PLATFORM.
        </h1>
        <p className="relative z-10 text-base text-white/60 max-w-lg mt-4 leading-relaxed">
          Military-grade WireGuard VPN + offensive security toolkit + honeypot platform. 
          One subscription. Zero logs.
        </p>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 mt-8">
          <a
            href="https://proxhqvpn.com"
            className="px-8 py-3 bg-[#00ff88] text-black font-bold text-sm rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#00ff88]/20"
          >
            Get Started — $6.99/mo
          </a>
          <a
            href="https://proxhqvpn.com"
            className="px-8 py-3 border border-[#00ff88]/25 text-[#00ff88]/80 font-semibold text-sm rounded-xl hover:bg-[#00ff88]/8 transition-all"
          >
            View Plans
          </a>
        </div>
      </section>

      {/* ─── SCREENSHOT GRID ─── */}
      <section className="px-4 md:px-10 pb-10">
        {/* Big feature: Connect + Pricing side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="relative group rounded-xl overflow-hidden border border-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all">
            <img src={screenshotConnect} alt="Connect Dashboard" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00ff88]/70 mb-1">VPN Connect</div>
              <div className="text-sm font-bold text-white">One-click protected. Every device.</div>
            </div>
          </div>
          <div className="relative group rounded-xl overflow-hidden border border-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all">
            <img src={screenshotPricing} alt="Pricing" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00ff88]/70 mb-1">Transparent Pricing</div>
              <div className="text-sm font-bold text-white">VPN Basic $6.99 · Pro $39.99/mo</div>
            </div>
          </div>
        </div>

        {/* 3-column row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { img: screenshotVpnGate,     tag: "VPN Gate Swarm",   desc: "98 nodes · 22ms · 299 Mbps" },
            { img: screenshotGhostTrace,  tag: "Ghost Trace AI",    desc: "Behavioral anomaly engine" },
            { img: screenshotKillSwitch,  tag: "Kill Switch",       desc: "Hard-mode auto-block" },
          ].map(({ img, tag, desc }) => (
            <div key={tag} className="relative rounded-xl overflow-hidden border border-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all">
              <img src={img} alt={tag} className="w-full h-44 object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00ff88]/70 mb-0.5">{tag}</div>
                <div className="text-xs font-semibold text-white/90">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 3-column row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { img: screenshotDns,         tag: "DNS Sinkhole",      desc: "Block ads & malware globally" },
            { img: screenshotObfuscation, tag: "Stealth Protocol",  desc: "Bypass DPI censorship" },
            { img: screenshotGhostChain,  tag: "Ghost Chain",       desc: "7-hop Tor-veiled routing" },
          ].map(({ img, tag, desc }) => (
            <div key={tag} className="relative rounded-xl overflow-hidden border border-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all">
              <img src={img} alt={tag} className="w-full h-44 object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00ff88]/70 mb-0.5">{tag}</div>
                <div className="text-xs font-semibold text-white/90">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES STRIP ─── */}
      <section className="px-4 md:px-10 py-8 border-t border-[#00ff88]/10">
        <div className="text-center mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff88]/60 mb-2">What's Included</div>
          <div className="text-2xl font-black text-white">Everything. Out of the box.</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {features.map(({ label, desc }) => (
            <div key={label} className="bg-[#00ff88]/4 border border-[#00ff88]/12 rounded-xl p-3 text-center">
              <div className="w-6 h-6 rounded-full bg-[#00ff88]/15 border border-[#00ff88]/25 flex items-center justify-center mx-auto mb-2">
                <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
              </div>
              <div className="text-[11px] font-bold text-[#00ff88]/90 leading-tight mb-0.5">{label}</div>
              <div className="text-[10px] text-white/40 leading-tight">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRICING COMPARISON ─── */}
      <section className="px-4 md:px-10 py-8 border-t border-[#00ff88]/10">
        <div className="text-center mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff88]/60 mb-2">vs. Competition</div>
          <div className="text-2xl font-black text-white">More tools. Lower cost.</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[
            { name: "Burp Suite Pro", price: "$475/yr", note: "HTTP proxy only", highlight: false },
            { name: "Shodan", price: "$69/mo", note: "Intel only, no VPN", highlight: false },
            { name: "Metasploit Pro", price: "$15k/yr", note: "Exploit only", highlight: false },
            { name: "ProxhqVPN Pro", price: "$39.99/mo", note: "VPN + full toolkit", highlight: true },
          ].map(({ name, price, note, highlight }) => (
            <div key={name} className={`rounded-xl p-4 text-center border ${
              highlight
                ? "bg-[#00ff88]/8 border-[#00ff88]/40"
                : "bg-white/[0.02] border-white/8"
            }`}>
              <div className={`text-xs font-bold mb-1 ${highlight ? "text-[#00ff88]" : "text-white/60"}`}>{name}</div>
              <div className={`text-lg font-black ${highlight ? "text-[#00ff88]" : "text-white"}`}>{price}</div>
              <div className="text-[10px] text-white/40 mt-1">{note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section className="relative px-4 md:px-10 py-16 text-center overflow-hidden border-t border-[#00ff88]/10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#00ff88]/4 pointer-events-none" />
        <div className="relative z-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff88]/60 mb-3">No logs. No limits.</div>
          <div className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
            Stay invisible.<br />
            <span className="text-[#00ff88]">Stay protected.</span>
          </div>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto">
            30-day money-back guarantee. Live in 30 seconds.
          </p>
          <a
            href="https://proxhqvpn.com"
            className="inline-block px-10 py-4 bg-[#00ff88] text-black font-black text-base rounded-xl hover:brightness-110 transition-all shadow-xl shadow-[#00ff88]/25"
          >
            Start at proxhqvpn.com
          </a>
          <div className="mt-6 text-[10px] text-white/30 uppercase tracking-widest">
            Alpha Unlimited Technologies LLC · 2026
          </div>
        </div>
      </section>
    </div>
  );
}
