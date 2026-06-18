// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Link, useLocation } from "wouter";

const NAV_ITEMS: [string, string][] = [
  ["/threat-bus",        "Threat Bus"],
  ["/ghost-trap",        "Ghost Trap"],
  ["/ghost-nodes",       "Ghost Nodes"],
  ["/ghost-trace",       "Ghost Trace"],
  ["/ghost-chain",       "Ghost Chain"],
  ["/deception-engine",  "Deception Engine"],
  ["/security-score",    "Security Score"],
  ["/siem",             "SIEM"],
  ["/osint",            "OSINT"],
  ["/canary",           "Canary Tokens"],
  ["/quantum-audit",    "QuantumAudit"],
  ["/node-trust",       "Node Trust"],
];

export function CommandCenterNav() {
  const [location] = useLocation();
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2">
      <span className="w-full px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
        Security Operations
      </span>
      {NAV_ITEMS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
            location === href
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-white/10 text-white/60 hover:border-primary/30 hover:text-white"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
