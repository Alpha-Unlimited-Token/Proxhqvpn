// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAnonAuth } from "@/hooks/useAnonAuth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function formatNumber(raw: string): string {
  return raw.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export default function AnonAuth() {
  const [, setLocation] = useLocation();
  const { signIn } = useAnonAuth();

  const [tab, setTab] = useState<"create" | "login">("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create state
  const [created, setCreated] = useState<{ number: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Login state
  const [loginInput, setLoginInput] = useState("");

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/anon/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to create account");
      }
      const data = await r.json();
      setCreated({ number: data.accountNumber, expiresAt: data.expiresAt });
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAfterCreate = async () => {
    if (!created) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/anon/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: created.number }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Auth failed");
      }
      const data = await r.json();
      signIn(data.token, created.number, data.expiresAt);
      setLocation("/anon");
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const clean = loginInput.replace(/\s/g, "");
    if (!/^\d{16}$/.test(clean)) {
      setError("Enter your 16-digit account number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/anon/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: clean }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Account not found");
      }
      const data = await r.json();
      signIn(data.token, clean, data.expiresAt);
      setLocation("/anon");
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!created) return;
    const formatted = formatNumber(created.number);
    const text = `ProxhqVPN Anonymous Account\n\nAccount Number: ${formatted}\nExpires: ${new Date(created.expiresAt).toLocaleDateString()}\n\nKEEP THIS NUMBER SAFE.\nThere is no recovery option. No email. No password.\nThis number is your only key.\n\n© ALPHA UNLIMITED TECHNOLOGIES LLC`;
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "proxhqvpn-account.txt";
    a.click();
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 bg-gradient-to-b from-[#0d1610] to-[#080d09] border-r border-white/[0.06] p-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <img src={`${BASE}/icon-final2.png`} alt="" className="w-7 h-7" />
          </div>
          <span className="text-lg font-bold text-white">ProxhqVPN</span>
        </div>
        <div className="space-y-6">
          {[
            "No email required",
            "No personal data collected",
            "Just a 16-digit number",
            "Mullvad-style privacy model",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
              <span className="text-sm text-white/88">{f}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-white/70">© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo mobile */}
          <div className="text-center lg:hidden mb-2">
            <img src={`${BASE}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>

          {/* Back link */}
          <a
            href={`${BASE}/sign-in`}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors w-fit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to sign in
          </a>

          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Anonymous Account</h1>
            <p className="text-sm text-white/60">No email. No password. Just a number.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
            {(["create", "login"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setCreated(null); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab === t
                    ? "bg-primary text-black"
                    : "text-white/60 hover:text-white/90"
                }`}
              >
                {t === "create" ? "Create Account" : "Sign In"}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Create tab ── */}
          {tab === "create" && (
            <div className="space-y-4">
              {!created ? (
                <>
                  <p className="text-sm text-white/70 leading-relaxed">
                    We generate a random 16-digit account number. Save it — it's your only credential.
                    Includes a <span className="text-primary font-medium">30-day free trial</span>.
                  </p>
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {loading ? "Generating…" : "Generate Account Number"}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Number display */}
                  <div className="bg-white/[0.04] border border-primary/30 rounded-2xl p-6 text-center">
                    <div className="text-xs text-primary/70 uppercase tracking-widest mb-3 font-mono">
                      Your Account Number
                    </div>
                    <div className="text-2xl font-mono font-bold text-white tracking-widest select-all">
                      {formatNumber(created.number)}
                    </div>
                    <div className="text-xs text-white/40 mt-3">
                      Trial expires {new Date(created.expiresAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-amber-300/90 leading-relaxed">
                      Save this number. There is no email recovery, no password reset, no support ticket that can restore it.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/80 hover:bg-white/[0.05] transition-all font-medium"
                    >
                      {copied ? "✓ Copied" : "Copy Number"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/80 hover:bg-white/[0.05] transition-all font-medium"
                    >
                      Download .txt
                    </button>
                  </div>

                  <button
                    onClick={handleContinueAfterCreate}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {loading ? "Connecting…" : "Continue →"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Login tab ── */}
          {tab === "login" && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">Enter the 16-digit number from your account.</p>
              <div className="space-y-2">
                <label className="text-xs text-white/50 uppercase tracking-wider font-mono">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  value={loginInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                    setLoginInput(formatNumber(raw).trim());
                  }}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-mono tracking-widest placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading || loginInput.replace(/\s/g, "").length !== 16}
                className="w-full py-3 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
