import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSearch, AlertTriangle, CheckCircle, Loader2, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-500 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
  INFO:     "text-white/40 bg-white/5 border-white/10",
};

const SAMPLE_CODE = `// Sample vulnerable code — replace with your own
const express = require('express');
const mysql = require('mysql');
const app = express();

app.get('/user', (req, res) => {
  const id = req.query.id;
  const query = "SELECT * FROM users WHERE id = " + id; // SQL injection
  db.query(query, (err, result) => res.json(result));
});

app.get('/page', (req, res) => {
  res.send("<div>" + req.query.msg + "</div>"); // XSS
});

const SECRET_KEY = "hardcoded-secret-1234"; // hardcoded secret
eval(req.body.code); // dangerous eval
`;

export default function SastAnalyzer() {
  const { toast } = useToast();
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("javascript");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function analyze() {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}/api/sast/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), language }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
      const crit = d.summary?.critical ?? 0;
      const total = d.findings?.length ?? 0;
      toast({ title: `SAST complete — ${total} findings`, description: crit > 0 ? `${crit} critical issues require immediate attention` : "Review all findings below" });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const findings = result?.findings ?? [];
  const summary = result?.summary ?? {};

  const bySev: Record<string, any[]> = {};
  findings.forEach((f: any) => {
    if (!bySev[f.severity]) bySev[f.severity] = [];
    bySev[f.severity].push(f);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">SAST Analyzer</h1>
        <p className="text-xs text-white/40 mt-1">Static application security testing — 15 rule categories covering SQLi, XSS, SSRF, secrets, eval &amp; more</p>
      </div>

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: "Critical", val: summary.critical ?? 0, color: "text-red-500 border-red-500/30 bg-red-900/10" },
            { label: "High",     val: summary.high ?? 0,     color: "text-orange-400 border-orange-400/30 bg-orange-900/10" },
            { label: "Medium",   val: summary.medium ?? 0,   color: "text-yellow-400 border-yellow-400/30 bg-yellow-900/10" },
            { label: "Low",      val: summary.low ?? 0,      color: "text-blue-400 border-blue-400/30 bg-blue-900/10" },
            { label: "Score",    val: result.securityScore ?? "–", color: result.securityScore >= 70 ? "text-primary border-primary/30 bg-primary/5" : "text-red-400 border-red-500/30 bg-red-900/10" },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.val}{s.label === "Score" ? "/100" : ""}</div>
              <div className="text-[11px] uppercase tracking-widest opacity-70 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Code input */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Source Code</div>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="bg-black/60 border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 rounded-lg">
              <option value="javascript">JavaScript / Node.js</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="php">PHP</option>
              <option value="go">Go</option>
              <option value="ruby">Ruby</option>
            </select>
          </div>
          <Textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            rows={12}
            className="bg-black/60 border-primary/20 text-primary text-xs font-mono resize-none leading-relaxed"
            placeholder="Paste your source code here for static analysis…"
          />
          <Button onClick={analyze} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileSearch className="w-4 h-4 mr-1" />}
            Run SAST Analysis
          </Button>
        </CardContent>
      </Card>

      {/* Findings grouped by severity */}
      {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(sev => {
        const items = bySev[sev];
        if (!items?.length) return null;
        return (
          <Card key={sev} className="bg-black/40 border-primary/15">
            <CardContent className="p-4">
              <div className={`flex items-center justify-between mb-4 ${SEV_COLOR[sev]}`}>
                <div className="text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> {sev} Severity
                </div>
                <Badge className={`text-[10px] border ${SEV_COLOR[sev]}`}>{items.length}</Badge>
              </div>
              <div className="space-y-3">
                {items.map((f: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-lg border ${SEV_COLOR[f.severity]}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-bold text-xs">{f.rule}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.line && <span className="text-[10px] opacity-60">Line {f.line}</span>}
                        {f.cwe && <span className="text-[10px] opacity-60">{f.cwe}</span>}
                      </div>
                    </div>
                    <div className="text-[11px] opacity-80 mb-2">{f.message}</div>
                    {f.code && (
                      <div className="bg-black/50 rounded-lg p-2 border border-white/10 mb-2">
                        <code className="text-[11px] text-red-300/80 font-mono">{f.code}</code>
                      </div>
                    )}
                    {f.fix && (
                      <div className="text-[11px] text-primary/70">
                        <span className="text-white/30">Fix: </span>{f.fix}
                      </div>
                    )}
                    {f.references?.length > 0 && (
                      <div className="flex gap-2 mt-1.5">
                        {f.references.map((ref: string, ri: number) => (
                          <a key={ri} href={ref} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-primary/50 hover:text-primary/70 underline">{ref.split("/").pop()}</a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {result && findings.length === 0 && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
            <div className="text-sm font-semibold text-primary">No vulnerabilities detected</div>
            <div className="text-xs text-white/30 mt-1">Code passed all {result.rulesChecked ?? 15} SAST rules</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
