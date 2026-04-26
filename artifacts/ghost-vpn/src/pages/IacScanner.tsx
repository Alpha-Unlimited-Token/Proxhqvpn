import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileCode2, AlertTriangle, CheckCircle, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-900/10 text-red-400",
  HIGH:     "border-orange-400/30 bg-orange-900/10 text-orange-400",
  MEDIUM:   "border-yellow-400/30 bg-yellow-900/10 text-yellow-400",
  LOW:      "border-blue-400/30 bg-blue-900/10 text-blue-400",
  INFO:     "border-primary/20 bg-primary/5 text-primary/60",
};

const SAMPLE_DOCKERFILE = `FROM ubuntu:latest
USER root
RUN apt-get update && apt-get install -y curl
ADD secrets.txt /app/
EXPOSE 22
ENV AWS_SECRET_KEY=AKIAIOSFODNN7EXAMPLE
CMD ["./start.sh"]`;

const SAMPLE_TERRAFORM = `resource "aws_s3_bucket" "data" {
  bucket = "my-bucket"
}

resource "aws_security_group" "web" {
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`;

export default function IacScanner() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("Dockerfile");
  const [content, setContent] = useState(SAMPLE_DOCKERFILE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  function loadSample(name: string, code: string) {
    setFilename(name);
    setContent(code);
    setResult(null);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = ev => { setContent(ev.target?.result as string ?? ""); setResult(null); };
    reader.readAsText(file);
  }

  async function scan() {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/iac-scan/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content }),
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

  const findings: any[] = result?.findings ?? [];
  const bySev = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(s => ({
    sev: s, count: findings.filter(f => f.severity === s).length
  })).filter(x => x.count > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">IaC Security Scanner</h1>
        <p className="text-xs text-white/40 mt-1">Scan Dockerfiles, Terraform, Kubernetes, and GitHub Actions for misconfigurations</p>
      </div>

      {/* Samples */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Dockerfile (insecure)", name: "Dockerfile", code: SAMPLE_DOCKERFILE },
          { label: "Terraform (open SG)", name: "main.tf", code: SAMPLE_TERRAFORM },
        ].map(s => (
          <button key={s.label} onClick={() => loadSample(s.name, s.code)}
            className="text-[10px] border border-primary/20 text-primary/60 px-2.5 py-1 rounded hover:bg-primary/10 transition-colors">
            {s.label}
          </button>
        ))}
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-[10px] border border-primary/20 text-primary/60 px-2.5 py-1 rounded hover:bg-primary/10 transition-colors">
          <Upload className="w-3 h-3" /> Upload file
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload}
          accept=".tf,.yml,.yaml,Dockerfile,dockerfile,.dockerfile" />
      </div>

      {/* Editor */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <input value={filename} onChange={e => setFilename(e.target.value)}
              className="bg-transparent border-b border-primary/20 text-primary text-sm font-mono focus:outline-none focus:border-primary/50 w-48 py-0.5"
              placeholder="Filename (e.g. Dockerfile)" />
            <Button onClick={scan} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileCode2 className="w-4 h-4 mr-1" />}
              Scan
            </Button>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={14}
            className="w-full bg-black/60 border border-primary/15 text-primary text-[12px] font-mono rounded-lg p-3 resize-y focus:outline-none focus:border-primary/40 placeholder:text-white/20"
            placeholder="Paste IaC content here…"
          />
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4 p-4 border border-primary/15 bg-black/40 rounded-xl">
            <div>
              <div className={`text-2xl font-black ${findings.length > 0 ? "text-red-400" : "text-green-400"}`}>{findings.length}</div>
              <div className="text-[9px] text-white/30 uppercase mt-0.5">Findings</div>
            </div>
            <div className="h-8 w-px bg-primary/10" />
            <div className="text-xs text-white/40">
              File type: <span className="text-primary">{result.fileType}</span>
            </div>
            {findings.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" /> No issues found
              </div>
            )}
            <div className="ml-auto flex gap-2">
              {bySev.map(({ sev, count }) => (
                <Badge key={sev} className={`text-[10px] ${SEV_COLOR[sev]} border`}>
                  {count} {sev}
                </Badge>
              ))}
            </div>
          </div>

          {/* Findings list */}
          {findings.length > 0 && (
            <div className="space-y-2">
              {findings.map((f: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg border ${SEV_COLOR[f.severity]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">{f.title} <span className="text-[9px] opacity-50 ml-1">{f.ruleId}</span></div>
                        <div className="text-[11px] opacity-70 mt-0.5">{f.description}</div>
                        {f.snippet && (
                          <pre className="mt-1.5 text-[10px] bg-black/40 px-2 py-1 rounded border border-white/5 font-mono break-all whitespace-pre-wrap opacity-80">{f.snippet}</pre>
                        )}
                        <div className="text-[10px] opacity-50 mt-1.5">
                          Line {f.line} · Remediation: {f.remediation}
                        </div>
                      </div>
                    </div>
                    <Badge className={`shrink-0 text-[9px] ${SEV_COLOR[f.severity]} border`}>{f.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
