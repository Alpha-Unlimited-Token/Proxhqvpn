import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle2, Search, Plus, Trash2,
  Globe, Lock, RefreshCw, Info, ShieldAlert, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

export default function DarkWebMonitor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newEmail, setNewEmail]         = useState("");
  const [checkEmail, setCheckEmail]     = useState("");
  const [checkResult, setCheckResult]   = useState<CheckResult | null>(null);
  const [expandedBreach, setExpanded]   = useState<string | null>(null);

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

  const totalBreaches = status?.totalBreaches ?? 0;
  const apiOk = status?.apiConfigured;

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
        <div className="flex gap-2">
          <Badge variant="outline" className={`text-xs font-mono ${totalBreaches > 0 ? "border-red-500/50 text-red-400" : "border-primary/30 text-primary/50"}`}>
            {totalBreaches} BREACH{totalBreaches !== 1 ? "ES" : ""}
          </Badge>
          <Badge variant="outline" className={`text-xs font-mono ${apiOk ? "border-primary/40 text-primary/60" : "border-yellow-500/40 text-yellow-400/70"}`}>
            {apiOk ? "HIBP LIVE" : "API KEY NEEDED"}
          </Badge>
        </div>
      </div>

      {/* API key notice */}
      {!apiOk && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-yellow-400">HIBP API KEY REQUIRED</span>
          </div>
          <p className="text-[11px] font-mono text-primary/50 leading-relaxed">
            Live dark web breach monitoring requires a Have I Been Pwned API key. Get your key at{" "}
            <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              haveibeenpwned.com/API/Key
            </a>, then add <code className="text-primary/70">HIBP_API_KEY</code> to your environment secrets.
          </p>
          <p className="text-[10px] font-mono text-primary/40">
            Without a key, breach checking returns simulated results for testing the UI.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Monitor list + add email */}
        <div className="space-y-4">
          {/* Monitored emails */}
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

            {/* Add email form */}
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

          {/* Quick check any email */}
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

          {/* Provider info */}
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

        {/* Right: Breach results */}
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

          {/* Stats */}
          {status && (
            <div className="border border-primary/20 bg-black p-4">
              <div className="text-[10px] font-mono text-primary/40 tracking-widest mb-3">MONITORING SUMMARY</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Emails", val: status.monitoredCount },
                  { label: "Breaches", val: status.totalBreaches },
                  { label: "Status", val: apiOk ? "Live" : "Demo" },
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
