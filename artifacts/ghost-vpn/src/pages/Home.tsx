import { Link } from "wouter";
import { Shield, Network, Zap, Eye, Lock, Globe, ArrowRight, Activity } from "lucide-react";

const FEATURES = [
  { icon: Shield, title: "AES-256-GCM Encryption", desc: "Military-grade encryption on every packet, zero compromise." },
  { icon: Zap, title: "WireGuard Protocol", desc: "Fastest modern VPN protocol — lower latency, smaller attack surface." },
  { icon: Network, title: "SilkWeb Mesh Defense", desc: "Multi-layer honeypot architecture. Intruders get trapped, not through." },
  { icon: Globe, title: "6,000+ VPN Gate Nodes", desc: "Global inner swarm sourced from the University of Tsukuba academic network." },
  { icon: Lock, title: "Kill Switch + Leak Guard", desc: "Hard kill switch, DNS leak protection, WebRTC shield — always on." },
  { icon: Eye, title: "Split Tunneling", desc: "Route only what you want. Per-app and per-IP granular control." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-primary flex flex-col selection:bg-primary selection:text-black">
      {/* Scanlines */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

      {/* Top bar */}
      <header className="border-b border-primary/20 px-8 py-4 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="GhostNet" className="w-8 h-8" />
          <div>
            <div className="text-lg font-bold tracking-tighter">GHOSTNET_OS</div>
            <div className="text-[9px] text-primary/40 font-mono tracking-widest">SELF-HOSTED VPN PLATFORM</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in"
            className="text-xs font-mono uppercase tracking-widest text-primary/60 border border-primary/30 px-4 py-1.5 hover:text-primary hover:border-primary transition-colors">
            SIGN IN
          </Link>
          <Link href="/sign-up"
            className="text-xs font-mono uppercase tracking-widest text-black bg-primary border border-primary px-4 py-1.5 hover:bg-primary/80 transition-colors">
            GET ACCESS
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 py-20 relative z-10 text-center">
        <div className="relative mb-8">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="w-24 h-24 mx-auto opacity-90" />
          <div className="absolute inset-0 blur-3xl bg-primary/10 rounded-full" />
        </div>

        <div className="text-[10px] font-mono tracking-[0.4em] text-primary/40 uppercase mb-4">
          ADVANCED THREAT EVASION PLATFORM
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tighter uppercase mb-6 leading-none">
          GHOST<span className="text-primary">NET</span>
        </h1>
        <p className="text-primary/60 font-mono text-sm max-w-xl mb-10 leading-relaxed">
          A self-hosted VPN platform with WireGuard, AES-256-GCM, a 6,000+ node adaptive inner swarm,
          SilkWeb honeypot mesh, kill switch, DNS leak protection, and split tunneling. Built for operators
          who need real control.
        </p>

        <div className="flex items-center gap-4">
          <Link href="/sign-up"
            className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-black bg-primary border border-primary px-6 py-3 hover:bg-primary/80 transition-colors">
            DEPLOY YOUR NODE <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/sign-in"
            className="text-sm font-mono uppercase tracking-widest text-primary border border-primary/30 px-6 py-3 hover:border-primary transition-colors">
            OPERATOR LOGIN
          </Link>
        </div>

        {/* Live pulse */}
        <div className="flex items-center gap-2 mt-10 text-[10px] font-mono text-primary/30">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          NETWORK ONLINE — ALL SYSTEMS NOMINAL
          <Activity className="w-3 h-3 ml-1" />
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-primary/10 px-8 py-16 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-[9px] font-mono tracking-[0.4em] text-primary/30 uppercase text-center mb-10">
            PLATFORM CAPABILITIES
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="border border-primary/15 bg-black/40 p-5 hover:border-primary/40 transition-colors group">
                <Icon className="w-5 h-5 text-primary mb-3 opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="text-xs font-bold tracking-wider uppercase mb-1.5">{title}</div>
                <div className="text-[11px] font-mono text-primary/50 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack row */}
      <section className="border-t border-primary/10 px-8 py-8 relative z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {["WireGuard", "AES-256-GCM", "TUN/TAP", "VPN Gate 6k+", "PostgreSQL", "Node.js", "React"].map((t) => (
            <span key={t} className="text-[9px] font-mono text-primary/25 uppercase tracking-widest">{t}</span>
          ))}
        </div>
      </section>

      <footer className="border-t border-primary/10 px-8 py-4 text-center relative z-10">
        <span className="text-[9px] font-mono text-primary/20 uppercase tracking-widest">
          GHOSTNET_OS — SELF-HOSTED VPN INFRASTRUCTURE — ALL RIGHTS RESERVED
        </span>
      </footer>
    </div>
  );
}
