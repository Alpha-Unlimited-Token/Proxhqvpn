// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAnonAuth, getAnonToken } from "@/hooks/useAnonAuth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function formatNumber(raw: string): string {
  return raw.replace(/(\d{4})(?=\d)/g, "$1 ");
}

interface Server {
  id: number;
  name: string;
  region: string;
  ipAddress: string;
  latencyMs: number;
  status: string;
}

function latencyColor(ms: number) {
  if (ms < 80) return "text-green-400";
  if (ms < 180) return "text-yellow-400";
  return "text-red-400";
}

export default function AnonDashboard() {
  const [, setLocation] = useLocation();
  const { accountNumber, expiresAt, daysRemaining, signOut, isLoggedIn } = useAnonAuth();

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [loadingServers, setLoadingServers] = useState(true);
  const [downloadingConfig, setDownloadingConfig] = useState(false);
  const [configText, setConfigText] = useState<string | null>(null);
  const [configCopied, setConfigCopied] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setLocation("/anon-auth");
      return;
    }
    const token = getAnonToken();
    if (!token) return;
    fetch(`${BASE}/api/anon/servers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setServers(d.servers ?? []);
        if (d.servers?.length) setSelectedServer(d.servers[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingServers(false));
  }, [isLoggedIn]);

  const handleDownloadConfig = async () => {
    const token = getAnonToken();
    if (!token) return;
    setDownloadingConfig(true);
    try {
      const r = await fetch(`${BASE}/api/anon/wg-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to generate config");
        return;
      }
      const text = await r.text();
      setConfigText(text);
    } finally {
      setDownloadingConfig(false);
    }
  };

  const handleSaveConfig = () => {
    if (!configText) return;
    const blob = new Blob([configText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "proxhqvpn-anon.conf";
    a.click();
  };

  const handleCopyConfig = () => {
    if (!configText) return;
    navigator.clipboard.writeText(configText).then(() => {
      setConfigCopied(true);
      setTimeout(() => setConfigCopied(false), 2000);
    });
  };

  const handleSignOut = () => {
    signOut();
    setLocation("/sign-in");
  };

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-[100dvh] bg-[#080d09] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0f0b]/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={`${BASE}/icon-final2.png`} alt="ProxhqVPN" className="w-8 h-8" />
          <span className="font-bold text-white">ProxhqVPN</span>
          <span className="text-xs bg-primary/15 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-mono">
            ANON
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`${BASE}/pricing`}
            className="text-xs text-white/50 hover:text-primary transition-colors hidden sm:block"
          >
            Upgrade Plan
          </a>
          <button
            onClick={handleSignOut}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Account card */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/50 uppercase tracking-widest font-mono">Account Number</div>
            <div className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              daysRemaining > 7
                ? "text-green-400 bg-green-400/10 border-green-400/20"
                : daysRemaining > 0
                ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                : "text-red-400 bg-red-400/10 border-red-400/20"
            }`}>
              {daysRemaining > 0 ? `${daysRemaining}d remaining` : "Expired"}
            </div>
          </div>
          <div className="font-mono text-2xl text-white tracking-widest select-all">
            {accountNumber ? formatNumber(accountNumber) : "—"}
          </div>
          {expiresAt && (
            <div className="text-xs text-white/40">
              Trial expires {new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
        </div>

        {/* Servers */}
        <div className="space-y-3">
          <div className="text-xs text-white/50 uppercase tracking-widest font-mono">VPN Servers</div>
          {loadingServers ? (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <div className="w-4 h-4 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
              Loading servers…
            </div>
          ) : servers.length === 0 ? (
            <div className="text-white/40 text-sm">No servers available.</div>
          ) : (
            <div className="space-y-2">
              {servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedServer(s); setConfigText(null); }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-left ${
                    selectedServer?.id === s.id
                      ? "bg-primary/10 border-primary/40"
                      : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${selectedServer?.id === s.id ? "bg-primary" : "bg-white/20"}`} />
                    <div>
                      <div className="text-sm font-medium text-white">{s.name}</div>
                      <div className="text-xs text-white/50">{s.region}</div>
                    </div>
                  </div>
                  <div className={`text-xs font-mono font-medium ${latencyColor(s.latencyMs)}`}>
                    {s.latencyMs > 0 ? `${Math.round(s.latencyMs)} ms` : "—"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* WireGuard config */}
        <div className="space-y-3">
          <div className="text-xs text-white/50 uppercase tracking-widest font-mono">WireGuard Config</div>
          <p className="text-sm text-white/60 leading-relaxed">
            Download your personal WireGuard config and import it into the{" "}
            <a href="https://www.wireguard.com/install/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              official WireGuard app
            </a>
            . Works on Windows, macOS, Linux, iOS, and Android.
          </p>

          {!configText ? (
            <button
              onClick={handleDownloadConfig}
              disabled={downloadingConfig || !selectedServer}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {downloadingConfig ? "Generating…" : "Generate Config File"}
            </button>
          ) : (
            <div className="space-y-3">
              <pre className="bg-black/60 border border-white/10 rounded-xl p-4 text-xs text-green-400/90 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {configText}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all"
                >
                  Download .conf
                </button>
                <button
                  onClick={handleCopyConfig}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/80 hover:bg-white/[0.05] transition-all font-medium"
                >
                  {configCopied ? "✓ Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setConfigText(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:bg-white/[0.05] transition-all"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade CTA */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white mb-1">Unlock the full platform</div>
            <div className="text-xs text-white/60">SIEM, threat intel, kill switch, split tunneling, and 60+ VPN nodes.</div>
          </div>
          <a
            href={`${BASE}/pricing`}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all whitespace-nowrap"
          >
            View Plans
          </a>
        </div>
      </div>
    </div>
  );
}
