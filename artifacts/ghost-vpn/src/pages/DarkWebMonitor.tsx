import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, Search, Plus, Trash2,
  Globe, RefreshCw, ShieldAlert, Eye, Clock, Lock, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";

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

function UpgradeGate() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Eye className="w-6 h-6" /> Dark Web Monitor
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Scan the dark web for leaked credentials tied to your email addresses
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-yellow-500/40 text-yellow-400/70">
          PAID FEATURE
        </Badge>
      </div>

      <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-sm font-mono font-bold text-yellow-400 uppercase tracking-widest">Subscription Required</span>
        </div>
        <p className="text-[12px] font-mono text-primary/60 leading-relaxed">
          Dark Web Monitor scans over 13 billion compromised accounts across 700+ data breaches to check
          if your email addresses have been exposed. This feature is included with all paid ProxhqVPN plans.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[
            { label: "13B+", desc: "Compromised accounts" },
            { label: "700+", desc: "Known data breaches" },
            { label: "Real-Time", desc: "Breach alerts" },
          ].map(s => (
            <div key={s.label} className="border border-primary/15 bg-black p-3 text-center">
              <div className="text-lg font-mono font-bold text-primary">{s.label}</div>
              <div className="text-[9px] font-mono text-primary/35 mt-1">{s.desc}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setLocation("/pricing")}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-black text-xs font-mono font-bold uppercase rounded hover:bg-primary/80 transition-colors mt-2"
        >
          <Zap className="w-3.5 h-3.5" /> Upgrade to Unlock
        </button>
      </div>

      <div className="border border-primary/10 p-4 space-y-2">
        <div className="text-[10px] font-mono text-primary/40 tracking-widest">WHAT YOU GET WITH A PLAN</div>
        {[
          "Continuous dark web monitoring for unlimited emails",
          "Instant breach alerts with full breach details",
          "Exposed data class breakdown (passwords, cards, IDs, etc.)",
          "Remediation guidance for each breach",
          "Access to 700+ breach database history",
        ].map(f => (
          <div key={f} className="flex gap-2 text-[10px] font-mono text-primary/45">
            <CheckCircle2 className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" /> {f}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingActivation() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Eye className="w-6 h-6" /> Dark Web Monitor
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Scan the dark web for leaked credentials tied to your email addresses
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-blue-400/40 text-blue-400/70 animate-pulse">
          ACTIVATING
        </Badge>
      </div>

      <div className="border border-blue-400/30 bg-blue-400/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-400 shrink-0 animate-pulse" />
          <span className="text-sm font-mono font-bold text-blue-400 uppercase tracking-widest">New Feature — Pending Activation</span>
        </div>
        <div className="space-y-3 text-[12px] font-mono text-primary/60 leading-relaxed">
          <p>
            <span className="text-primary/80 font-bold">Dark Web Monitor</span> is a newly added feature on ProxhqVPN
            and your subscription includes full access.
          </p>
          <p>
            We are in the process of activating this feature on our end. This typically completes within
            <span className="text-blue-400 font-bold"> 2 to 3 hours</span>, but may take up to
            <span className="text-blue-400 font-bold"> 24 to 48 hours</span> in some cases.
          </p>
          <p>
            No action is required from you — once activation is complete this page will automatically unlock
            and you will have full access to real-time dark web breach scanning for all your email addresses.
          </p>
        </div>

        <div className="border border-blue-400/20 bg-black p-4 space-y-2 mt-2">
          <div className="text-[9px] font-mono text-primary/30 tracking-widest">WHAT TO EXPECT AFTER ACTIVATION</div>
          {[
            "Enter any email address and instantly check against 13B+ compromised accounts",
            "Add emails to continuous monitoring — get alerted on new breaches",
            "See exactly what data was exposed in each breach",
            "Actionable steps to secure compromised accounts",
          ].map(f => (
            <div key={f} className="flex gap-2 text-[10px] font-mono text-primary/40">
              <span className="text-blue-400/50 shrink-0">→</span> {f}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-primary/10 p-4">
        <div className="text-[10px] font-mono text-primary/30 leading-relaxed">
          If this feature has not activated after 48 hours, please contact ProxhqVPN support. Your subscription
          is active and you will not be charged for any delay period.
        </div>
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

  const isActive = sub?.subscription?.status === "active" || sub?.subscription?.status === "trialing" || sub?.isEmployee;

  if (!isActive) return <UpgradeGate />;

  const apiOk = status?.apiConfigured;

  if (!apiOk) return <PendingActivation />;

  const totalBreaches = status?.totalBreaches ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Eye className="w-6 h-6" /> Dark Web Monitor
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Scan the dark web for leaked credentials tied to your email addresses
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className={`text-xs font-mono ${totalBreaches > 0 ? "border-red-500/50 text-red-400" : "border-primary/30 text-primary/50"}`}>
            {totalBreaches} BREACH{totalBreaches !== 1 ? "ES" : ""}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary/60">
            HIBP LIVE
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="border border-primary/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-primary/40 tracking-widest">
              <Globe className="w-3.5 h-3.5" /> DATA SOURCE
            </div>
            <div className="text-[10px] font-mono text-primary/60 font-semibold">{status?.info.provider}</div>
            <p className="text-[10px] font-mono text-primary/35 leading-relaxed">{status?.info.description}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {status?.info.dataClasses.map(c => (
                <span key={c} className="text-[8px] font-mono px-1.5 py-0.5 border border-primary/20 text-primary/30">{c}</span>
              ))}
            </div>
          </div>
        </div>

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
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-[10px] font-mono font-bold text-red-300">{b.Title}</div>
                              <div className="text-[9px] font-mono text-primary/40">{b.Domain} · {b.BreachDate}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-mono text-red-400/60">{b.PwnCount?.toLocaleString() ?? "?"} pwned</span>
                            {b.IsVerified && <span className="text-[8px] border border-red-500/30 text-red-400/50 px-1">VERIFIED</span>}
                          </div>
                        </button>
                        {expandedBreach === b.Name && (
                          <div className="px-3 pb-3 space-y-2 border-t border-red-500/15">
                            <p className="text-[10px] font-mono text-primary/40 leading-relaxed mt-2" dangerouslySetInnerHTML={{ __html: b.Description.replace(/<[^>]*>/g, "") }} />
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
                    {["Change passwords for all affected accounts immediately", "Enable two-factor authentication everywhere", "Check if you reused these passwords on other services", "Consider using a unique password manager-generated password"].map(a => (
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
            <div className="border border-primary/10 bg-black p-8 flex flex-col items-center justify-center gap-3 text-center">
              <Eye className="w-8 h-8 text-primary/20" />
              <div className="text-[10px] font-mono text-primary/30 uppercase tracking-widest">Scan an email to see breach results</div>
              <div className="text-[9px] font-mono text-primary/20">Results include breach name, date, and exposed data types</div>
            </div>
          )}

          {status && (
            <div className="border border-primary/20 bg-black p-4">
              <div className="text-[10px] font-mono text-primary/40 tracking-widest mb-3">MONITORING SUMMARY</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Emails", val: status.monitoredCount },
                  { label: "Breaches", val: status.totalBreaches },
                  { label: "Status", val: "Live" },
                ].map(s => (
                  <div key={s.label} className="border border-primary/10 p-2 text-center">
                    <div className={`text-sm font-mono font-bold ${s.label === "Breaches" && (s.val as number) > 0 ? "text-red-400" : "text-primary"}`}>{s.val}</div>
                    <div className="text-[9px] font-mono text-primary/30">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
