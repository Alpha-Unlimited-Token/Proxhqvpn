import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Globe, Lock, Search, AlertCircle, CheckCircle, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Severity = "critical" | "high" | "medium" | "low" | "info";
interface Finding { category: string; severity: Severity; title: string; description: string; remediation: string }
interface AuditReport { findings: Finding[]; summary: Record<string,number>; overallRisk: string; auditedAt: string; version: string }

interface CertResult { host: string; port: number; subject?: any; issuer?: any; validFrom?: string; validTo?: string; daysLeft?: number; isExpired?: boolean; isExpiringSoon?: boolean; fingerprint?: string; subjectAltNames?: string[]; issues?: string[]; status?: string; error?: string }
interface HeaderResult { url: string; status: number; score: number; grade: string; missingCount: number; securityHeaders: { header: string; present: boolean; value?: string; severity: Severity; recommendation: string }[]; error?: string }

const SEV_COLORS: Record<Severity, string> = {
  critical: "text-red-400 border-red-400/50",
  high:     "text-orange-400 border-orange-400/50",
  medium:   "text-yellow-400 border-yellow-400/50",
  low:      "text-blue-400 border-blue-400/50",
  info:     "text-primary/50 border-primary/20",
};
const GRADE_COLORS: Record<string, string> = {
  A: "text-green-400 border-green-400/50", B: "text-primary border-primary/50",
  C: "text-yellow-400 border-yellow-400/50", F: "text-red-400 border-red-400/50",
};

