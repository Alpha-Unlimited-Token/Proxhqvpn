// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type AttackClass = "sqli" | "xss" | "lfi" | "rce" | "ssrf" | "xxe" | "ssti" | "nosqli";

interface BypassVariant {
  id: string;
  class: AttackClass;
  technique: string;
  payload: string;
  encoding: string;
}

interface BypassResult {
  variant: BypassVariant;
  status: number;
  blocked: boolean;
  responseSize: number;
  durationMs: number;
  bypassedWaf: boolean;
  evidence: string;
}

interface BypassSession {
  sessionId: string;
  target: string;
  testedAt: string;
  totalVariants: number;
  bypassed: number;
  blocked: number;
  bypassRate: number;
  results: BypassResult[];
  matrix: Record<string, { tested: number; bypassed: number; rate: number }>;
}

const CLASS_OPTIONS: { value: AttackClass; label: string; color: string }[] = [
  { value: "sqli",   label: "SQL Injection",   color: "text-red-400" },
  { value: "xss",    label: "XSS",             color: "text-orange-400" },
  { value: "lfi",    label: "LFI / Path Trav", color: "text-yellow-400" },
  { value: "ssrf",   label: "SSRF",            color: "text-cyan-400" },
  { value: "rce",    label: "RCE / Cmd Inj",   color: "text-rose-400" },
  { value: "ssti",   label: "SSTI",            color: "text-purple-400" },
  { value: "nosqli", label: "NoSQL Injection",  color: "text-blue-400" },
];

