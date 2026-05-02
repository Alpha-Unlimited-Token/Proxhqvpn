// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Loader2, BarChart2, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function EntropyBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 8) * 100);
  const color = value >= 6 ? "#00ff88" : value >= 4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
      <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all duration-500" />
    </div>
  );
}

export default function TokenSequencer() {
  const { toast } = useToast();
  const [tokens, setTokens] = useState("eyJhbGciOiJIUzI1NiJ9.user123\nABCDEF123456\ntoken_abc123xyz");
  const [sampleSize, setSampleSize] = useState("50");
  const [endpoint, setEndpoint] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function analyze() {
    const tokenList = tokens.split("\n").map(t => t.trim()).filter(Boolean);
    if (tokenList.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}/api/token-seq/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: tokenList, sampleSize: parseInt(sampleSize) || 50, endpoint }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const findings = result?.findings ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Token Entropy Sequencer</h1>
        <p className="text-xs text-white/40 mt-1">Measure token randomness, detect weak session IDs, predictable patterns &amp; sequential tokens</p>
      </div>

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Avg Entropy", val: `${result.summary?.avgEntropy?.toFixed(2) ?? "–"} bits`, color: result.summary?.avgEntropy >= 6 ? "text-primary border-primary/30 bg-primary/5" : "text-orange-400 border-orange-400/30 bg-orange-900/10" },
            { label: "Predictable", val: result.summary?.predictable ? "YES" : "NO", color: result.summary?.predictable ? "text-red-500 border-red-500/30 bg-red-900/10" : "text-primary border-primary/30 bg-primary/5" },
            { label: "Sequential",  val: result.summary?.sequential  ? "YES" : "NO", color: result.summary?.sequential  ? "text-red-500 border-red-500/30 bg-red-900/10" : "text-primary border-primary/30 bg-primary/5" },
            { label: "Risk Score",  val: result.summary?.riskScore ?? "–", color: "text-yellow-400 border-yellow-400/30 bg-yellow-900/10" },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
              <div className="text-xl font-bold">{s.val}</div>
              <div className="text-[11px] uppercase tracking-widest opacity-70 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Token Samples (one per line)</div>
            <Textarea
              value={tokens}
              onChange={e => setTokens(e.target.value)}
              rows={8}
              className="bg-black/60 border-primary/20 text-primary text-xs font-mono resize-none"
              placeholder="Paste tokens here, one per line…"
            />
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Options</div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Auto-Capture Sample Size</label>
              <Input value={sampleSize} onChange={e => setSampleSize(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" type="number" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Endpoint to capture from (optional)</label>
              <Input value={endpoint} onChange={e => setEndpoint(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono"
                placeholder="https://target.com/login" />
            </div>
            <Button onClick={analyze} disabled={loading} className="w-full bg-primary text-black font-bold hover:bg-primary/85">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Key className="w-4 h-4 mr-1" />}
              Analyze Tokens
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Per-token analysis */}
      {result?.tokens && result.tokens.length > 0 && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5" /> Per-Token Analysis
            </div>
            <div className="space-y-3">
              {result.tokens.map((t: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-black/30 border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[11px] text-white/60 font-mono truncate flex-1 mr-4">{t.token}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-white/40">Entropy:</span>
                      <span className={`text-[11px] font-bold ${t.entropy >= 6 ? "text-primary" : t.entropy >= 4 ? "text-yellow-400" : "text-red-400"}`}>
                        {t.entropy?.toFixed(2)} bits
                      </span>
                    </div>
                  </div>
                  <EntropyBar value={t.entropy} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {t.issues?.map((issue: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/20 border border-red-500/30 text-red-400">{issue}</span>
                    ))}
                    {t.format && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">{t.format}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Security Findings
            </div>
            <div className="space-y-2">
              {findings.map((f: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-orange-900/10 border border-orange-400/20">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-orange-400">{f.title}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{f.description}</div>
                    {f.recommendation && <div className="text-[11px] text-primary/70 mt-1">Rec: {f.recommendation}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