export default function SecurityAudit() {
  const { toast } = useToast();
  const [report, setReport]       = useState<AuditReport | null>(null);
  const [certHost, setCertHost]   = useState("google.com");
  const [certPort, setCertPort]   = useState("443");
  const [certResult, setCertResult] = useState<CertResult | null>(null);
  const [certRunning, setCertRunning] = useState(false);
  const [headerUrl, setHeaderUrl] = useState("https://example.com");
  const [headerResult, setHeaderResult] = useState<HeaderResult | null>(null);
  const [headerRunning, setHeaderRunning] = useState(false);
  const [whoisTarget, setWhoisTarget] = useState("example.com");
  const [whoisResult, setWhoisResult] = useState<any>(null);
  const [whoisRunning, setWhoisRunning] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/security-audit/self-audit`);
      setReport(await r.json());
    } catch { }
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);

  const runCertCheck = async () => {
    setCertRunning(true);
    try {
      const r = await fetch(`${BASE}/api/security-audit/cert-inspect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: certHost, port: parseInt(certPort)||443 }),
      });
      setCertResult(await r.json());
    } finally { setCertRunning(false); }
  };

  const runHeaderCheck = async () => {
    setHeaderRunning(true);
    try {
      const r = await fetch(`${BASE}/api/security-audit/headers-inspect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: headerUrl }),
      });
      setHeaderResult(await r.json());
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setHeaderRunning(false); }
  };

  const runWhois = async () => {
    setWhoisRunning(true);
    try {
      const r = await fetch(`${BASE}/api/security-audit/whois`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: whoisTarget }),
      });
      setWhoisResult(await r.json());
    } finally { setWhoisRunning(false); }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Security Audit
          </h2>
          {report && (
            <>
              <Badge variant="outline" className="text-red-400 border-red-400/50 font-mono text-xs">{report.summary.critical ?? 0} CRITICAL</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/50 font-mono text-xs">{report.summary.high ?? 0} HIGH</Badge>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 font-mono text-xs">{report.summary.medium ?? 0} MEDIUM</Badge>
            </>
          )}
        </div>
        <Button onClick={loadReport} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs h-8">
          <RefreshCw className="w-3 h-3 mr-1.5" /> REFRESH AUDIT
        </Button>
      </div>

      {/* GhostNet Self-Audit */}
      {report && (
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-primary/10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">GhostNet Self-Audit — {report.version}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`font-mono text-xs ${report.overallRisk === "LOW" ? "text-green-400 border-green-400/50" : report.overallRisk === "MEDIUM" ? "text-yellow-400 border-yellow-400/50" : "text-red-400 border-red-400/50"}`}>
                  {report.overallRisk} RISK
                </Badge>
                <span className="text-[9px] font-mono text-primary/30">{new Date(report.auditedAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              {report.findings.map((f, i) => (
                <div key={i} className="border border-primary/10 rounded-sm p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] font-mono ${SEV_COLORS[f.severity]}`}>{f.severity.toUpperCase()}</Badge>
                    <Badge variant="outline" className="text-[9px] font-mono text-primary/40 border-primary/20">{f.category}</Badge>
                    <span className="text-xs font-mono text-primary font-bold">{f.title}</span>
                  </div>
                  <p className="text-[10px] font-mono text-primary/60">{f.description}</p>
                  <p className="text-[10px] font-mono text-primary/40"><span className="text-primary/30">REMEDIATION: </span>{f.remediation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Certificate Inspector */}
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10 flex items-center gap-2">
              <Lock className="w-3 h-3" /> TLS Certificate Inspector
            </div>
            <div className="flex gap-2">
              <Input value={certHost} onChange={e => setCertHost(e.target.value)}
                placeholder="hostname" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" />
              <Input value={certPort} onChange={e => setCertPort(e.target.value)}
                type="number" placeholder="Port" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 w-16" />
              <Button onClick={runCertCheck} disabled={certRunning} variant="outline"
                className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Search className={`w-3 h-3 mr-1 ${certRunning ? "animate-spin" : ""}`} /> {certRunning ? "..." : "INSPECT"}
              </Button>
            </div>
            {certResult && (
              certResult.error ? (
                <p className="text-red-400 text-xs font-mono">{certResult.error}</p>
              ) : (
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    {certResult.status === "valid"
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                    <Badge variant="outline" className={`text-[9px] ${certResult.status === "valid" ? "text-green-400 border-green-400/50" : certResult.status === "expiring" ? "text-yellow-400 border-yellow-400/50" : "text-red-400 border-red-400/50"}`}>
                      {certResult.status?.toUpperCase()}
                    </Badge>
                    <span className="text-primary/50">{certResult.daysLeft} days left</span>
                  </div>
                  {[
                    ["SUBJECT", certResult.subject?.CN],
                    ["ISSUER", certResult.issuer?.CN ?? certResult.issuer?.O],
                    ["VALID FROM", certResult.validFrom],
                    ["VALID TO", certResult.validTo],
                    ["FINGERPRINT", certResult.fingerprint?.slice(0, 40) + "..."],
                    ["SANS", certResult.subjectAltNames?.slice(0, 5).join(", ")],
                  ].map(([k, v]) => v && (
                    <div key={String(k)} className="flex gap-2">
                      <span className="text-primary/30 w-24 flex-shrink-0">{k}</span>
                      <span className="text-primary/80 truncate">{String(v)}</span>
                    </div>
                  ))}
                  {certResult.issues && certResult.issues.length > 0 && (
                    <div className="border-t border-primary/10 pt-2 space-y-1">
                      {certResult.issues.map((issue, i) => (
                        <p key={i} className={`text-[9px] ${issue.startsWith("CRITICAL") ? "text-red-400" : issue.startsWith("WARNING") ? "text-yellow-400" : "text-primary/50"}`}>{issue}</p>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* HTTP Headers Inspector */}
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10 flex items-center gap-2">
              <Globe className="w-3 h-3" /> HTTP Security Headers
            </div>
            <div className="flex gap-2">
              <Input value={headerUrl} onChange={e => setHeaderUrl(e.target.value)}
                placeholder="https://..." className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" />
              <Button onClick={runHeaderCheck} disabled={headerRunning} variant="outline"
                className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Search className={`w-3 h-3 mr-1 ${headerRunning ? "animate-spin" : ""}`} /> {headerRunning ? "..." : "SCAN"}
              </Button>
            </div>
            {headerResult && (
              headerResult.error ? (
                <p className="text-red-400 text-xs font-mono">{headerResult.error}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-lg font-mono font-bold px-3 py-1 ${GRADE_COLORS[headerResult.grade]}`}>{headerResult.grade}</Badge>
                    <div>
                      <p className="text-xs font-mono text-primary">{headerResult.score}/100 — {headerResult.missingCount} missing headers</p>
                      <p className="text-[9px] font-mono text-primary/40">HTTP {headerResult.status}</p>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {headerResult.securityHeaders.map((h, i) => (
                      <div key={i} className={`flex items-start gap-2 px-2 py-1.5 border rounded-sm text-[9px] font-mono ${h.present ? "border-green-500/20 bg-green-900/5" : "border-red-500/20 bg-red-900/5"}`}>
                        {h.present
                          ? <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                          : <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={h.present ? "text-green-400" : "text-red-400"}>{h.header}</span>
                            <Badge variant="outline" className={`text-[8px] ${SEV_COLORS[h.severity]}`}>{h.severity}</Badge>
                          </div>
                          {h.present && h.value && <p className="text-primary/40 truncate">{h.value}</p>}
                          {!h.present && <p className="text-primary/40">{h.recommendation}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* WHOIS */}
      <Card className="bg-black border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
            WHOIS / Domain Intelligence
          </div>
          <div className="flex gap-2">
            <Input value={whoisTarget} onChange={e => setWhoisTarget(e.target.value)}
              placeholder="domain.com or IP" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" />
            <Button onClick={runWhois} disabled={whoisRunning} variant="outline"
              className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10">
              <Search className={`w-3 h-3 mr-1 ${whoisRunning ? "animate-spin" : ""}`} /> {whoisRunning ? "..." : "LOOKUP"}
            </Button>
          </div>
          {whoisResult && (
            <pre className="text-[9px] font-mono text-primary/70 bg-black/60 border border-primary/10 p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap">
              {whoisResult.error ?? whoisResult.result}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
