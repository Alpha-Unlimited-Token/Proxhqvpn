// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database, Loader2, AlertTriangle, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Copy, Shield, Clock, Hash, Search, Zap, List,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include", ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) {
    const msg = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(msg.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

function RiskBadge({ risk }: { risk: string }) {
  const s = risk === "critical" ? "border-red-400/40 bg-red-900/15 text-red-400"
    : risk === "high" ? "border-orange-400/40 bg-orange-900/15 text-orange-400"
    : risk === "medium" ? "border-yellow-400/40 bg-yellow-900/10 text-yellow-400"
    : risk === "none" ? "border-[#00ff88]/30 bg-[#00ff88]/5 text-[#00ff88]"
    : "border-primary/20 text-primary/40";
  return <span className={`text-[9px] font-bold uppercase border px-2 py-0.5 font-mono tracking-widest ${s}`}>{risk}</span>;
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  const c = confidence === "confirmed" ? "text-red-400" : confidence === "likely" ? "text-orange-400" : "text-yellow-400";
  return <span className={`text-[9px] font-mono font-bold uppercase ${c}`}>{confidence}</span>;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "error_based") return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  if (type === "boolean_blind") return <Hash className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
  if (type === "time_based") return <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
  return <Search className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
}

function TypeLabel({ type }: { type: string }) {
  return <span className="text-[9px] font-mono uppercase border border-current/30 px-1.5 py-0.5 bg-current/5">
    {type.replace(/_/g, " ")}
  </span>;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-primary/10 rounded-sm overflow-hidden">
      <button className="w-full flex items-center gap-2 p-3 bg-primary/3 hover:bg-primary/5 transition-colors text-left" onClick={() => setOpen(o => !o)}>
        <Icon className="w-3.5 h-3.5 text-[#00ff88]" />
        <span className="text-xs font-bold text-primary uppercase tracking-wide flex-1">{title}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-primary/30 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="p-3 pt-2 text-xs font-mono space-y-2">{children}</div>}
    </div>
  );
}

