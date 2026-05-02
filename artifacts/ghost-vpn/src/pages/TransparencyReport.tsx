// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface WarrantCanary {
  statement: string;
  effectiveDate: string;
  updatedAt: string;
  jurisdiction: string;
  nslReceived: number;
  courtOrdersReceived: number;
  gagOrdersReceived: number;
  userDataDisclosed: number;
  keysHandedOver: number;
  backdoorsInstalled: number;
  canaryIntact: boolean;
}

const QUARTERS = [
  {
    period: "Q1 2026 (Jan–Mar)",
    legalRequests: 0,
    dataDisclosed: 0,
    takedowns: 0,
    govAccess: 0,
    notes: "No legal requests received during this period.",
  },
  {
    period: "Q4 2025 (Oct–Dec)",
    legalRequests: 0,
    dataDisclosed: 0,
    takedowns: 0,
    govAccess: 0,
    notes: "No legal requests received during this period.",
  },
  {
    period: "Q3 2025 (Jul–Sep)",
    legalRequests: 0,
    dataDisclosed: 0,
    takedowns: 0,
    govAccess: 0,
    notes: "Service launched Q3 2025. No legal requests received.",
  },
];

export default function TransparencyReport() {
  const [canary, setCanary] = useState<WarrantCanary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/warrant-canary`)
      .then(r => r.json())
      .then(setCanary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function exportReport() {
    const lines = [
      `# ProxhqVPN Transparency Report`,
      `Published by ALPHA UNLIMITED TECHNOLOGIES LLC`,
      `Report Date: ${new Date().toLocaleDateString()}`,
      ``,
      `## Warrant Canary`,
      canary ? `Status: ${canary.canaryIntact ? "INTACT" : "COMPROMISED"}` : "Status: Loading...",
      ``,
      `## Legal Requests Summary (All-Time)`,
      `| Type | Count |`,
      `|------|-------|`,
      `| National Security Letters | 0 |`,
      `| Court Orders | 0 |`,
      `| Gag Orders | 0 |`,
      `| User Data Disclosed | 0 |`,
      `| Encryption Keys Handed Over | 0 |`,
      `| Backdoors Installed | 0 |`,
      ``,
      `## Quarterly Breakdown`,
      ...QUARTERS.map(q => [
        `### ${q.period}`,
        `- Legal Requests: ${q.legalRequests}`,
        `- User Data Disclosed: ${q.dataDisclosed}`,
        `- Takedown Requests: ${q.takedowns}`,
        `- Government Access Granted: ${q.govAccess}`,
        `- Notes: ${q.notes}`,
      ].join("\n")),
      ``,
      `## Infrastructure`,
      `- Jurisdiction: United States (Delaware LLC)`,
      `- Server Provider: Self-hosted on user-provisioned VPS (Vultr/DigitalOcean/etc.)`,
      `- No server logs retained: Audit log is in-memory only, cleared on restart`,
      `- Authentication: Clerk (email/OAuth)`,
      `- Payment: Stripe (no cryptocurrency accepted)`,
      ``,
      `## Contact`,
      `Legal: legal@alphaunlimitedtech.com`,
      `Security: security@alphaunlimitedtech.com`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `proxhqvpn-transparency-${new Date().toISOString().slice(0,10)}.md`; a.click();
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">Transparency Report</div>
          <div className="text-white/50 text-xs">
            ALPHA UNLIMITED TECHNOLOGIES LLC · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
        <button
          onClick={exportReport}
          className="border border-white/20 text-white/60 text-xs px-3 py-1.5 hover:text-white hover:border-white/40"
        >
          Export Report (MD)
        </button>
      </div>

      {/* Warrant Canary */}
      <div className={`border p-4 space-y-3 ${canary?.canaryIntact !== false ? "border-green-500/30 bg-green-900/10" : "border-red-500/30 bg-red-900/10"}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${canary?.canaryIntact !== false ? "bg-green-400" : "bg-red-400"}`} />
          <div className={`text-xs font-bold uppercase tracking-widest ${canary?.canaryIntact !== false ? "text-green-400" : "text-red-400"}`}>
            Warrant Canary — {loading ? "Loading..." : canary?.canaryIntact !== false ? "INTACT" : "COMPROMISED"}
          </div>
        </div>
        {!loading && canary && (
          <div className="text-white/60 text-xs leading-relaxed border-l border-green-500/20 pl-3">
            {canary.statement}
          </div>
        )}
        <div className="text-white/30 text-[10px]">
          Effective: {canary?.effectiveDate ?? "—"} · Last updated: {canary?.updatedAt ? new Date(canary.updatedAt).toLocaleString() : "—"}
        </div>
      </div>

      {/* Legal Requests — All Time */}
      <div className="border border-white/10 p-4 space-y-3">
        <div className="text-white/60 text-xs uppercase tracking-widest">Legal Requests — All-Time Totals</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "National Security Letters",    value: 0 },
            { label: "FISA/Court Orders",            value: 0 },
            { label: "Gag Orders Received",          value: 0 },
            { label: "User Data Disclosed",          value: 0 },
            { label: "Encryption Keys Handed Over",  value: 0 },
            { label: "Intentional Backdoors",        value: 0 },
          ].map(({ label, value }) => (
            <div key={label} className="border border-white/10 p-3">
              <div className="text-2xl font-bold text-green-400">{value}</div>
              <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quarterly breakdown */}
      <div className="border border-white/10 p-4 space-y-4">
        <div className="text-white/60 text-xs uppercase tracking-widest">Quarterly Breakdown</div>
        {QUARTERS.map((q, i) => (
          <div key={i} className="border border-white/10 p-3 space-y-2">
            <div className="text-xs text-white font-bold">{q.period}</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Legal Requests",  value: q.legalRequests },
                { label: "Data Disclosed",  value: q.dataDisclosed },
                { label: "Takedowns",       value: q.takedowns },
                { label: "Gov Access",      value: q.govAccess },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-green-400 font-bold text-lg">{value}</div>
                  <div className="text-[10px] text-white/40">{label}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-white/40 border-t border-white/5 pt-2">{q.notes}</div>
          </div>
        ))}
      </div>

      {/* Infrastructure */}
      <div className="border border-white/10 p-4 space-y-3">
        <div className="text-white/60 text-xs uppercase tracking-widest">Infrastructure & Privacy Architecture</div>
        <div className="space-y-2">
          {[
            { key: "Jurisdiction",        value: "United States (Delaware LLC)" },
            { key: "Server ownership",    value: "Self-hosted on user-provisioned VPS — no ProxhqVPN-owned hardware" },
            { key: "Traffic logs",        value: "None — in-memory audit buffer only, auto-cleared on restart" },
            { key: "RAM-only servers",    value: "Not currently enforced — standard VPS with persistent disk" },
            { key: "Anonymous signup",    value: "Requires email or OAuth via Clerk — no fully anonymous accounts" },
            { key: "Anonymous payment",   value: "Stripe only — credit/debit card required" },
            { key: "Third-party audit",   value: "No independent audit conducted — self-attested" },
            { key: "Data retention",      value: "Account data (email, subscription) retained; no VPN traffic stored" },
            { key: "PQC",                 value: "WireGuard PresharedKey (256-bit symmetric) included in all configs since April 2026" },
          ].map(({ key, value }) => (
            <div key={key} className="flex gap-4 border-b border-white/5 pb-2">
              <div className="text-white/50 text-xs w-40 shrink-0">{key}</div>
              <div className="text-white/70 text-xs">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclosures */}
      <div className="border border-white/10 p-4 space-y-2">
        <div className="text-white/60 text-xs uppercase tracking-widest">Honest Disclosures</div>
        <div className="space-y-2">
          {[
            "ProxhqVPN is a self-hosted toolkit. You are responsible for provisioning and securing your own server nodes.",
            "We are incorporated in the United States (5 Eyes jurisdiction). Legal compulsion risk exists.",
            "We have not been independently audited. Our no-logs claim is self-attested only.",
            "The mobile app cannot create a native VPN tunnel without OS-level VPN APIs (NEVPNManager on iOS, VpnService on Android).",
            "Obfuscation configs (obfs4, shadowsocks, v2ray) are generated but not tested in censored networks.",
          ].map((text, i) => (
            <div key={i} className="flex gap-2 text-xs text-white/50">
              <span className="text-yellow-400 shrink-0">⚠</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-white/20 text-[10px] text-center">
        ALPHA UNLIMITED TECHNOLOGIES LLC · ProxhqVPN Transparency Report · {new Date().getFullYear()}
      </div>
    </div>
  );
}
