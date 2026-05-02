// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface CVEItem {
  id: string;
  description: string;
  published: string;
  modified: string;
  cvss3Score?: number;
  cvss3Severity?: string;
  cvss2Score?: number;
  references: string[];
  cweId?: string;
}

function severityColor(s?: string): string {
  switch (s?.toUpperCase()) {
    case "CRITICAL": return "text-red-400 bg-red-900/20 border-red-800/30";
    case "HIGH":     return "text-orange-400 bg-orange-900/20 border-orange-800/30";
    case "MEDIUM":   return "text-yellow-400 bg-yellow-900/20 border-yellow-800/30";
    case "LOW":      return "text-blue-400 bg-blue-900/20 border-blue-800/30";
    default:         return "text-white/40 bg-white/[0.04] border-white/10";
  }
}

function parseNvdResponse(data: any): CVEItem[] {
  const vulns = data?.vulnerabilities ?? [];
  return vulns.map((v: any) => {
    const cve = v.cve;
    const desc = cve.descriptions?.find((d: any) => d.lang === "en")?.value ?? "";
    const metrics = cve.metrics ?? {};
    const cvss3Data = metrics.cvssMetricV31?.[0]?.cvssData ?? metrics.cvssMetricV30?.[0]?.cvssData;
    const cvss2Data = metrics.cvssMetricV2?.[0]?.cvssData;
    const refs = (cve.references ?? []).slice(0, 5).map((r: any) => r.url);
    const cweId = cve.weaknesses?.[0]?.description?.find((d: any) => d.lang === "en")?.value;
    return {
      id: cve.id,
      description: desc,
      published: cve.published?.slice(0, 10) ?? "",
      modified: cve.lastModified?.slice(0, 10) ?? "",
      cvss3Score: cvss3Data?.baseScore,
      cvss3Severity: cvss3Data?.baseSeverity,
      cvss2Score: cvss2Data?.baseScore,
      references: refs,
      cweId,
    } as CVEItem;
  });
}

const QUICK_SEARCHES = [
  "Log4j", "OpenSSL", "Apache", "nginx", "WordPress", "SSH", "RCE", "SQLite", "Chrome", "Windows",
];

export default function CveSearch() {
  const [query, setQuery]     = usePersistedState<string>("cvesearch-query", "");
  const [results, setResults] = useState<CVEItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [total, setTotal]     = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function search(q?: string) {
    const kw = (q ?? query).trim();
    if (!kw) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const isCveId = /^CVE-\d{4}-\d+$/i.test(kw);
      const params = isCveId
        ? `cveId=${encodeURIComponent(kw.toUpperCase())}`
        : `q=${encodeURIComponent(kw)}`;
      const res = await fetch(`${BASE}/api/cve/search?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `CVE search error: ${res.status}`);
      const data = await res.json();
      setTotal(data.totalResults ?? 0);
      setResults(parseNvdResponse(data));
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">CVE Lookup</h1>
        <p className="text-white/60 text-sm mt-1">
          Search the NIST National Vulnerability Database — Shodan + Metasploit CVE intelligence equivalent
        </p>
      </div>

      {/* Search */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-primary/40"
            placeholder="Search keyword or paste CVE ID (e.g. CVE-2021-44228)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
          />
          <button
            onClick={() => search()}
            disabled={loading || !query.trim()}
            className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Quick searches */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-white/30 self-center">Quick:</span>
          {QUICK_SEARCHES.map(q => (
            <button
              key={q}
              onClick={() => { setQuery(q); search(q); }}
              className="px-2.5 py-1 text-xs text-white/50 hover:text-white border border-white/[0.08] hover:border-white/20 rounded-lg transition-colors"
            >{q}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {results.length > 0 && (
        <div className="text-xs text-white/40 px-1">
          Showing {results.length} of {total.toLocaleString()} results from NVD
        </div>
      )}

      <div className="space-y-3">
        {results.map(cve => (
          <div
            key={cve.id}
            className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors"
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpanded(expanded === cve.id ? null : cve.id)}
            >
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white font-mono">{cve.id}</span>
                    {cve.cvss3Severity && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${severityColor(cve.cvss3Severity)}`}>
                        {cve.cvss3Severity} {cve.cvss3Score?.toFixed(1)}
                      </span>
                    )}
                    {cve.cweId && (
                      <span className="text-xs text-purple-400/70 bg-purple-900/20 px-2 py-0.5 rounded-full border border-purple-800/20">
                        {cve.cweId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed line-clamp-2">{cve.description}</p>
                  <div className="flex gap-3 text-xs text-white/30">
                    <span>Published {cve.published}</span>
                    <span>Modified {cve.modified}</span>
                    {cve.cvss2Score && <span>CVSS2: {cve.cvss2Score}</span>}
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${expanded === cve.id ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {expanded === cve.id && (
              <div className="border-t border-white/[0.07] p-4 space-y-3">
                <p className="text-xs text-white/70 leading-relaxed">{cve.description}</p>
                {cve.references.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">References</div>
                    {cve.references.map((ref, i) => (
                      <a
                        key={i}
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-primary/70 hover:text-primary truncate"
                      >{ref}</a>
                    ))}
                  </div>
                )}
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  View full record on NVD →
                </a>
              </div>
            )}
          </div>
        ))}

        {!loading && results.length === 0 && query && !error && (
          <div className="text-center text-white/30 text-sm py-10">No results found.</div>
        )}
        {loading && (
          <div className="text-center py-10">
            <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="text-xs text-white/40 mt-2">Querying NIST NVD…</div>
          </div>
        )}
      </div>
    </div>
  );
}
