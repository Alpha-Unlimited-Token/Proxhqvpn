// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Plus, Trash2, Clock, ArrowRight, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const METHODS = ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"] as const;
type Method = typeof METHODS[number];

const METHOD_COLORS: Record<Method, string> = {
  GET: "text-green-400", POST: "text-yellow-400", PUT: "text-blue-400",
  PATCH: "text-purple-400", DELETE: "text-red-400", HEAD: "text-primary/60", OPTIONS: "text/gray-400",
};

const STATUS_COLOR = (s: number) =>
  s >= 500 ? "text-red-400" :
  s >= 400 ? "text-orange-400" :
  s >= 300 ? "text-yellow-400" :
  s >= 200 ? "text-green-400" : "text-primary/50";

const PRESETS = [
  { label: "GET JSON API", method: "GET" as Method, url: "https://httpbin.org/json", headers: [{ key: "Accept", val: "application/json" }], body: "" },
  { label: "POST Form", method: "POST" as Method, url: "https://httpbin.org/post", headers: [{ key: "Content-Type", val: "application/x-www-form-urlencoded" }], body: "user=test&pass=123" },
  { label: "Check Headers", method: "GET" as Method, url: "https://httpbin.org/headers", headers: [{ key: "X-Custom", val: "ProxhqVPN" }], body: "" },
  { label: "PUT JSON", method: "PUT" as Method, url: "https://httpbin.org/put", headers: [{ key: "Content-Type", val: "application/json" }], body: '{"key":"value"}' },
];

