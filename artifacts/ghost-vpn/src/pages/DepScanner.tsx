import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, CheckCircle, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-500 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
};

const ECOSYSTEM_PLACEHOLDER = `{
  "dependencies": {
    "lodash": "4.17.20",
    "axios": "0.21.1",
    "express": "4.18.2",
    "log4j-core": "2.14.0"
  }
}`;

export default function DepScanner() {
  const { toast } = useToast();
  const [manifest, setManifest] = useState(ECOSYSTEM_PLACEHOLDER);
  const [ecosystem, setEcosystem] = useState("npm");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function scan() {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}/api/dep-scanner/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest: manifest.trim(), ecosystem }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
      const cv = d.summary?.critical ?? 0;
      const hv = d.summary?.high ?? 0;
      toast({ title: `Scan complete — ${d.vulnerabilities?.length ?? 0} vulnerabilities found`, description: cv > 0 ? `${cv} critical, ${hv} high severity` : "Review findings below" });
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const vulns = result?.vulnerabilities ?? [];
  const safe = result?.safe ?? [];
  const summary = result?.summary ?? {};

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Dependency Vulnerability Scanner</h1>
        <p className="text-xs text-white/40 mt-1">SCA — scan package manifests against real CVE/GHSA databases (matches Snyk + OWASP Dependency-Check)</p>
      </div>

      {/* Summary cards */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Critical", val: summary.critical ?? 0, color: "text-red-500 border-red-500/30 bg-red-900/10" },
            { label: "High",     val: summary.high ?? 0,     color: "text-orange-400 border-orange-400/30 bg-orange-900/10" },
            { label: "Medium",   val: summary.medium ?? 0,   color: "text-yellow-400 border-yellow-400/30 bg-yellow-900/10" },
            { label: "Low",      val: summary.low ?? 0,      color: "text-blue-400 border-blue-400/30 bg-blue-900/10" },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.val}</div>
              <div className="text-[11px] uppercase tracking-widest opacity-70">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Package Manifest</div>
            <select value={ecosystem} onChange={e => setEcosystem(e.target.value)}
              className="bg-black/60 border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 rounded-lg">
              <option value="npm">npm (package.json)</option>
              <option value="pip">pip (requirements.txt)</option>
              <option value="maven">Maven (pom.xml)</option>
              <option value="gradle">Gradle</option>
            </select>
          </div>
          <Textarea
            value={manifest}
            onChange={e => setManifest(e.target.value)}
            rows={8}
            className="bg-black/60 border-primary/20 text-primary text-xs font-mono resize-none"
            placeholder="Paste your package.json, requirements.txt, or pom.xml content here…"
          />
          <Button onClick={scan} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
            Scan Dependencies
          </Button>
        </CardContent>
      </Card>

      {/* Vulnerability list */}
      {vulns.length > 0 && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Vulnerable Packages
              </div>
              <Badge className="bg-red-900/20 text-red-400 border-red-500/30 border text-[10px]">{vulns.length} found</Badge>
            </div>
            <div className="space-y-3">
              {vulns.map((v: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border ${SEV_COLOR[v.severity] ?? "border-white/10 bg-black/30 text-white/60"}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-bold text-xs">{v.package}@{v.version}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-[9px] border ${SEV_COLOR[v.severity]}`}>{v.severity}</Badge>
                      {v.cvss && <span className="text-[10px] opacity-60">CVSS {v.cvss}</span>}
                    </div>
                  </div>
                  <div className="text-[11px] opacity-80 mb-1">{v.description}</div>
                  <div className="flex items-center gap-3 text-[10px] opacity-60">
                    <span>{v.cve}</span>
                    {v.fixedIn && <span>Fix: <span className="text-green-400">≥ {v.fixedIn}</span></span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safe packages */}
      {safe.length > 0 && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-primary" /> Clean Packages
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30 border text-[10px]">{safe.length} clean</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {safe.map((s: any, idx: number) => (
                <span key={idx} className="text-[11px] font-mono px-2 py-1 rounded-lg bg-primary/5 border border-primary/15 text-primary/60">
                  {s.package}@{s.version}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
