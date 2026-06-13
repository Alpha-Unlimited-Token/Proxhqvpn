// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public Security Overview page — /security
import { ShieldCheck, Lock, Eye, Wifi, KeyRound, Server, Bug, FileSearch, Globe } from "lucide-react";

const CONTACT_EMAIL = import.meta.env.VITE_SECURITY_CONTACT_EMAIL ?? "security@proxhqvpn.com";
const APP_URL       = import.meta.env.VITE_PUBLIC_APP_URL ?? "https://proxhqvpn.com";

interface FeatureCard {
  icon: React.ElementType;
  title: string;
  desc: string;
}

const FEATURES: FeatureCard[] = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    desc: "All VPN traffic is encrypted with WireGuard using AES-256-GCM. Private keys are stored exclusively in RAM and destroyed on session end — never written to disk.",
  },
  {
    icon: Eye,
    title: "Zero-Log Policy",
    desc: "ProxhqVPN never logs your VPN session activity, connection timestamps, IP addresses, or traffic content. Our no-log architecture is verifiable and independently auditable.",
  },
  {
    icon: Wifi,
    title: "60-Node WireGuard Mesh",
    desc: "Our 60-node mesh network (50 outer + 10 inner nodes) provides distributed, fault-tolerant VPN routing with automatic failover and real-time health monitoring.",
  },
  {
    icon: KeyRound,
    title: "RAM-Only WireGuard Keys",
    desc: "Following the Mullvad-style architecture, all WireGuard private keys exist only in `/dev/shm`. Keys are rotated automatically and never persisted to storage.",
  },
  {
    icon: ShieldCheck,
    title: "Continuous Validation",
    desc: "Automated security checks run continuously across API endpoints, TLS certificates, WireGuard configurations, DNS leak detection, and node health metrics.",
  },
  {
    icon: Eye,
    title: "SHA3-256 Audit Chain",
    desc: "Every security event is recorded in a tamper-evident hash chain using SHA3-256 with HMAC-SHA512 signatures. The chain can be independently verified for integrity.",
  },
  {
    icon: Server,
    title: "Hardened Infrastructure",
    desc: "VPN nodes run hardened Linux with UFW, auditd, fail2ban, sysctl tuning, SSH key-only authentication, and STIG-compliance scanning.",
  },
  {
    icon: Bug,
    title: "Honeypot Network",
    desc: "A silk-web honeypot overlay detects and traps unauthorized access attempts, providing early warning of intrusion and attacker behavioral analysis.",
  },
  {
    icon: FileSearch,
    title: "Kill Switch + Leak Protection",
    desc: "Built-in kill switch prevents traffic from leaking outside the VPN tunnel. DNS, IPv6, and WebRTC leak detection runs continuously with automatic blocking.",
  },
  {
    icon: Globe,
    title: "DPI Obfuscation",
    desc: "Traffic obfuscation via obfs4, Shadowsocks, V2Ray-WS, Meek, Snowflake, and XOR bypass deep packet inspection in restrictive networks.",
  },
];

export default function SecurityOverview() {
  return (
    <div className="min-h-screen bg-[#070c08] text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-[#0a120b] to-[#070c08] border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            Security Overview
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Built for Privacy. Hardened for Security.
          </h1>
          <p className="text-base text-white/50 max-w-2xl mx-auto leading-relaxed">
            ProxhqVPN is engineered from the ground up with a security-first architecture — RAM-only
            keys, zero-log infrastructure, continuous validation, and an enterprise-grade honeypot
            detection network.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">

        {/* Feature grid */}
        <div>
          <h2 className="text-lg font-bold text-white/90 mb-6">Security Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5 flex gap-4 hover:border-primary/25 hover:bg-primary/[0.03] transition-all"
              >
                <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90 mb-1">{title}</div>
                  <div className="text-[12px] text-white/50 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Responsible disclosure CTA */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-1">
            <div className="text-sm font-bold text-white/90 mb-1.5">Found a vulnerability?</div>
            <p className="text-sm text-white/55 leading-relaxed">
              We run a responsible disclosure program. If you discover a security issue in
              ProxhqVPN-owned systems, please report it privately before public disclosure.
            </p>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors"
          >
            Report Securely
          </a>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center pb-6">
          {[
            { label: "Trust Center",   href: "/trust-center" },
            { label: "Status Page",    href: "/status" },
            { label: "Vulnerability Disclosure", href: "/trust-center#disclosure" },
            { label: "Pricing",        href: "/pricing" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-xs text-white/35 hover:text-primary/70 transition-colors underline underline-offset-4 decoration-white/10 hover:decoration-primary/30"
            >
              {label}
            </a>
          ))}
        </div>

        <p className="text-center text-[11px] text-white/20 pb-4">
          © 2024–2026 Alpha Unlimited Technologies LLC · {APP_URL}
        </p>
      </div>
    </div>
  );
}
