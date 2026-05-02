// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const GRADE_COLOR: Record<string, string> = {
  "A+": "text-green-400", A: "text-green-400", B: "text-yellow-400",
  C: "text-orange-400", D: "text-red-400", F: "text-red-500",
};
const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-500 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
};

export default function SslTlsAnalyzer() {
  const { toast } = useToast();
  const [host, setHost] = useState("example.com");
  const [port, setPort] = useState("443");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function scan() {
    if (!host.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/ssl-tls/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: host.trim(), port: parseInt(port) || 443 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const vulns = result?.vulnerabilities?.filter((v: any) => v.vulnerable) ?? [];
  const safe   = result?.vulnerabilities?.filter((v: any) => !v.vulnerable) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">SSL/TLS Analyzer</h1>
        <p className="text-xs text-white/40 mt-1">Grade certificates, enumerate ciphers, detect protocol vulnerabilities</p>
      </div>

      {/* Input */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">Hostname</label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="example.com"
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono"
                onKeyDown={e => e.key === "Enter" && scan()} />
            </div>
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">Port</label>
              <Input value={port} onChange={e => setPort(e.target.value)} placeholder="443"
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" />
            </div>
            <div className="flex items-end">
              <Button onClick={scan} disabled={loading}
                className="bg-primary text-black font-bold hover:bg-primary/85 px-5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["google.com", "badssl.com", "expired.badssl.com", "self-signed.badssl.com"].map(ex => (
              <button key={ex} onClick={() => setHost(ex)}
                className="text-[10px] border border-primary/20 text-primary/60 px-2 py-0.5 rounded hover:bg-primary/10 transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grade result */}
      {result && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center gap-6 p-4 border border-primary/15 bg-black/40 rounded-xl">
            <div className="text-center">
              <div className={`text-5xl font-black ${GRADE_COLOR[result.grade] ?? "text-white"}`}>{result.grade}</div>
              <div className="text-[9px] text-white/30 uppercase mt-1">Grade</div>
            </div>
            <div className="h-12 w-px bg-primary/10" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
              <span className="text-white/40">Host</span>      <span className="text-white">{result.host}:{result.port}</span>
              <span className="text-white/40">Protocol</span>  <span className="text-primary">{result.protocol || "—"}</span>
              <span className="text-white/40">Score</span>     <span className="text-white">{result.score}/100</span>
              <span className="text-white/40">HSTS</span>      <span className={result.hsts ? "text-green-400" : "text-red-400"}>{result.hsts ? "Enabled" : "Missing"}</span>
            </div>
          </div>

          {/* Certificate */}
          {result.cert && (
            <Card className="bg-black/40 border-primary/15">
              <CardContent className="p-4">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Certificate</div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                  <span className="text-white/40">Subject</span>
                  <span className="text-white break-all">{result.cert.subject?.CN || JSON.stringify(result.cert.subject)}</span>
                  <span className="text-white/40">Issuer</span>
                  <span className="text-white break-all">{result.cert.issuer?.O || result.cert.issuer?.CN || JSON.stringify(result.cert.issuer)}</span>
                  <span className="text-white/40">Valid From</span>
                  <span className="text-white">{new Date(result.cert.validFrom).toLocaleDateString()}</span>
                  <span className="text-white/40">Expires</span>
                  <span className={result.cert.daysRemaining < 30 ? "text-red-400 font-bold" : "text-white"}>
                    {new Date(result.cert.validTo).toLocaleDateString()} ({result.cert.daysRemaining}d)
                  </span>
                  <span className="text-white/40">Self-Signed</span>
                  <span className={result.cert.selfSigned ? "text-red-400" : "text-green-400"}>
                    {result.cert.selfSigned ? "Yes ⚠" : "No"}
                  </span>
                  {result.cert.subjectAltNames?.length > 0 && (
                    <>
                      <span className="text-white/40">SANs</span>
                      <span className="text-white/80 text-[11px]">{result.cert.subjectAltNames.slice(0, 5).join(", ")}{result.cert.subjectAltNames.length > 5 ? ` +${result.cert.subjectAltNames.length - 5}` : ""}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Protocols */}
          {result.supportedProtocols?.length > 0 && (
            <Card className="bg-black/40 border-primary/15">
              <CardContent className="p-4">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Protocol Support</div>
                <div className="flex flex-wrap gap-2">
                  {result.supportedProtocols.map((p: any) => (
                    <Badge key={p.version}
                      className={`text-xs font-mono ${p.supported ? "bg-green-900/30 text-green-400 border-green-500/20" : "bg-black/40 text-white/30 border-white/10"}`}>
                      {p.supported ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {p.version}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vulnerabilities */}
          {result.vulnerabilities?.length > 0 && (
            <Card className="bg-black/40 border-primary/15">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Vulnerability Checks</div>
                  <div className="flex gap-2 text-[10px]">
                    <span className="text-red-400">{vulns.length} vulnerable</span>
                    <span className="text-white/30">·</span>
                    <span className="text-green-400">{safe.length} safe</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {result.vulnerabilities.map((v: any) => (
                    <div key={v.id} className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs ${v.vulnerable ? SEV_COLOR[v.severity] : "bg-black/20 border-white/5 text-white/40"}`}>
                      {v.vulnerable ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <div className="min-w-0">
                        <div className="font-semibold">{v.name} <span className="text-[9px] opacity-60 ml-1">{v.id}</span></div>
                        <div className="opacity-70 mt-0.5">{v.description}</div>
                      </div>
                      {v.vulnerable && <Badge className={`ml-auto shrink-0 text-[9px] ${SEV_COLOR[v.severity]}`}>{v.severity}</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ciphers */}
          {result.ciphers?.length > 0 && (
            <Card className="bg-black/40 border-primary/15">
              <CardContent className="p-4">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Active Ciphers ({result.ciphers.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.ciphers.map((c: string) => (
                    <span key={c} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      c.includes("RC4") || c.includes("DES") || c.includes("NULL") || c.includes("EXPORT") || c.includes("anon")
                        ? "bg-red-900/20 border-red-500/20 text-red-400"
                        : c.includes("GCM") || c.includes("CHACHA") || c.includes("POLY")
                        ? "bg-green-900/20 border-green-500/20 text-green-400"
                        : "bg-primary/5 border-primary/15 text-primary/60"
                    }`}>{c}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
