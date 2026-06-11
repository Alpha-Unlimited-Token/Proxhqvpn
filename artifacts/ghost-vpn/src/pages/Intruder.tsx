// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface IntruderResult {
  payload: string;
  statusCode: number;
  timingMs: number;
  bodyLength: number;
  body: string;
  error?: string;
}

const SAMPLE_WORDLIST = `admin\nroot\ntest\npassword\nguest\nuser\ninfo\nlogin\ndemo\nsuperuser`;

const MARKER = "§FUZZ§";

function statusColor(code: number): string {
  if (code === 0) return "text-red-400";
  if (code < 300) return "text-green-400";
  if (code < 400) return "text-yellow-400";
  if (code < 500) return "text-orange-400";
  return "text-red-400";
}

export default function Intruder() {
  const [method, setMethod]       = useState<string>("GET");
  const [urlTpl, setUrlTpl]       = usePersistedState<string>("intruder-url", "");
  const [bodyTpl, setBodyTpl]     = usePersistedState<string>("intruder-body", "");
  const [headers, setHeaders]     = useState("Content-Type: application/json");
  const [wordlist, setWordlist]   = useState(SAMPLE_WORDLIST);
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [results, setResults]     = useState<IntruderResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = usePersistedState<string>("intruder-filter", "");
  const abortRef = useRef<AbortController | null>(null);

  const payloads = wordlist.split("\n").map(l => l.trim()).filter(Boolean);

  function parseHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    for (const line of headers.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) h[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return h;
  }

  async function run() {
    if (!urlTpl.trim() || payloads.length === 0) return;
    setLoading(true);
    setError("");
    setResults([]);
    setExpanded(null);
    abortRef.current = new AbortController();
    try {
      const res = await fetch(`${BASE}/api/intruder/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          urlTemplate: urlTpl.trim(),
          headers: parseHeaders(),
          bodyTemplate: bodyTpl.trim() || undefined,
          payloads,
          timeoutMs,
          verifySsl: false,
          marker: MARKER,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API error ${res.status}: ${t}`);
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  const displayed = filterStatus
    ? results.filter(r => String(r.statusCode).startsWith(filterStatus))
    : results;

  const statusGroups = [...new Set(results.map(r => String(r.statusCode).slice(0, 1) + "xx"))].sort();

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Intruder</h1>
        <p className="text-white/60 text-sm mt-1">
          HTTP parameter fuzzer — inject a wordlist into any position in a request — Burp Suite Intruder equivalent
        </p>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl px-4 py-3 text-xs text-yellow-400/80">
        Use <code className="font-mono bg-yellow-900/30 px-1 rounded">{MARKER}</code> anywhere in the URL, body, or header values to mark the injection point. It will be replaced with each payload.
      </div>

      {/* Config */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-4">
        {/* Method + URL */}
        <div className="flex gap-2">
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-primary/40"
          >
            {["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 font-mono focus:outline-none focus:border-primary/40"
            placeholder={`https://example.com/login?user=${MARKER}`}
            value={urlTpl}
            onChange={e => setUrlTpl(e.target.value)}
          />
        </div>

        {/* Headers */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Headers (one per line, Key: Value)</label>
          <textarea
            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-white/90 font-mono resize-none focus:outline-none focus:border-primary/40 h-20"
            value={headers}
            onChange={e => setHeaders(e.target.value)}
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">
            Request Body (optional — use {MARKER} for injection)
          </label>
          <textarea
            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-white/90 font-mono resize-none focus:outline-none focus:border-primary/40 h-20"
            placeholder={`{"username":"${MARKER}","password":"test"}`}
            value={bodyTpl}
            onChange={e => setBodyTpl(e.target.value)}
          />
        </div>

        {/* Wordlist + timeout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Payload List ({payloads.length} entries)
            </label>
            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-white/90 font-mono resize-none focus:outline-none focus:border-primary/40 h-40"
              placeholder="One payload per line…"
              value={wordlist}
              onChange={e => setWordlist(e.target.value)}
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Timeout (ms)</label>
              <input
                type="number"
                min={500}
                max={15000}
                step={500}
                value={timeoutMs}
                onChange={e => setTimeoutMs(Number(e.target.value))}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div className="bg-black/20 border border-white/[0.06] rounded-lg p-3 text-xs text-white/40 space-y-1 leading-relaxed">
              <div>Cap: 100 payloads per run.</div>
              <div>All requests are sent server-side — CORS is not an issue.</div>
              <div>Only test systems you own or have authorization to test.</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={loading || !urlTpl.trim() || payloads.length === 0}
            className="px-6 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {loading ? `Running… (${results.length}/${payloads.length})` : "Launch →"}
          </button>
          {loading && (
            <button onClick={stop} className="px-4 py-2 border border-red-800/40 bg-red-900/20 text-red-400 text-sm font-semibold rounded-lg hover:bg-red-900/30 transition-colors">
              Stop
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-white/70">{results.length} results</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilterStatus("")}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${!filterStatus ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 text-white/40 hover:text-white"}`}
              >All</button>
              {statusGroups.map(g => (
                <button
                  key={g}
                  onClick={() => setFilterStatus(g[0])}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${filterStatus === g[0] ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 text-white/40 hover:text-white"}`}
                >{g}</button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-white/40 text-left">
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider w-8">#</th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider">Payload</th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider w-16">Status</th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider w-20">Length</th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider w-20">Time (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {displayed.map((r, i) => (
                  <React.Fragment key={i}>
                    <tr
                      className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      <td className="px-4 py-2 text-white/30">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-white/70 max-w-[200px] truncate">{r.payload}</td>
                      <td className={`px-4 py-2 font-mono font-bold ${r.error ? "text-red-400" : statusColor(r.statusCode)}`}>
                        {r.error ? "ERR" : r.statusCode || "—"}
                      </td>
                      <td className="px-4 py-2 text-white/50">{r.error ? "—" : r.bodyLength.toLocaleString()}</td>
                      <td className="px-4 py-2 text-white/50">{r.error ? "—" : r.timingMs}</td>
                    </tr>
                    {expanded === i && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 bg-black/30">
                          {r.error ? (
                            <div className="text-red-400 text-xs font-mono">{r.error}</div>
                          ) : (
                            <pre className="text-xs font-mono text-white/60 whitespace-pre-wrap break-all max-h-48 overflow-auto">{r.body || "(empty body)"}</pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
