// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Lock, AlertCircle, Clock, CheckCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type SubResult = {
  subdomain: string;
  ips: string[];
  cnames: string[];
  hasHttp: boolean;
  hasHttps: boolean;
  source: "crt.sh" | "brute" | "both";
};

export default function SubdomainScan() {
  const { toast } = useToast();
  const [domain, setDomain]         = useState("example.com");
  const [resolveDns, setResolveDns] = useState(true);
  const [checkHttp, setCheckHttp]   = useState(true);
  const [bruteForce, setBrute]      = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [filter, setFilter]         = usePersistedState<"all"|"http"|"https"|"dns">("subdomain-filter", "all");

  const scan = async () => {
    const d = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "");
    if (!d || !d.includes(".")) { toast({ title: "Enter a valid domain (e.g. example.com)", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}/api/subdomain-scan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, resolveDns, checkHttp, bruteForce }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Scan failed");
      setResult(data);
      setFilter("all");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const results: SubResult[] = result?.results ?? [];
  const filtered = results.filter(r => {
    if (filter === "https") return r.hasHttps;
    if (filter === "http") return r.hasHttp;
    if (filter === "dns") return r.ips.length > 0;
    return true;
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-primary/90">Subdomain Scout</h1>
        <p className="text-[11px] text-primary/40 mt-0.5">
          Enumerate subdomains using certificate transparency logs (crt.sh) and DNS resolution.
          Identifies live web services, exposed internal panels, and attack surface expansion.
        </p>
      </div>

      {/* How it works */}
      <div className="flex gap-3 flex-wrap">
        {[
          { icon: "🔍", label: "Certificate Transparency", desc: "Queries crt.sh to find every SSL cert ever issued for the domain — no rate limits, no scanning" },
          { icon: "🌐", label: "DNS Resolution", desc: "Resolves each subdomain to current IPs and CNAMEs to confirm it's live" },
          { icon: "🔒", label: "HTTP/HTTPS Probe", desc: "Checks if the subdomain serves a web app on port 80 or 443" },
        ].map(s => (
          <div key={s.label} className="flex-1 min-w-[180px] p-3 rounded-xl bg-primary/4 border border-primary/12">
            <div className="text-lg mb-1">{s.icon}</div>
            <div className="text-[11px] font-semibold text-primary/70 mb-0.5">{s.label}</div>
            <div className="text-[10px] text-primary/40 leading-relaxed">{s.desc}</div>
          </div>
        ))}
      </div>

      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[11px] text-primary/50 block mb-1.5">Target Domain</label>
            <div className="flex gap-2">
              <Input value={domain} onChange={e => setDomain(e.target.value)}
                placeholder="example.com"
                onKeyDown={e => e.key === "Enter" && scan()}
                className="font-mono text-xs bg-black/60 border-primary/20 text-primary/80 h-9 flex-1" />
              <Button onClick={scan} disabled={loading}
                className="bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary text-xs h-9 px-4 gap-1.5 shrink-0">
                {loading ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Scanning…</> : <><Globe className="w-3.5 h-3.5" /> Scan</>}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1 border-t border-primary/10">
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              <input type="checkbox" checked={resolveDns} onChange={e => setResolveDns(e.target.checked)} className="accent-primary" />
              Resolve DNS
            </label>
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              <input type="checkbox" checked={checkHttp} onChange={e => setCheckHttp(e.target.checked)} className="accent-primary" />
              HTTP/HTTPS probe
            </label>
            <label className="flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
              <input type="checkbox" checked={bruteForce} onChange={e => setBrute(e.target.checked)} className="accent-primary" />
              DNS brute-force <span className="text-primary/30">(40+ common prefixes)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading && (
        <div className="text-center py-8 text-primary/40 text-sm">
          <Clock className="w-5 h-5 animate-spin mx-auto mb-2" />
          Querying certificate transparency logs and resolving DNS…
          <div className="text-[11px] mt-1 text-primary/30">This may take 10–30 seconds for large domains</div>
        </div>
      )}

      {result && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-primary/10">
              <div className="text-xs font-mono">
                <span className="text-primary/40">Found: </span>
                <span className={result.totalFound > 0 ? "text-primary/80 font-bold" : "text-primary/40"}>
                  {result.totalFound} subdomains
                </span>
              </div>
              <div className="flex gap-3 text-[11px]">
                <span className="text-primary/40">DNS: <span className="text-primary/70">{result.summary.withDns}</span></span>
                <span className="text-primary/40">HTTP: <span className="text-green-400">{result.summary.withHttp}</span></span>
                <span className="text-primary/40">HTTPS: <span className="text-green-400">{result.summary.withHttps}</span></span>
              </div>
              <div className="text-[10px] text-primary/30">
                Cert logs: {result.sources.certTransparency} · Brute: {result.sources.bruteForce}
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {(["all","https","http","dns"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors capitalize ${
                    filter === f ? "border-primary/40 text-primary/70 bg-primary/8" : "border-primary/15 text-primary/40 hover:border-primary/30"
                  }`}>
                  {f === "all" ? `All (${results.length})` : f === "https" ? `HTTPS (${results.filter(r => r.hasHttps).length})` : f === "http" ? `HTTP (${results.filter(r => r.hasHttp).length})` : `DNS only (${results.filter(r => r.ips.length > 0 && !r.hasHttp && !r.hasHttps).length})`}
                </button>
              ))}
            </div>

            {results.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-primary/20 mx-auto mb-2" />
                <div className="text-primary/30 text-sm">No subdomains found</div>
                <div className="text-primary/20 text-[11px] mt-1">Try enabling DNS brute-force or check the domain spelling</div>
              </div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filtered.map((s) => (
                  <div key={s.subdomain}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-primary/10 bg-black/20 hover:border-primary/20 transition-colors">
                    {/* Status icons */}
                    <div className="flex gap-1 shrink-0">
                      {s.hasHttps
                        ? <Lock className="w-3.5 h-3.5 text-green-400" />
                        : s.hasHttp
                        ? <Globe className="w-3.5 h-3.5 text-yellow-400" />
                        : <Globe className="w-3.5 h-3.5 text-primary/20" />
                      }
                    </div>
                    {/* Subdomain */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-primary/80 truncate">{s.subdomain}</div>
                      {s.ips.length > 0 && (
                        <div className="font-mono text-[10px] text-primary/35 truncate">
                          {s.ips.slice(0,3).join(", ")}{s.ips.length > 3 ? ` +${s.ips.length - 3}` : ""}
                          {s.cnames.length > 0 && ` → ${s.cnames[0]}`}
                        </div>
                      )}
                    </div>
                    {/* Badges */}
                    <div className="flex gap-1.5 shrink-0">
                      {s.hasHttps && <Badge variant="outline" className="text-[9px] border-green-400/30 text-green-400 px-1.5 py-0">HTTPS</Badge>}
                      {s.hasHttp && !s.hasHttps && <Badge variant="outline" className="text-[9px] border-yellow-400/30 text-yellow-400 px-1.5 py-0">HTTP</Badge>}
                      {s.source === "both" && <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/40 px-1.5 py-0">cert+dns</Badge>}
                      {s.source === "crt.sh" && <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/30 px-1.5 py-0">cert</Badge>}
                      {s.source === "brute" && <Badge variant="outline" className="text-[9px] border-orange-400/20 text-orange-400/60 px-1.5 py-0">brute</Badge>}
                    </div>
                    {/* Open link */}
                    {(s.hasHttp || s.hasHttps) && (
                      <a href={`${s.hasHttps ? "https" : "http"}://${s.subdomain}`} target="_blank" rel="noopener noreferrer"
                        className="text-primary/30 hover:text-primary/60 shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