export default function HttpProbe() {
  const { toast } = useToast();
  const [method, setMethod]         = useState<Method>("GET");
  const [url, setUrl]               = useState("https://httpbin.org/get");
  const [headers, setHeaders]       = useState<{ key: string; val: string }[]>([
    { key: "Accept", val: "*/*" },
    { key: "User-Agent", val: "ProxhqVPN-Probe/1.0" },
  ]);
  const [body, setBody]             = useState("");
  const [followRedirects, setFollow]= useState(true);
  const [verifySsl, setVerifySsl]   = useState(false);
  const [timeoutMs, setTimeoutMs]   = useState(10000);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [showRaw, setShowRaw]       = useState(false);
  const [showHeaders, setShowHeaders] = useState(true);
  const [tab, setTab]               = usePersistedState<"body"|"headers"|"redirect">("httpprobe-tab", "body");

  const addHeader = () => setHeaders(h => [...h, { key: "", val: "" }]);
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, j) => j !== i));
  const setHeader = (i: number, field: "key"|"val", v: string) =>
    setHeaders(h => h.map((hdr, j) => j === i ? { ...hdr, [field]: v } : hdr));

  const applyPreset = (p: typeof PRESETS[0]) => {
    setMethod(p.method);
    setUrl(p.url);
    setHeaders(p.headers);
    setBody(p.body);
  };

  const send = async () => {
    if (!url.startsWith("http")) { toast({ title: "URL must start with http:// or https://", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const hdrObj: Record<string, string> = {};
      headers.filter(h => h.key.trim()).forEach(h => { hdrObj[h.key.trim()] = h.val; });
      const r = await fetch(`${BASE}/api/http-probe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, url, headers: hdrObj, body: body || undefined, followRedirects, verifySsl, timeoutMs }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Probe failed");
      setResult(data);
      setTab("body");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyBody = () => {
    navigator.clipboard.writeText(result?.body ?? "");
    toast({ title: "Copied to clipboard" });
  };

  const needsBody = ["POST","PUT","PATCH"].includes(method);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-primary/90">HTTP Probe</h1>
        <p className="text-[11px] text-primary/40 mt-0.5">
          Craft and fire any HTTP request from the server — inspect raw responses, headers, redirects, and timing. Equivalent to Burp Suite Repeater.
        </p>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary/80 transition-colors">
            {p.label}
          </button>
        ))}
      </div>

      {/* Request Builder */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          {/* Method + URL + Send */}
          <div className="flex gap-2">
            <select value={method} onChange={e => setMethod(e.target.value as Method)}
              className={`bg-black border border-primary/20 rounded-lg px-2.5 py-2 text-xs font-mono font-bold ${METHOD_COLORS[method]} outline-none cursor-pointer`}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://target.com/api/endpoint"
              className="flex-1 font-mono text-xs bg-black/60 border-primary/20 text-primary/80 h-9" />
            <Button onClick={send} disabled={loading}
              className="bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary text-xs h-9 px-4 gap-1.5">
              {loading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </Button>
          </div>

          {/* Headers */}
          <div>
            <button onClick={() => setShowHeaders(s => !s)}
              className="flex items-center gap-1.5 text-[11px] text-primary/60 hover:text-primary/80 mb-2">
              {showHeaders ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Request Headers ({headers.length})
            </button>
            {showHeaders && (
              <div className="space-y-1.5">
                {headers.map((h, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input value={h.key} onChange={e => setHeader(i, "key", e.target.value)}
                      placeholder="Header-Name" className="w-40 font-mono text-[11px] bg-black/60 border-primary/15 text-primary/60 h-7" />
                    <span className="text-primary/30 text-xs">:</span>
                    <Input value={h.val} onChange={e => setHeader(i, "val", e.target.value)}
                      placeholder="value" className="flex-1 font-mono text-[11px] bg-black/60 border-primary/15 text-primary/60 h-7" />
                    <button onClick={() => removeHeader(i)} className="text-primary/30 hover:text-red-400 shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button onClick={addHeader}
                  className="flex items-center gap-1 text-[10px] text-primary/40 hover:text-primary/70 mt-1">
                  <Plus className="w-3 h-3" /> Add header
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          {needsBody && (
            <div>
              <div className="text-[11px] text-primary/50 mb-1.5">Request Body</div>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                placeholder={"{\n  \"key\": \"value\"\n}"}
                className="w-full font-mono text-[11px] bg-black/60 border border-primary/15 rounded-lg p-2.5 text-primary/70 resize-y outline-none focus:border-primary/40 min-h-[80px]" />
            </div>
          )}

          {/* Options */}
          <div className="flex flex-wrap gap-4 pt-1 border-t border-primary/10">
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              <input type="checkbox" checked={followRedirects} onChange={e => setFollow(e.target.checked)}
                className="accent-primary" />
              Follow redirects
            </label>
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              <input type="checkbox" checked={verifySsl} onChange={e => setVerifySsl(e.target.checked)}
                className="accent-primary" />
              Verify SSL
            </label>
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              Timeout:
              <select value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))}
                className="bg-black border border-primary/20 rounded px-1.5 py-0.5 text-[11px] text-primary/70 outline-none">
                {[3000,5000,10000,15000,30000].map(t => (
                  <option key={t} value={t}>{t/1000}s</option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Response */}
      {result && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            {/* Status bar */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary/10">
              <span className={`font-mono font-bold text-lg ${STATUS_COLOR(result.statusCode)}`}>
                {result.statusCode}
              </span>
              <span className="text-primary/50 text-xs font-mono">{result.statusText}</span>
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/40">{result.httpVersion}</Badge>
              <div className="flex items-center gap-1 text-[11px] text-primary/40 ml-auto">
                <Clock className="w-3 h-3" /> {result.timingMs}ms
              </div>
              <div className="text-[11px] text-primary/40">
                {result.bodyBytes > 0 ? `${(result.bodyBytes / 1024).toFixed(1)} KB` : "empty"}
                {result.truncated && " (truncated)"}
              </div>
            </div>

            {/* Redirect chain */}
            {result.redirectChain?.length > 0 && (
              <div className="mb-3 pb-3 border-b border-primary/10">
                <div className="text-[10px] text-primary/40 mb-1.5">Redirect chain</div>
                <div className="flex flex-wrap items-center gap-1">
                  {result.redirectChain.map((r: any, i: number) => (
                    <span key={i} className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[10px] border-primary/15 ${STATUS_COLOR(r.status)}`}>{r.status}</Badge>
                      <ArrowRight className="w-3 h-3 text-primary/30" />
                      <span className="text-[10px] text-primary/50 font-mono truncate max-w-[200px]">{r.location}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 mb-3">
              {(["body","headers","redirect"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`text-[11px] capitalize pb-1 border-b transition-colors ${tab === t ? "border-primary text-primary/80" : "border-transparent text-primary/40 hover:text-primary/60"}`}>
                  {t === "redirect" ? "Final URL" : t}
                  {t === "headers" && ` (${Object.keys(result.responseHeaders).length})`}
                </button>
              ))}
              <button onClick={copyBody} className="ml-auto text-[10px] text-primary/40 hover:text-primary/60 flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button onClick={() => setShowRaw(s => !s)} className="text-[10px] text-primary/40 hover:text-primary/60">
                {showRaw ? "Rendered" : "Raw"}
              </button>
            </div>

            {tab === "body" && (
              <pre className="font-mono text-[11px] text-primary/70 bg-black/60 rounded-lg p-3 overflow-auto max-h-[500px] whitespace-pre-wrap break-all">
                {result.body || <span className="text-primary/30 italic">empty body</span>}
              </pre>
            )}
            {tab === "headers" && (
              <div className="space-y-1">
                {Object.entries(result.responseHeaders).map(([k, v]) => (
                  <div key={k} className="flex gap-3 font-mono text-[11px]">
                    <span className="text-yellow-400/70 shrink-0 w-48 truncate">{k}</span>
                    <span className="text-primary/60 break-all">{v as string}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === "redirect" && (
              <div className="font-mono text-[11px] text-primary/70 bg-black/60 rounded-lg p-3">
                <div className="text-primary/40 text-[10px] mb-1">Final URL</div>
                {result.finalUrl}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