export default function SqliScanner() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [customParams, setCustomParams] = useState("");
  const [checks, setChecks] = useState({
    errorBased: true,
    booleanBlind: true,
    timeBased: true,
    union: true,
  });
  const [result, setResult] = useState<any>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

  const scanMut = useMutation({
    mutationFn: () => {
      const params = customParams.trim()
        ? customParams.split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      return apiFetch("/sqli-scanner/scan", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), params, checks }),
      });
    },
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => toast({ title: "Scan failed", description: err.message, variant: "destructive" }),
  });

  const toggleFinding = (i: number) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const typeColor: Record<string, string> = {
    error_based: "text-red-400",
    boolean_blind: "text-orange-400",
    time_based: "text-yellow-400",
    union: "text-purple-400",
  };

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Database className="w-5 h-5 text-[#00ff88]" />
          <h1 className="text-lg font-bold text-primary tracking-tight">SQL Injection Scanner</h1>
          <Badge className="text-[9px] border-red-400/30 bg-red-400/10 text-red-400 font-mono uppercase tracking-widest px-1.5">Active</Badge>
          <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">Command Center Pro</Badge>
        </div>
        <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
          Tests URL parameters for SQL injection vulnerabilities using error-based, boolean-blind, time-based, and UNION-based detection. Real HTTP probes against the target.
        </p>
      </div>

      {/* Scan config */}
      <div className="border border-primary/20 p-4 rounded-sm bg-primary/2 space-y-4">
        <div>
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Target URL (with parameters)</div>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && url.trim() && !scanMut.isPending && scanMut.mutate()}
            placeholder="https://example.com/page?id=1&user=admin"
            className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
          />
          <div className="mt-1 text-[10px] text-primary/20">Parameters are auto-detected from the URL. Requires at least one query parameter.</div>
        </div>

        <div>
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Override Parameters <span className="text-primary/20 normal-case">(optional — comma-separated)</span></div>
          <input
            value={customParams}
            onChange={e => setCustomParams(e.target.value)}
            placeholder="id, user, page"
            className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
          />
        </div>

        {/* Check toggles */}
        <div>
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Detection Methods</div>
          <div className="flex flex-wrap gap-3">
            {[
              { key: "errorBased", label: "Error-Based", color: "text-red-400 border-red-400/30" },
              { key: "booleanBlind", label: "Boolean Blind", color: "text-orange-400 border-orange-400/30" },
              { key: "timeBased", label: "Time-Based", color: "text-yellow-400 border-yellow-400/30" },
              { key: "union", label: "UNION", color: "text-purple-400 border-purple-400/30" },
            ].map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer group">
                <div
                  onClick={() => setChecks(c => ({ ...c, [key]: !c[key as keyof typeof c] }))}
                  className={`w-4 h-4 border rounded-sm flex items-center justify-center cursor-pointer transition-colors ${checks[key as keyof typeof checks] ? `${color} bg-current/10` : "border-primary/20"}`}
                >
                  {checks[key as keyof typeof checks] && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <span className={`text-[10px] uppercase tracking-wide ${checks[key as keyof typeof checks] ? color.split(" ")[0] : "text-primary/30"}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <Button
          onClick={() => url.trim() && scanMut.mutate()}
          disabled={scanMut.isPending || !url.trim()}
          className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs px-6 rounded-sm"
        >
          {scanMut.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Scanning...</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />Run SQLi Scan</>
          )}
        </Button>
      </div>

      {/* Warning */}
      <div className="border border-yellow-500/20 bg-yellow-900/5 p-3 rounded-sm flex items-start gap-2 text-[10px] text-yellow-400/70">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        Only scan systems you own or have explicit written authorization to test. Unauthorized scanning may violate computer fraud laws.
      </div>

      {/* Scanning progress indicator */}
      {scanMut.isPending && (
        <div className="border border-primary/10 p-8 text-center rounded-sm">
          <Loader2 className="w-6 h-6 text-[#00ff88] mx-auto mb-2 animate-spin" />
          <div className="text-xs text-primary/40">Probing parameters for SQL injection...</div>
          <div className="text-[10px] text-primary/20 mt-1">Error-based · Boolean blind · Time-based · UNION · may take 30–60s</div>
        </div>
      )}

      {/* Results */}
      {result && !scanMut.isPending && (
        <div className="space-y-4">

          {/* Summary banner */}
          <div className={`border rounded-sm p-4 ${result.risk === "critical" ? "border-red-500/40 bg-red-900/8" : result.risk === "high" ? "border-orange-500/40 bg-orange-900/8" : result.risk === "medium" ? "border-yellow-500/30 bg-yellow-900/5" : "border-[#00ff88]/20 bg-[#00ff88]/5"}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {result.vulnerable
                    ? <AlertTriangle className={`w-4 h-4 ${result.risk === "critical" ? "text-red-400" : "text-orange-400"}`} />
                    : <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />}
                  <span className={`text-sm font-bold ${result.risk === "critical" ? "text-red-400" : result.risk === "high" ? "text-orange-400" : result.risk === "medium" ? "text-yellow-400" : "text-[#00ff88]"}`}>
                    {result.vulnerable ? "Vulnerable" : "No SQLi Found"}
                  </span>
                  <RiskBadge risk={result.risk} />
                </div>
                <div className="text-[10px] text-primary/50 max-w-lg">{result.summary}</div>
              </div>
              <div className="text-right text-[10px] font-mono text-primary/30 shrink-0">
                <div>{result.params.length} param{result.params.length > 1 ? "s" : ""} tested</div>
                <div>{result.totalFindings} finding{result.totalFindings !== 1 ? "s" : ""}</div>
                {result.detectedDbs?.length > 0 && <div className="text-orange-400 font-bold mt-0.5">{result.detectedDbs.join(", ")}</div>}
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[9px] border border-primary/10 text-primary/30 px-2 py-0.5">Baseline: {result.baselineStatus} · {result.baselineLength}B · {result.baselineLatencyMs}ms</span>
              <span className="text-[9px] border border-primary/10 text-primary/30 px-2 py-0.5">Params: {result.params.join(", ")}</span>
            </div>
          </div>

          {/* Findings list */}
          {result.findings?.length > 0 && (
            <Section title={`Findings (${result.findings.length})`} icon={AlertCircle} defaultOpen>
              <div className="space-y-2">
                {result.findings.map((f: any, i: number) => (
                  <div key={i} className={`border rounded-sm overflow-hidden ${f.confidence === "confirmed" ? "border-red-500/30" : f.confidence === "likely" ? "border-orange-500/20" : "border-yellow-500/15"}`}>
                    <button
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/2 transition-colors"
                      onClick={() => toggleFinding(i)}
                    >
                      <TypeIcon type={f.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-primary/80">{f.param}</span>
                          <span className={`text-[9px] font-mono uppercase ${typeColor[f.type] ?? "text-primary/40"}`}>{f.type.replace(/_/g, " ")}</span>
                          <ConfidenceDot confidence={f.confidence} />
                          {f.db && <span className="text-[9px] border border-orange-400/30 text-orange-400 px-1.5 bg-orange-900/10">{f.db}</span>}
                        </div>
                        <div className="text-[10px] text-primary/40 truncate mt-0.5">{f.detail}</div>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 text-primary/20 transition-transform shrink-0 ${expandedFindings.has(i) ? "rotate-90" : ""}`} />
                    </button>
                    {expandedFindings.has(i) && (
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-primary/8">
                        <div>
                          <div className="text-[9px] text-primary/30 uppercase mb-1">Payload</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-[10px] text-orange-300 bg-black/30 px-2 py-1 rounded break-all">{f.payload}</code>
                            <button onClick={() => { navigator.clipboard.writeText(f.payload); toast({ title: "Copied" }); }} className="text-primary/30 hover:text-[#00ff88]">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-primary/30 uppercase mb-1">Evidence</div>
                          <code className="block text-[10px] text-primary/50 bg-black/30 px-2 py-1.5 rounded break-all whitespace-pre-wrap max-h-40 overflow-y-auto">{f.evidence}</code>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Remediation */}
          {result.vulnerable && (
            <Section title="Remediation Recommendations" icon={Shield} defaultOpen={false}>
              <div className="space-y-2">
                {result.remediation?.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className="text-[#00ff88] shrink-0 mt-0.5">→</span>
                    <span className="text-primary/60">{r}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Tested params summary */}
          <Section title="Tested Parameters" icon={List} defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {result.params?.map((p: string) => {
                const hasFindings = result.findings?.some((f: any) => f.param === p);
                const isConfirmed = result.findings?.some((f: any) => f.param === p && f.confidence === "confirmed");
                return (
                  <span key={p} className={`text-[10px] border px-2 py-0.5 font-mono ${isConfirmed ? "border-red-400/40 text-red-400 bg-red-900/10" : hasFindings ? "border-orange-400/30 text-orange-400 bg-orange-900/5" : "border-[#00ff88]/20 text-[#00ff88] bg-[#00ff88]/5"}`}>
                    {p} {isConfirmed ? "✗ vuln" : hasFindings ? "⚠ possible" : "✓ clean"}
                  </span>
                );
              })}
            </div>
          </Section>

        </div>
      )}

      {/* Empty state */}
      {!result && !scanMut.isPending && (
        <div className="border border-primary/10 p-10 text-center rounded-sm">
          <Database className="w-8 h-8 text-primary/15 mx-auto mb-3" />
          <div className="text-sm text-primary/25">Enter a URL with parameters to scan for SQL injection</div>
          <div className="text-xs text-primary/15 mt-1">Error-based · Boolean blind · Time-based · UNION · DB fingerprinting</div>
          <div className="text-[10px] text-primary/10 mt-3 font-mono">Example: https://target.com/search?q=test&id=1</div>
        </div>
      )}

    </div>
  );
}