export default function WafBypass() {
  const [targetUrl, setTargetUrl] = useState("https://");
  const [param, setParam]         = useState("q");
  const [limit, setLimit]         = useState(200);
  const [classes, setClasses]     = useState<AttackClass[]>(["sqli", "xss"]);
  const [scanning, setScanning]   = useState(false);
  const [session, setSession]     = useState<BypassSession | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState<"all" | "bypassed" | "blocked">("all");
  const [variantCount, setVariantCount] = useState<number | null>(null);

  React.useEffect(() => {
    fetch(`${BASE}/api/waf-bypass/variants/count`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setVariantCount(d.total))
      .catch(() => {});
  }, []);

  function toggleClass(cls: AttackClass) {
    setClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
  }

  async function runScan() {
    if (!targetUrl || targetUrl === "https://") { setError("Enter a target URL"); return; }
    setScanning(true);
    setError(null);
    setSession(null);
    try {
      const r = await fetch(`${BASE}/api/waf-bypass/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUrl, param, classes, limit }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data: BypassSession = await r.json();
      setSession(data);
    } catch (e: any) {
      setError(e.message);
    }
    setScanning(false);
  }

  function exportJson() {
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `waf-bypass-${session.sessionId}.json`; a.click();
  }

  function exportMarkdown() {
    if (!session) return;
    const lines = [
      `# WAF Bypass Report — ${session.target}`,
      `Tested: ${new Date(session.testedAt).toLocaleString()}`,
      ``,
      `## Summary`,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Variants | ${session.totalVariants} |`,
      `| Bypassed | ${session.bypassed} |`,
      `| Blocked | ${session.blocked} |`,
      `| Bypass Rate | ${session.bypassRate}% |`,
      ``,
      `## Matrix by Attack Class`,
      `| Class | Tested | Bypassed | Bypass Rate |`,
      `|-------|--------|----------|-------------|`,
      ...Object.entries(session.matrix).map(([k, v]) => `| ${k} | ${v.tested} | ${v.bypassed} | ${v.rate}% |`),
      ``,
      `## Bypassed Payloads`,
      ...session.results.filter(r => r.bypassedWaf).map(r =>
        `### ${r.variant.class} / ${r.variant.technique}\n\`\`\`\n${r.variant.payload}\n\`\`\`\n${r.evidence}\n`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `waf-bypass-${session.sessionId}.md`; a.click();
  }

  const filteredResults = session?.results.filter(r => {
    if (filter === "bypassed") return r.bypassedWaf;
    if (filter === "blocked") return r.blocked;
    return true;
  }) ?? [];

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6 space-y-6">
      <div className="border border-primary/20 bg-primary/5 p-4">
        <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">WAF Bypass Auto-Generator</div>
        <div className="text-white/50 text-xs">
          GoTestWAF-style engine. Tests {variantCount ? `${variantCount.toLocaleString()}+` : "2,000+"} bypass variants across SQL injection, XSS, LFI, SSRF, RCE, SSTI, and NoSQL.
          Generates a bypass success matrix per technique — graded pass/fail against the target WAF.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="border border-white/10 p-4 space-y-3">
            <div className="text-white/60 text-xs uppercase tracking-widest">Target</div>
            <input
              className="w-full bg-black border border-white/20 text-white text-xs px-3 py-2 focus:outline-none focus:border-primary"
              placeholder="https://target.com/search"
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-white/40 mb-1">Inject Parameter</div>
                <input
                  className="w-full bg-black border border-white/20 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                  value={param}
                  onChange={e => setParam(e.target.value)}
                />
              </div>
              <div>
                <div className="text-[10px] text-white/40 mb-1">Max Variants</div>
                <input
                  type="number"
                  className="w-full bg-black border border-white/20 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                  value={limit}
                  min={10}
                  max={500}
                  onChange={e => setLimit(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="border border-white/10 p-4 space-y-2">
            <div className="text-white/60 text-xs uppercase tracking-widest">Attack Classes</div>
            {CLASS_OPTIONS.map(({ value, label, color }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={classes.includes(value)}
                  onChange={() => toggleClass(value)}
                  className="accent-primary"
                />
                <span className={`text-xs ${classes.includes(value) ? color : "text-white/40"}`}>{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={runScan}
            disabled={scanning || classes.length === 0}
            className="w-full bg-primary text-black text-xs font-bold py-2.5 uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50"
          >
            {scanning ? "Scanning... (this may take a minute)" : "Run WAF Bypass Scan"}
          </button>

          {error && <div className="border border-red-500/30 bg-red-900/10 p-2 text-red-400 text-xs">{error}</div>}

          {session && (
            <div className="flex gap-2">
              <button onClick={exportJson} className="flex-1 border border-white/20 text-white/60 text-xs py-1.5 hover:text-white">Export JSON</button>
              <button onClick={exportMarkdown} className="flex-1 border border-white/20 text-white/60 text-xs py-1.5 hover:text-white">Export MD</button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!session && !scanning && (
            <div className="border border-white/10 p-8 text-center text-white/30 text-sm">
              Configure a target and run the scan to see bypass results
            </div>
          )}

          {scanning && (
            <div className="border border-primary/20 bg-primary/5 p-8 text-center space-y-2">
              <div className="text-primary text-sm animate-pulse">Running {limit} bypass variants...</div>
              <div className="text-white/40 text-xs">Testing in batches of 10 concurrent requests</div>
            </div>
          )}

          {session && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Tested", value: session.totalVariants, color: "text-white" },
                  { label: "Bypassed WAF", value: session.bypassed, color: "text-green-400" },
                  { label: "Blocked",      value: session.blocked,   color: "text-red-400" },
                  { label: "Bypass Rate",  value: `${session.bypassRate}%`, color: session.bypassRate > 50 ? "text-red-400" : session.bypassRate > 20 ? "text-yellow-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="border border-white/10 p-3 text-center">
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Matrix */}
              <div className="border border-white/10 p-4">
                <div className="text-white/60 text-xs uppercase tracking-widest mb-3">Bypass Matrix by Attack Class</div>
                <div className="space-y-2">
                  {Object.entries(session.matrix).map(([cls, data]) => (
                    <div key={cls} className="flex items-center gap-3">
                      <div className="text-xs text-white/60 w-24 shrink-0 capitalize">{cls}</div>
                      <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${data.rate > 50 ? "bg-red-500" : data.rate > 20 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${data.rate}%` }}
                        />
                      </div>
                      <div className="text-xs text-white/40 w-24 text-right shrink-0">
                        {data.bypassed}/{data.tested} ({data.rate}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results table */}
              <div className="border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white/60 text-xs uppercase tracking-widest">Results</div>
                  <div className="flex gap-1">
                    {(["all", "bypassed", "blocked"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[10px] px-2 py-0.5 border capitalize ${filter === f ? "border-primary text-primary" : "border-white/20 text-white/40"}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {filteredResults.slice(0, 100).map((r, i) => (
                    <div key={i} className={`border p-2 text-[10px] flex items-start gap-2 ${r.bypassedWaf ? "border-green-500/30 bg-green-900/5" : r.blocked ? "border-red-500/20 bg-red-900/5" : "border-white/5"}`}>
                      <div className={`shrink-0 font-bold w-14 ${r.bypassedWaf ? "text-green-400" : r.blocked ? "text-red-400" : "text-white/40"}`}>
                        {r.bypassedWaf ? "BYPASS" : r.blocked ? "BLOCKED" : "UNKNOWN"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/50 mb-0.5"><span className="text-white/70">{r.variant.class}</span> / {r.variant.technique}</div>
                        <code className="text-primary/70 block truncate">{r.variant.payload.slice(0, 80)}</code>
                        <div className="text-white/30 mt-0.5">{r.evidence}</div>
                      </div>
                      <div className="shrink-0 text-white/30">{r.status}</div>
                    </div>
                  ))}
                  {filteredResults.length > 100 && (
                    <div className="text-white/30 text-[10px] text-center py-2">
                      Showing 100 of {filteredResults.length} — export JSON for full results
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
