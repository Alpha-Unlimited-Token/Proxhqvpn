import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, AlertCircle, CheckCircle, CornerDownRight, Clock, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const WORDLISTS = ["common","api","admin","backup","sensitive"] as const;
type WL = typeof WORDLISTS[number];

const WL_DESC: Record<WL, string> = {
  common:    "General paths: dashboard, api, login, assets, uploads…",
  api:       "API endpoints: /api/v1, /graphql, /rest, /rpc, webhooks…",
  admin:     "Admin panels: /admin, /wp-admin, /phpmyadmin, control areas…",
  backup:    "Backup files: .sql, .zip, .tar.gz, old/ archives…",
  sensitive: ".env, config.json, private keys, Docker/K8s files…",
};

const STATUS_COLOR = (s: number) =>
  s >= 500 ? "text-red-400 border-red-400/30 bg-red-400/5" :
  s >= 400 ? "text-orange-400 border-orange-400/30 bg-orange-400/5" :
  s >= 300 ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/5" :
  "text-green-400 border-green-400/30 bg-green-400/5";

const INTEREST_SCORE = (s: number): "high" | "medium" | "low" => {
  if ([200,201,204].includes(s)) return "high";
  if ([301,302,401,403].includes(s)) return "medium";
  return "low";
};

export default function DirectoryFuzzer() {
  const { toast } = useToast();
  const [url, setUrl]               = useState("https://example.com");
  const [wordlist, setWordlist]      = useState<WL>("common");
  const [extensions, setExtensions] = useState("");
  const [threads, setThreads]       = useState(10);
  const [filterCodes, setFilter]    = useState("404");
  const [followRedirs, setFollow]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [wordlistInfo, setWordlistInfo] = useState<Record<WL, number> | null>(null);

  const run = async () => {
    if (!url.startsWith("http")) { toast({ title: "URL must start with http:// or https://", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const ext = extensions.split(",").map(s => s.trim()).filter(Boolean);
      const filt = filterCodes.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const r = await fetch(`${BASE}/api/dir-fuzzer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, wordlist, extensions: ext, threads, filterCodes: filt, followRedirects: followRedirs }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Fuzz failed");
      setResult(data);
      setStatusFilter(null);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadWordlistInfo = async () => {
    if (wordlistInfo) return;
    try {
      const r = await fetch(`${BASE}/api/dir-fuzzer/wordlists`, { credentials: "include" });
      const d = await r.json();
      setWordlistInfo(d);
    } catch {}
  };

  const hits = result?.hits ?? [];
  const filtered = statusFilter ? hits.filter((h: any) => h.status === statusFilter) : hits;
  const statusCounts = hits.reduce((acc: Record<number,number>, h: any) => {
    acc[h.status] = (acc[h.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-primary/90">Directory Fuzzer</h1>
        <p className="text-[11px] text-primary/40 mt-0.5">
          Brute-force paths to discover hidden directories, admin panels, backup files, and exposed endpoints.
          Equivalent to Burp Suite Intruder / ffuf.
        </p>
      </div>

      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-4">
          {/* Target URL */}
          <div>
            <label className="text-[11px] text-primary/50 block mb-1.5">Target URL</label>
            <Input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://target.com"
              className="font-mono text-xs bg-black/60 border-primary/20 text-primary/80 h-9" />
          </div>

          {/* Wordlist selector */}
          <div>
            <label className="text-[11px] text-primary/50 block mb-1.5">Wordlist</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" onClick={loadWordlistInfo}>
              {WORDLISTS.map(w => (
                <button key={w} onClick={() => setWordlist(w)}
                  className={`text-left p-2.5 rounded-xl border text-[11px] transition-all ${
                    wordlist === w
                      ? "border-primary/40 bg-primary/8 text-primary/80"
                      : "border-primary/15 text-primary/40 hover:border-primary/30 hover:text-primary/60"
                  }`}>
                  <div className="font-semibold capitalize mb-0.5">
                    {w}
                    {wordlistInfo && <span className="text-primary/30 font-normal ml-1">({wordlistInfo[w]})</span>}
                  </div>
                  <div className="text-[10px] text-primary/30 leading-snug">{WL_DESC[w]}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Extensions */}
            <div>
              <label className="text-[11px] text-primary/50 block mb-1.5">Extensions <span className="text-primary/30">(comma-separated, e.g. php,html,txt)</span></label>
              <Input value={extensions} onChange={e => setExtensions(e.target.value)}
                placeholder="php, html, bak"
                className="font-mono text-[11px] bg-black/60 border-primary/20 text-primary/70 h-8" />
            </div>
            {/* Filter codes */}
            <div>
              <label className="text-[11px] text-primary/50 block mb-1.5">Hide status codes <span className="text-primary/30">(comma-separated)</span></label>
              <Input value={filterCodes} onChange={e => setFilter(e.target.value)}
                placeholder="404, 400"
                className="font-mono text-[11px] bg-black/60 border-primary/20 text-primary/70 h-8" />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1 border-t border-primary/10">
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              Threads:
              <select value={threads} onChange={e => setThreads(Number(e.target.value))}
                className="bg-black border border-primary/20 rounded px-1.5 py-0.5 text-[11px] text-primary/70 outline-none">
                {[5,10,15,20].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              <input type="checkbox" checked={followRedirs} onChange={e => setFollow(e.target.checked)} className="accent-primary" />
              Follow redirects
            </label>
            <Button onClick={run} disabled={loading}
              className="ml-auto bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary text-xs h-8 px-4 gap-1.5">
              {loading ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Scanning…</> : <><Search className="w-3.5 h-3.5" /> Start Fuzz</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-primary/10">
              <div className="text-xs font-mono text-primary/70">
                <span className="text-primary/40">Tested: </span>{result.totalTested} paths
              </div>
              <div className="text-xs font-mono text-primary/70">
                <span className="text-primary/40">Found: </span>
                <span className={result.hits.length > 0 ? "text-green-400" : "text-primary/40"}>
                  {result.hits.length}
                </span>
              </div>
              {Object.entries(result.summary).filter(([k]) => k !== "found").map(([k, v]) =>
                (v as number) > 0 ? (
                  <Badge key={k} variant="outline" className="text-[10px] border-primary/20 text-primary/50">
                    {k}: {v as number}
                  </Badge>
                ) : null
              )}
            </div>

            {/* Status filter */}
            {hits.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setStatusFilter(null)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${!statusFilter ? "border-primary/40 text-primary/70" : "border-primary/15 text-primary/40"}`}>
                  All ({hits.length})
                </button>
                {Object.entries(statusCounts).map(([s, c]) => (
                  <button key={s} onClick={() => setStatusFilter(Number(s))}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${statusFilter === Number(s) ? "border-primary/40 text-primary/70" : "border-primary/15 text-primary/40"}`}>
                    {s} ({c as number})
                  </button>
                ))}
              </div>
            )}

            {hits.length === 0 ? (
              <div className="text-center py-6 text-primary/30 text-sm">No paths found matching filter criteria</div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filtered.map((h: any) => {
                  const interest = INTEREST_SCORE(h.status);
                  return (
                    <div key={h.path} className={`flex items-center gap-3 p-2.5 rounded-lg border ${STATUS_COLOR(h.status)} font-mono`}>
                      <Badge variant="outline" className={`text-[10px] shrink-0 w-10 justify-center ${STATUS_COLOR(h.status)}`}>
                        {h.status}
                      </Badge>
                      {interest === "high"   && <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />}
                      {interest === "medium" && <AlertCircle className="w-3 h-3 text-yellow-400 shrink-0" />}
                      <span className="text-[11px] text-primary/70 flex-1 truncate">/{h.path}</span>
                      {h.size > 0 && <span className="text-[10px] text-primary/30 shrink-0">{(h.size/1024).toFixed(1)}KB</span>}
                      <span className="text-[10px] text-primary/30 shrink-0">{h.timingMs}ms</span>
                      {h.redirectTo && (
                        <div className="flex items-center gap-1 text-[10px] text-yellow-400/60 shrink-0">
                          <CornerDownRight className="w-3 h-3" />
                          <span className="max-w-[120px] truncate">{h.redirectTo}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
