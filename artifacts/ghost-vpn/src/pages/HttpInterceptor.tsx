import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Plus, Trash2, Send, History, Clock, ChevronDown, ChevronRight, RefreshCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
type Method = typeof METHODS[number];

const METHOD_COLOR: Record<Method, string> = {
  GET: "text-green-400", POST: "text-yellow-400", PUT: "text-blue-400",
  PATCH: "text-purple-400", DELETE: "text-red-400", HEAD: "text-primary/50", OPTIONS: "text-white/40",
};

const STATUS_COLOR = (s: number) => s >= 500 ? "text-red-400" : s >= 400 ? "text-orange-400" : s >= 300 ? "text-yellow-400" : s >= 200 ? "text-green-400" : "text-white/40";

export default function HttpInterceptor() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"send" | "history" | "rules">("send");

  // Send form
  const [method, setMethod] = useState<Method>("GET");
  const [url, setUrl] = useState("https://httpbin.org/get");
  const [headers, setHeaders] = useState([{ key: "User-Agent", val: "ProxhqVPN-Interceptor/1.0" }]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Match/replace rules
  const [rules, setRules] = useState<{ from: string; to: string; enabled: boolean }[]>([]);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo]   = useState("");
  const [rulesLoading, setRulesLoading] = useState(false);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/interceptor/rules`);
      const d = await r.json();
      setRules(d.rules ?? []);
    } catch { /* ignore */ }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await fetch(`${BASE}/api/interceptor/history`);
      const d = await r.json();
      setHistory(d.history ?? []);
    } catch { /* ignore */ } finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  async function sendRequest() {
    setLoading(true);
    try {
      const hdrs: Record<string, string> = {};
      headers.filter(h => h.key).forEach(h => { hdrs[h.key] = h.val; });
      const r = await fetch(`${BASE}/api/interceptor/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, url, headers: hdrs, body: body || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Request failed");
      setLastResult(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function saveRules() {
    setRulesLoading(true);
    try {
      await fetch(`${BASE}/api/interceptor/rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      toast({ title: "Rules saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); } finally { setRulesLoading(false); }
  }

  function addRule() {
    if (!newFrom) return;
    setRules(r => [...r, { from: newFrom, to: newTo, enabled: true }]);
    setNewFrom(""); setNewTo("");
  }

  const [confirmClear, setConfirmClear] = useState(false);

  function clearHistory() {
    if (!confirmClear) { setConfirmClear(true); return; }
    fetch(`${BASE}/api/interceptor/history`, { method: "DELETE" }).then(() => {
      setHistory([]);
      setConfirmClear(false);
      toast({ title: "History cleared" });
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">HTTP Interceptor</h1>
        <p className="text-xs text-white/40 mt-1">Replay requests with match-and-replace rules, inspect history</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary/10">
        {([["send", "Send Request"], ["rules", "Match & Replace"], ["history", "History"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); if (key === "history") loadHistory(); }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              tab === key ? "border-primary text-primary" : "border-transparent text-white/40 hover:text-white/60"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Send Request */}
      {tab === "send" && (
        <div className="space-y-4">
          <Card className="bg-black/40 border-primary/15">
            <CardContent className="p-4 space-y-3">
              {/* Method + URL */}
              <div className="flex gap-2">
                <select value={method} onChange={e => setMethod(e.target.value as Method)}
                  className="bg-black/60 border border-primary/20 text-primary text-sm font-mono rounded-lg px-2 py-2 focus:outline-none w-28">
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <Input value={url} onChange={e => setUrl(e.target.value)}
                  className="flex-1 bg-black/60 border-primary/20 text-primary text-sm font-mono"
                  placeholder="https://..." onKeyDown={e => e.key === "Enter" && sendRequest()} />
                <Button onClick={sendRequest} disabled={loading} className="bg-primary text-black font-bold px-5 hover:bg-primary/85">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              {/* Headers */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Headers</div>
                <div className="space-y-1.5">
                  {headers.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={h.key} onChange={e => setHeaders(hs => hs.map((x,j)=>j===i?{...x,key:e.target.value}:x))}
                        placeholder="Key" className="flex-1 bg-black/60 border-primary/20 text-primary text-xs font-mono h-7" />
                      <Input value={h.val} onChange={e => setHeaders(hs => hs.map((x,j)=>j===i?{...x,val:e.target.value}:x))}
                        placeholder="Value" className="flex-1 bg-black/60 border-primary/20 text-primary text-xs font-mono h-7" />
                      <button onClick={() => setHeaders(hs => hs.filter((_,j)=>j!==i))}
                        className="text-red-400/60 hover:text-red-400 transition-colors px-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => setHeaders(h => [...h, { key: "", val: "" }])}
                    className="flex items-center gap-1 text-[11px] text-primary/50 hover:text-primary transition-colors mt-1">
                    <Plus className="w-3 h-3" /> Add Header
                  </button>
                </div>
              </div>

              {/* Body */}
              {["POST","PUT","PATCH"].includes(method) && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Body</div>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
                    className="w-full bg-black/60 border border-primary/15 text-primary text-xs font-mono rounded-lg p-3 resize-y focus:outline-none focus:border-primary/40" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response */}
          {lastResult?.response && (
            <Card className="bg-black/40 border-primary/15">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${STATUS_COLOR(lastResult.response.status)}`}>
                    {lastResult.response.status} {lastResult.response.statusText}
                  </span>
                  <span className="text-xs text-white/30">{lastResult.response.durationMs}ms</span>
                  {lastResult.matchReplaceApplied?.length > 0 && (
                    <Badge className="text-[10px] bg-yellow-900/20 border-yellow-400/30 text-yellow-400">
                      {lastResult.matchReplaceApplied.length} rule(s) applied
                    </Badge>
                  )}
                </div>
                <pre className="text-[11px] text-primary/70 bg-black/60 p-3 rounded border border-primary/10 overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all">
                  {lastResult.response.body || "(empty body)"}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Match & Replace */}
      {tab === "rules" && (
        <div className="space-y-4">
          <Card className="bg-black/40 border-primary/15">
            <CardContent className="p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Add Rule</div>
              <div className="flex gap-2">
                <Input value={newFrom} onChange={e => setNewFrom(e.target.value)} placeholder="Match (string or regex)"
                  className="flex-1 bg-black/60 border-primary/20 text-primary text-sm font-mono" />
                <Input value={newTo} onChange={e => setNewTo(e.target.value)} placeholder="Replace with"
                  className="flex-1 bg-black/60 border-primary/20 text-primary text-sm font-mono" />
                <Button onClick={addRule} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {rules.length === 0 ? (
            <div className="text-center text-white/30 text-sm py-8">No rules yet. Add one above.</div>
          ) : (
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-primary/10 bg-black/30 rounded-lg">
                  <input type="checkbox" checked={r.enabled} onChange={e => setRules(rs => rs.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))}
                    className="accent-primary w-3.5 h-3.5" />
                  <code className="flex-1 text-[11px] text-red-400 bg-red-900/10 border border-red-500/15 px-2 py-1 rounded font-mono">{r.from}</code>
                  <span className="text-white/30 text-xs">→</span>
                  <code className="flex-1 text-[11px] text-green-400 bg-green-900/10 border border-green-500/15 px-2 py-1 rounded font-mono">{r.to || "(empty)"}</code>
                  <button onClick={() => setRules(rs => rs.filter((_,j)=>j!==i))} className="text-red-400/50 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={saveRules} disabled={rulesLoading} className="bg-primary text-black font-bold hover:bg-primary/85">
            {rulesLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Rules
          </Button>
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={loadHistory} className="border-primary/25 text-primary/70 text-xs">
              <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
            </Button>
            {history.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/50">Confirm clear?</span>
                  <button onClick={clearHistory} className="text-[11px] text-red-400 font-bold hover:text-red-300 transition-colors">Yes, clear</button>
                  <button onClick={() => setConfirmClear(false)} className="text-[11px] text-white/40 hover:text-white/60 transition-colors">Cancel</button>
                </div>
              ) : (
                <button onClick={clearHistory} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">
                  Clear All
                </button>
              )
            )}
          </div>

          {histLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary/40" /></div>
          ) : history.length === 0 ? (
            <div className="text-center text-white/30 text-sm py-8">No requests yet. Send one from the Send tab.</div>
          ) : (
            <div className="space-y-2">
              {history.map((rec: any) => (
                <div key={rec.id} className="border border-primary/10 bg-black/30 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/5 transition-colors"
                    onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}>
                    <span className={`text-xs font-bold w-16 shrink-0 ${METHOD_COLOR[rec.method as Method]}`}>{rec.method}</span>
                    <span className="flex-1 text-[11px] text-white/70 truncate font-mono">{rec.url}</span>
                    {rec.response && <span className={`text-xs font-mono ${STATUS_COLOR(rec.response.status)}`}>{rec.response.status}</span>}
                    {rec.response && <span className="text-[10px] text-white/30">{rec.response.durationMs}ms</span>}
                    <Clock className="w-3 h-3 text-white/20" />
                    {expanded === rec.id ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
                  </button>
                  {expanded === rec.id && rec.response && (
                    <div className="px-4 pb-3 border-t border-primary/8">
                      <pre className="text-[10px] text-primary/60 bg-black/40 p-2 rounded border border-primary/8 overflow-auto max-h-40 mt-2 font-mono whitespace-pre-wrap break-all">
                        {rec.response.body || "(empty)"}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
