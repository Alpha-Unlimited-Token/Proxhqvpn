// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, Search, Plus, Trash2,
  Globe, RefreshCw, ShieldAlert, Eye, Clock, Lock, Zap,
  KeyRound, ShieldCheck, XCircle, Info, Atom, Key,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";

const QA_BASE = import.meta.env.BASE_URL?.replace(/\/ghost-vpn\/?$/, "") ?? "";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api/darkweb${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

interface MonitoredEmail { email: string; addedAt: string; lastChecked: string | null; breachCount: number; }
interface HibpBreach { Name: string; Title: string; Domain: string; BreachDate: string; Description: string; DataClasses: string[]; IsVerified: boolean; PwnCount: number; }
interface StatusData {
  apiConfigured: boolean;
  monitoredCount: number;
  emails: MonitoredEmail[];
  totalBreaches: number;
  info: { provider: string; description: string; dataClasses: string[] };
}
interface CheckResult { email: string; breaches: HibpBreach[]; checkedAt: string; error?: string; }
interface SubData { subscription: { status: string } | null; isEmployee?: boolean; tier?: string | null; }
interface PwnedPassResult { pwned: boolean; count: number; error?: string; }

function PasswordChecker() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [result, setResult] = useState<PwnedPassResult | null>(null);

  const check = useMutation({
    mutationFn: (pw: string) => api("/pwned-password", { method: "POST", body: JSON.stringify({ password: pw }) }),
    onSuccess: (data: PwnedPassResult) => {
      setResult(data);
      if (data.error) toast({ title: "Check failed", description: data.error, variant: "destructive" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCheck = () => {
    if (!password) return;
    setResult(null);
    check.mutate(password);
  };

  return (
    <div className="border border-primary/20 bg-black p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[10px] font-mono text-primary/40 tracking-widest">PASSWORD BREACH CHECK</span>
        </div>
        <Badge variant="outline" className="text-[8px] font-mono border-primary/30 text-primary/50">FREE</Badge>
      </div>
      <p className="text-[10px] font-mono text-primary/35 leading-relaxed">
        Check if a password has been exposed in known data breaches.
        Your password is <span className="text-primary/60">never sent</span> — only an anonymous hash prefix is used.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCheck()}
            placeholder="Enter a password to check..."
            className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 pr-8 outline-none focus:border-primary/50"
          />
          <button
            onClick={() => setShowPass(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary/60 transition-colors text-[8px] font-mono"
          >
            {showPass ? "HIDE" : "SHOW"}
          </button>
        </div>
        <button
          onClick={handleCheck}
          disabled={!password || check.isPending}
          className="flex items-center gap-1 text-[9px] font-mono px-3 py-1.5 border border-primary/40 text-primary/70 hover:text-primary hover:border-primary/70 transition-colors disabled:opacity-40"
        >
          {check.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          CHECK
        </button>
      </div>

      {result && !result.error && (
        <div className={`border p-3 space-y-1 ${result.pwned ? "border-red-500/30 bg-red-500/5" : "border-primary/30 bg-primary/5"}`}>
          {result.pwned ? (
            <>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs font-mono font-bold text-red-400">PASSWORD COMPROMISED</span>
              </div>
              <p className="text-[10px] font-mono text-primary/50 leading-relaxed">
                This password has been seen{" "}
                <span className="text-red-400 font-bold">{result.count.toLocaleString()} times</span>{" "}
                in data breaches. Do not use this password anywhere.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {["Change this password immediately", "Never reuse passwords across sites", "Use a password manager"].map(r => (
                  <span key={r} className="text-[8px] font-mono px-1.5 py-0.5 border border-red-500/20 text-red-400/60">{r}</span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-mono font-bold text-primary">PASSWORD NOT FOUND IN BREACHES</span>
              </div>
              <p className="text-[10px] font-mono text-primary/40 leading-relaxed">
                Good news — this password hasn't appeared in any known data breach. Still,
                make sure it's unique and not reused across multiple accounts.
              </p>
            </>
          )}
        </div>
      )}

      {result?.error && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[10px] font-mono text-yellow-400/80">
          {result.error}
        </div>
      )}

      <div className="flex items-start gap-1.5 pt-1">
        <Info className="w-3 h-3 text-primary/25 shrink-0 mt-0.5" />
        <p className="text-[9px] font-mono text-primary/25 leading-relaxed">
          Uses HIBP Pwned Passwords k-anonymity API. Only the first 5 characters of a SHA-1 hash are
          transmitted — your actual password is never sent or stored.
        </p>
      </div>
    </div>
  );
}

function EmailGate({ isPaid, apiPending }: { isPaid: boolean; apiPending: boolean }) {
  const [, setLocation] = useLocation();

  if (!isPaid) {
    return (
      <div className="border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-yellow-400/70 shrink-0" />
          <span className="text-[10px] font-mono text-yellow-400/70 tracking-widest uppercase">Email Breach Checking — Paid Feature</span>
        </div>
        <p className="text-[11px] font-mono text-primary/45 leading-relaxed">
          Upgrade to check any email address against 13 billion+ compromised accounts across 700+ data
          breaches, add emails to continuous monitoring, and receive instant breach alerts.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {["Check any email against 700+ breaches", "Continuous dark web monitoring", "Full breach detail & data classes", "Instant remediation guidance"].map(f => (
            <div key={f} className="flex gap-1.5 text-[9px] font-mono text-primary/40">
              <span className="text-yellow-400/40 shrink-0">→</span> {f}
            </div>
          ))}
        </div>
        <button
          onClick={() => setLocation("/pricing")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black text-[10px] font-mono font-bold uppercase rounded hover:bg-primary/80 transition-colors"
        >
          <Zap className="w-3 h-3" /> Upgrade to Unlock
        </button>
      </div>
    );
  }

  if (apiPending) {
    return (
      <div className="border border-blue-400/25 bg-blue-400/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400 shrink-0 animate-pulse" />
          <span className="text-[10px] font-mono text-blue-400 tracking-widest uppercase">Email Monitoring — Pending Activation</span>
        </div>
        <p className="text-[11px] font-mono text-primary/50 leading-relaxed">
          Email breach checking is a <span className="text-primary/70 font-bold">newly added feature</span> included with your subscription.
          We are activating it on our end — this typically takes{" "}
          <span className="text-blue-400 font-bold">2 to 3 hours</span>, but may take up to{" "}
          <span className="text-blue-400 font-bold">24 to 48 hours</span>.
          No action is needed from you.
        </p>
        <div className="text-[9px] font-mono text-primary/30 border-t border-primary/10 pt-3">
          If this has not activated after 48 hours, contact ProxhqVPN support. Your subscription is active
          and you will not be charged for any delay.
        </div>
      </div>
    );
  }

  return null;
}

function BreachDatabase() {
  const { data, isLoading } = useQuery({
    queryKey: ["breach-list"],
    queryFn: () => api("/breaches"),
    staleTime: 1000 * 60 * 60,
  });

  const breaches: any[] = data?.breaches ?? [];

  return (
    <div className="border border-primary/15 bg-black p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-primary/50" />
          <span className="text-[10px] font-mono text-primary/40 tracking-widest">KNOWN BREACH DATABASE</span>
        </div>
        {data?.count && (
          <Badge variant="outline" className="text-[8px] font-mono border-primary/20 text-primary/40">
            {data.count} BREACHES
          </Badge>
        )}
      </div>
      <p className="text-[9px] font-mono text-primary/30 leading-relaxed">
        Browse all publicly known data breaches tracked by Have I Been Pwned.
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-primary/30 text-[9px] font-mono">
          <RefreshCw className="w-3 h-3 animate-spin" /> Loading breach database...
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-auto">
          {breaches.slice(0, 20).map((b: any) => (
            <div key={b.name} className="flex items-center justify-between gap-2 py-1 border-b border-primary/5">
              <div className="min-w-0">
                <div className="text-[9px] font-mono text-primary/60 truncate">{b.title}</div>
                <div className="text-[8px] font-mono text-primary/25">{b.domain} · {b.date}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[8px] font-mono text-primary/35">{(b.pwnCount / 1_000_000).toFixed(1)}M pwned</div>
                {b.verified && <div className="text-[7px] font-mono text-primary/25">verified</div>}
              </div>
            </div>
          ))}
          {breaches.length > 20 && (
            <div className="text-[8px] font-mono text-primary/25 text-center pt-1">
              +{breaches.length - 20} more breaches in database
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BlockchainWalletsPanel() {
  const [qa, setQa] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${QA_BASE}/api/quantum-audit/cc-summary`, { credentials: "include" });
        if (r.ok) setQa(await r.json());
      } catch { /* best-effort */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!qa) return null;
  const keyFindings = (qa.recentFindings ?? []).filter((f: any) => f.hasKey);
  const hasAnyData = qa.signatures?.addresses > 0 || keyFindings.length > 0;
  if (!hasAnyData) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-primary/10" />
        <span className="text-[9px] font-mono text-cyan-400/50 tracking-widest px-2 flex items-center gap-1">
          <Atom className="w-2.5 h-2.5" /> BLOCKCHAIN COMPROMISED WALLETS · QUANTUMAUDIT
        </span>
        <div className="h-px flex-1 bg-primary/10" />
      </div>

      <div className="border border-cyan-500/20 bg-black p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Atom className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-400/70 tracking-widest uppercase">On-Chain Wallet Exposure</span>
          </div>
          <div className="flex gap-2">
            {keyFindings.length > 0 && (
              <Badge variant="outline" className="text-[8px] font-mono border-red-500/40 text-red-400">
                {keyFindings.length} KEYS COMPROMISED
              </Badge>
            )}
            <Badge variant="outline" className="text-[8px] font-mono border-cyan-400/30 text-cyan-400/60">
              {qa.signatures?.addresses ?? 0} WALLETS INDEXED
            </Badge>
          </div>
        </div>

        <p className="text-[10px] font-mono text-primary/35 leading-relaxed">
          QuantumAudit continuously mines blockchain transaction signatures to detect cryptographic vulnerabilities.
          Wallets below were found with exploitable ECDSA properties across {Object.keys(qa.chains ?? {}).length} chains.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Wallets Indexed", value: qa.signatures?.addresses ?? 0, color: "text-cyan-400" },
            { label: "ECDSA Sigs", value: qa.signatures?.totalSigs ?? 0, color: "text-primary/60" },
            { label: "Scan Progress", value: `${qa.progress?.pct ?? 0}%`, color: "text-orange-400" },
            { label: "Keys Recovered", value: qa.keys?.recovered ?? 0, color: (qa.keys?.recovered ?? 0) > 0 ? "text-red-400" : "text-primary/20" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border border-primary/10 p-2 text-center">
              <div className={`text-base font-bold font-mono ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
              <div className="text-[9px] font-mono text-primary/30 uppercase">{label}</div>
            </div>
          ))}
        </div>

        {keyFindings.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-red-400/70 font-bold flex items-center gap-1.5">
              <Key className="w-3 h-3" /> Wallets with Recovered Private Keys
            </div>
            {keyFindings.slice(0, 5).map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-2 border border-red-500/15 bg-red-900/5 px-2 py-1.5 text-[10px] font-mono">
                <Key className="w-2.5 h-2.5 text-red-400 shrink-0" />
                <span className="text-red-400/80 font-bold uppercase text-[9px] border border-red-400/20 px-1">{f.kind}</span>
                <span className="text-primary/50 truncate flex-1">{f.detail}</span>
                {f.address && <span className="text-primary/30 text-[9px] font-mono shrink-0">{f.address.slice(0, 10)}…</span>}
              </div>
            ))}
            <div className="text-[9px] font-mono text-red-400/40 pl-1 leading-relaxed">
              These wallets should be considered fully compromised — any funds are at immediate risk of theft.
            </div>
          </div>
        )}

        {Object.keys(qa.chains ?? {}).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-primary/8">
            <span className="text-[9px] font-mono text-primary/30 self-center">Chains active:</span>
            {Object.entries(qa.chains).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6).map(([chain, n]) => (
              <span key={chain} className="text-[9px] font-mono border border-cyan-500/20 text-cyan-400/60 px-1.5 py-0.5 capitalize">{chain} ({n as number})</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DarkWebMonitor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newEmail, setNewEmail]         = useState("");
  const [checkEmail, setCheckEmail]     = useState("");
  const [checkResult, setCheckResult]   = useState<CheckResult | null>(null);
  const [expandedBreach, setExpanded]   = useState<string | null>(null);

  const { data: sub, isLoading: subLoading } = useQuery<SubData>({
    queryKey: ["subscription"],
    queryFn: () => fetch(`${BASE}/api/stripe/subscription`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: status } = useQuery<StatusData>({
    queryKey: ["darkweb-status"],
    queryFn: () => api("/status"),
    refetchInterval: 60000,
  });

  const addEmail = useMutation({
    mutationFn: (email: string) => api("/monitor", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["darkweb-status"] }); setNewEmail(""); toast({ title: "Email Added to Monitoring" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeEmail = useMutation({
    mutationFn: (email: string) => api(`/monitor/${encodeURIComponent(email)}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["darkweb-status"] }); toast({ title: "Email Removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checkBreach = useMutation({
    mutationFn: (email: string) => api("/check", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: (data: CheckResult) => {
      setCheckResult(data);
      qc.invalidateQueries({ queryKey: ["darkweb-status"] });
      if (data.error) {
        toast({ title: "Check incomplete", description: data.error, variant: "destructive" });
      } else if (data.breaches.length === 0) {
        toast({ title: "No breaches found", description: `${data.email} was not found in any known breaches.` });
      } else {
        toast({ title: `${data.breaches.length} breach${data.breaches.length > 1 ? "es" : ""} found!`, description: `${data.email} was exposed in ${data.breaches.length} data breach${data.breaches.length > 1 ? "es" : ""}`, variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-2 text-primary/40 font-mono text-xs">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
        </div>
      </div>
    );
  }

  const isPaid = sub?.subscription?.status === "active" || sub?.subscription?.status === "trialing" || !!sub?.isEmployee;
  const apiOk  = !!status?.apiConfigured;
  const totalBreaches = status?.totalBreaches ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Eye className="w-6 h-6" /> Dark Web Monitor
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Scan the dark web for leaked credentials tied to your email addresses
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isPaid && apiOk && (
            <Badge variant="outline" className={`text-xs font-mono ${totalBreaches > 0 ? "border-red-500/50 text-red-400" : "border-primary/30 text-primary/50"}`}>
              {totalBreaches} BREACH{totalBreaches !== 1 ? "ES" : ""}
            </Badge>
          )}
          <Badge variant="outline" className={`text-xs font-mono ${isPaid && apiOk ? "border-primary/40 text-primary/60" : isPaid ? "border-blue-400/40 text-blue-400/70" : "border-yellow-500/30 text-yellow-400/60"}`}>
            {isPaid && apiOk ? "HIBP LIVE" : isPaid ? "ACTIVATING" : "FREE TIER"}
          </Badge>
        </div>
      </div>

      {/* FREE SECTION — available to all users */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 pb-1">
          <div className="h-px flex-1 bg-primary/10" />
          <span className="text-[9px] font-mono text-primary/30 tracking-widest px-2">FREE FOR ALL USERS</span>
          <div className="h-px flex-1 bg-primary/10" />
        </div>
        <PasswordChecker />
        <div className="pt-2">
          <BreachDatabase />
        </div>
      </div>

      {/* PAID SECTION — email breach checking */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-primary/10" />
          <span className="text-[9px] font-mono text-primary/30 tracking-widest px-2">EMAIL BREACH MONITORING</span>
          <div className="h-px flex-1 bg-primary/10" />
        </div>

        {(!isPaid || !apiOk) && (
          <EmailGate isPaid={isPaid} apiPending={isPaid && !apiOk} />
        )}

        {isPaid && apiOk && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left col */}
            <div className="space-y-4">
              <div className="border border-primary/20 bg-black p-4 space-y-3">
                <div className="text-[10px] font-mono text-primary/40 tracking-widest">MONITORED EMAILS ({status?.monitoredCount ?? 0})</div>
                {status?.emails.length ? (
                  <div className="space-y-2">
                    {status.emails.map(e => (
                      <div key={e.email} className="flex items-center gap-2 group">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-primary truncate">{e.email}</div>
                          <div className="flex gap-2 text-[9px] font-mono text-primary/30">
                            <span>{e.lastChecked ? `checked ${format(new Date(e.lastChecked), "MM/dd HH:mm")}` : "never checked"}</span>
                            {e.breachCount > 0 && <span className="text-red-400">{e.breachCount} breach{e.breachCount > 1 ? "es" : ""}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => { setCheckEmail(e.email); checkBreach.mutate(e.email); }}
                          className="shrink-0 text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/20 hover:border-primary/50 px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100">
                          CHECK
                        </button>
                        <button
                          onClick={() => removeEmail.mutate(e.email)}
                          className="shrink-0 text-primary/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-primary/25 py-3 text-center">No emails monitored yet</div>
                )}
                <div className="flex gap-2 pt-2 border-t border-primary/10">
                  <input
                    value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="add@example.com"
                    onKeyDown={e => e.key === "Enter" && newEmail && addEmail.mutate(newEmail)}
                    className="flex-1 bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 outline-none focus:border-primary/50"
                  />
                  <button onClick={() => newEmail && addEmail.mutate(newEmail)}
                    disabled={!newEmail || addEmail.isPending}
                    className="flex items-center gap-1 text-[9px] font-mono px-2 py-1.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors disabled:opacity-40">
                    <Plus className="w-3 h-3" /> ADD
                  </button>
                </div>
              </div>

              <div className="border border-primary/20 bg-black p-4 space-y-3">
                <div className="text-[10px] font-mono text-primary/40 tracking-widest">CHECK ANY EMAIL</div>
                <div className="flex gap-2">
                  <input
                    value={checkEmail} onChange={e => setCheckEmail(e.target.value)}
                    placeholder="check@example.com"
                    onKeyDown={e => e.key === "Enter" && checkEmail && checkBreach.mutate(checkEmail)}
                    className="flex-1 bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={() => checkEmail && checkBreach.mutate(checkEmail)}
                    disabled={!checkEmail || checkBreach.isPending}
                    className="flex items-center gap-1 text-[9px] font-mono px-3 py-1.5 border border-primary/40 text-primary/70 hover:text-primary hover:border-primary/70 transition-colors disabled:opacity-40">
                    {checkBreach.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    SCAN
                  </button>
                </div>
              </div>
            </div>

            {/* Right col */}
            <div className="space-y-4">
              {checkResult ? (
                <div className="border border-primary/20 bg-black p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono text-primary/40 tracking-widest">SCAN RESULTS</div>
                    <button onClick={() => setCheckResult(null)} className="text-[9px] font-mono text-primary/30 hover:text-primary">CLEAR</button>
                  </div>
                  <div className="text-[10px] font-mono text-primary truncate">{checkResult.email}</div>

                  {checkResult.error && (
                    <div className="border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[10px] font-mono text-yellow-400/80">
                      {checkResult.error}
                    </div>
                  )}

                  {!checkResult.error && checkResult.breaches.length === 0 && (
                    <div className="flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-3">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs font-mono text-primary">No breaches found</div>
                        <div className="text-[9px] font-mono text-primary/40">This email was not found in any known data breaches</div>
                      </div>
                    </div>
                  )}

                  {checkResult.breaches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="text-[10px] font-mono text-red-400 font-bold">{checkResult.breaches.length} BREACH{checkResult.breaches.length > 1 ? "ES" : ""} DETECTED</span>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-auto">
                        {checkResult.breaches.map(b => (
                          <div key={b.Name} className="border border-red-500/20 bg-red-500/5">
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 text-left"
                              onClick={() => setExpanded(expandedBreach === b.Name ? null : b.Name)}
                            >
                              <div className="min-w-0">
                                <div className="text-[10px] font-mono font-bold text-red-300">{b.Title}</div>
                                <div className="text-[9px] font-mono text-primary/40">{b.Domain} · {b.BreachDate}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] font-mono text-red-400/60">{b.PwnCount?.toLocaleString() ?? "?"} pwned</span>
                                {b.IsVerified && <span className="text-[8px] border border-red-500/30 text-red-400/50 px-1">VERIFIED</span>}
                              </div>
                            </button>
                            {expandedBreach === b.Name && (
                              <div className="px-3 pb-3 space-y-2 border-t border-red-500/15">
                                <p className="text-[10px] font-mono text-primary/40 leading-relaxed mt-2"
                                  dangerouslySetInnerHTML={{ __html: b.Description.replace(/<[^>]*>/g, "") }} />
                                <div className="flex flex-wrap gap-1">
                                  {b.DataClasses.map(c => (
                                    <span key={c} className="text-[8px] font-mono px-1.5 py-0.5 border border-red-500/20 text-red-400/50">{c}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-1.5">
                        <div className="text-[9px] font-mono text-yellow-400 font-bold">RECOMMENDED ACTIONS</div>
                        {["Change passwords for all affected accounts immediately", "Enable two-factor authentication everywhere", "Check if you reused these passwords on other services", "Use a unique password manager-generated password"].map(a => (
                          <div key={a} className="text-[9px] font-mono text-primary/40 flex gap-1.5">
                            <span className="text-yellow-400/60 shrink-0">→</span> {a}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {checkResult.checkedAt && (
                    <div className="text-[9px] font-mono text-primary/25 text-right">
                      Checked {format(new Date(checkResult.checkedAt), "HH:mm:ss")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-primary/10 bg-black p-8 flex flex-col items-center justify-center gap-3 text-center h-full min-h-32">
                  <Eye className="w-8 h-8 text-primary/20" />
                  <div className="text-[10px] font-mono text-primary/30 uppercase tracking-widest">Scan an email to see breach results</div>
                  <div className="text-[9px] font-mono text-primary/20">Results include breach name, date, and exposed data types</div>
                </div>
              )}

              <div className="border border-primary/20 bg-black p-4">
                <div className="text-[10px] font-mono text-primary/40 tracking-widest mb-3">MONITORING SUMMARY</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Emails", val: status?.monitoredCount ?? 0 },
                    { label: "Breaches", val: status?.totalBreaches ?? 0 },
                    { label: "Status", val: "Live" },
                  ].map(s => (
                    <div key={s.label} className="border border-primary/10 p-2 text-center">
                      <div className={`text-sm font-mono font-bold ${s.label === "Breaches" && (s.val as number) > 0 ? "text-red-400" : "text-primary"}`}>{s.val}</div>
                      <div className="text-[9px] font-mono text-primary/30">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BlockchainWalletsPanel />
    </div>
  );
}
