// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useLocation } from "wouter";
import { useAnonAuth, getAnonToken } from "@/hooks/useAnonAuth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Plan = "monthly" | "annual";
type Currency = "BTC" | "ETH";

interface Invoice {
  invoiceId: string;
  currency: Currency;
  address: string;
  amountCrypto: string;
  amountUsd: string;
  durationDays: number;
  expiresAt: string;
  note: string;
}

export default function AnonUpgrade() {
  const [, setLocation] = useLocation();
  const { accountNumber, daysRemaining, isLoggedIn } = useAnonAuth();

  const [plan, setPlan] = useState<Plan>("monthly");
  const [currency, setCurrency] = useState<Currency>("BTC");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [amtCopied, setAmtCopied] = useState(false);

  if (!isLoggedIn) {
    setLocation("/anon-auth");
    return null;
  }

  const handleCreateInvoice = async () => {
    setLoading(true);
    setError(null);
    setInvoice(null);
    try {
      const token = getAnonToken();
      const r = await fetch(`${BASE}/api/anon/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, currency }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to create invoice");
      setInvoice(data);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!invoice || !txHash.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const token = getAnonToken();
      const r = await fetch(`${BASE}/api/anon/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceId: invoice.invoiceId, txHash: txHash.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Verification failed");
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setVerifying(false);
    }
  };

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  if (confirmed && invoice) {
    return (
      <div className="min-h-[100dvh] bg-[#080d09] flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Submitted</h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Your transaction hash has been recorded. Subscription will be extended after on-chain verification
              (typically within 1–3 hours).
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Duration</span>
              <span className="text-white font-medium">{invoice.durationDays === 365 ? "1 year" : "30 days"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Currency</span>
              <span className="text-white font-medium">{invoice.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Amount</span>
              <span className="text-primary font-mono font-medium">{invoice.amountCrypto} {invoice.currency}</span>
            </div>
          </div>
          <button
            onClick={() => setLocation("/anon")}
            className="w-full py-3 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#080d09] text-white">
      <header className="border-b border-white/[0.06] bg-[#0a0f0b]/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/anon")} className="text-white/40 hover:text-white/80 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-bold text-white">Renew Subscription</span>
          <span className="text-xs bg-primary/15 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-mono">ANON</span>
        </div>
        <div className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
          daysRemaining > 7 ? "text-green-400 bg-green-400/10 border-green-400/20"
          : daysRemaining > 0 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
          : "text-red-400 bg-red-400/10 border-red-400/20"
        }`}>
          {daysRemaining > 0 ? `${daysRemaining}d left` : "Expired"}
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 py-10 space-y-6">
        {/* Privacy note */}
        <div className="flex gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-white/70 leading-relaxed">
            <span className="text-primary font-semibold">100% anonymous.</span> No email, no name, no account required. Pay in crypto and stay private. Your 16-digit account number is the only link.
          </p>
        </div>

        {/* Account info */}
        {accountNumber && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
            <div className="text-xs text-white/40 uppercase tracking-widest font-mono mb-1">Account</div>
            <div className="font-mono text-sm text-white tracking-widest">{accountNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}</div>
          </div>
        )}

        {!invoice ? (
          <>
            {/* Plan selector */}
            <div className="space-y-2">
              <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Plan</div>
              <div className="grid grid-cols-2 gap-2">
                {(["monthly", "annual"] as Plan[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`px-4 py-4 rounded-xl border text-left transition-all ${
                      plan === p ? "bg-primary/10 border-primary/40" : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white capitalize">{p === "monthly" ? "30 Days" : "1 Year"}</div>
                    <div className="text-xl font-bold text-primary mt-1">
                      {p === "monthly" ? "$6.99" : "$59.99"}
                    </div>
                    {p === "annual" && (
                      <div className="text-xs text-green-400 mt-0.5">Save 28%</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency selector */}
            <div className="space-y-2">
              <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Currency</div>
              <div className="grid grid-cols-2 gap-2">
                {(["BTC", "ETH"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-3 rounded-xl border flex items-center gap-3 transition-all ${
                      currency === c ? "bg-primary/10 border-primary/40" : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="text-2xl">{c === "BTC" ? "₿" : "Ξ"}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{c}</div>
                      <div className="text-xs text-white/40">{c === "BTC" ? "Bitcoin" : "Ethereum"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            <button
              onClick={handleCreateInvoice}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? "Generating Invoice…" : `Generate ${currency} Payment Address`}
            </button>
          </>
        ) : (
          <>
            {/* Invoice */}
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-primary/20 rounded-2xl p-5 space-y-4">
                <div className="text-xs text-primary/70 uppercase tracking-widest font-mono text-center">
                  Send Exactly
                </div>
                <div className="text-center">
                  <div className="text-2xl font-mono font-bold text-primary select-all">{invoice.amountCrypto}</div>
                  <div className="text-sm text-white/50 mt-1">{invoice.currency} ≈ ${invoice.amountUsd}</div>
                </div>
                <button
                  onClick={() => copy(invoice.amountCrypto, setAmtCopied)}
                  className="w-full py-2 rounded-xl border border-primary/20 text-primary text-xs font-medium hover:bg-primary/5 transition-all"
                >
                  {amtCopied ? "✓ Amount Copied" : "Copy Amount"}
                </button>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-3">
                <div className="text-xs text-white/50 uppercase tracking-widest font-mono">
                  {invoice.currency} Deposit Address
                </div>
                <div className="font-mono text-xs text-white/80 break-all bg-black/40 rounded-xl p-3 border border-white/10 select-all">
                  {invoice.address}
                </div>
                <button
                  onClick={() => copy(invoice.address, setAddrCopied)}
                  className="w-full py-2 rounded-xl border border-white/10 text-white/70 text-xs font-medium hover:bg-white/[0.05] transition-all"
                >
                  {addrCopied ? "✓ Address Copied" : "Copy Address"}
                </button>
              </div>

              <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.948-13.748c.866-1.5 3.032-1.5 3.898 0l7.908 13.748zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  Send <strong>exactly</strong> the amount shown — the precise amount fingerprints your payment. Invoice expires in 2 hours.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-white/50 uppercase tracking-wider font-mono">Transaction Hash (after sending)</div>
                <input
                  type="text"
                  placeholder="0xabc123... or txid..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying || !txHash.trim()}
                className="w-full py-3.5 rounded-xl bg-primary text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {verifying ? "Submitting…" : "Submit Transaction Hash"}
              </button>

              <button
                onClick={() => { setInvoice(null); setError(null); setTxHash(""); }}
                className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/[0.05] transition-all"
              >
                ← Change Plan or Currency
              </button>
            </div>
          </>
        )}

        {/* Plan comparison */}
        {!invoice && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 space-y-3">
            <div className="text-xs text-white/50 uppercase tracking-wider font-mono">What you get</div>
            {[
              "WireGuard double-hop configuration",
              "4 VPN nodes: LA, London, Chicago, Tokyo",
              "No logs. No email. No identity.",
              "DNS leak protection",
              "Kill switch support",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
