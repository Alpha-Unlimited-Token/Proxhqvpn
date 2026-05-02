// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useGetScan } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, ShieldAlert, Cpu, AlertTriangle, CheckCircle, Clock, Terminal, ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

export default function ScanDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useGetScan(Number(id));
  const [expandedExploit, setExpandedExploit] = useState<Record<number, boolean>>({});

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-10 border border-destructive/50 bg-destructive/10 rounded-lg text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
        <h3 className="font-bold text-lg">Failed to load scan details</h3>
        <p className="text-muted-foreground">The scan may not exist or an error occurred.</p>
      </div>
    );
  }

  const { scan, vulnerabilities, quantumAnalysis } = data;

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "critical": return "text-destructive border-destructive bg-destructive/10";
      case "high": return "text-orange-500 border-orange-500 bg-orange-500/10";
      case "medium": return "text-yellow-500 border-yellow-500 bg-yellow-500/10";
      case "low": return "text-blue-500 border-blue-500 bg-blue-500/10";
      default: return "text-muted-foreground border-border bg-accent";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-mono tracking-tight">{scan.name}</h1>
            <Badge className={scan.status === 'complete' ? "bg-primary/20 text-primary" : "bg-accent"} variant="outline">
              {scan.status.toUpperCase()}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground font-mono flex items-center gap-4">
            <span>ID: {scan.id}</span>
            <span>Chain: {scan.chain}</span>
            <span>Type: {scan.scanType}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(scan.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        {scan.status === 'complete' && (
          <Link href={`/scans/${scan.id}/report`}>
            <Button className="font-mono">
              <FileText className="w-4 h-4 mr-2" /> Download Audit Report
            </Button>
          </Link>
        )}
      </div>

      {scan.status === 'running' && (
        <Card className="bg-card/50 border-primary/30">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">Scan in progress...</span>
              <span className="font-mono text-primary">{scan.progress}%</span>
            </div>
            <Progress value={scan.progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {scan.status === 'complete' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" /> Classical Vulnerabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 rounded bg-destructive/10 border border-destructive/20">
                  <div className="text-2xl font-bold text-destructive">{scan.criticalCount}</div>
                  <div className="text-xs font-mono mt-1 text-destructive/80">CRITICAL</div>
                </div>
                <div className="text-center p-3 rounded bg-orange-500/10 border border-orange-500/20">
                  <div className="text-2xl font-bold text-orange-500">{scan.highCount}</div>
                  <div className="text-xs font-mono mt-1 text-orange-500/80">HIGH</div>
                </div>
                <div className="text-center p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-2xl font-bold text-yellow-500">{scan.mediumCount}</div>
                  <div className="text-xs font-mono mt-1 text-yellow-500/80">MEDIUM</div>
                </div>
                <div className="text-center p-3 rounded bg-blue-500/10 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-500">{scan.lowCount}</div>
                  <div className="text-xs font-mono mt-1 text-blue-500/80">LOW</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {quantumAnalysis && (
            <Card className="bg-card/50 border-orange-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-500">
                  <Cpu className="w-5 h-5" /> Quantum Threat Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-orange-500 font-mono mb-1">{quantumAnalysis.riskScore}</div>
                  <div className="text-sm text-muted-foreground uppercase tracking-widest">Risk Score</div>
                </div>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Overall Risk</span>
                    <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500/50">
                      {quantumAnalysis.overallRisk}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Est. Break Year</span>
                    <span className="text-foreground">{quantumAnalysis.estimatedBreakYear || "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {scan.status === 'complete' && vulnerabilities.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Findings Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vulnerabilities.map((vuln) => (
              <div key={vuln.id} className="p-4 rounded-lg border border-border bg-background/50">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-lg font-mono">{vuln.title}</h4>
                      {vuln.isQuantumRelated && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                          <Cpu className="w-3 h-3 mr-1" /> Quantum
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 font-mono text-xs">
                      <Badge variant="outline" className={getSeverityColor(vuln.severity)}>
                        {vuln.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="bg-accent/50 text-muted-foreground">
                        {vuln.category}
                      </Badge>
                      {vuln.cweId && <span className="text-muted-foreground bg-accent/30 px-2 py-0.5 rounded">{vuln.cweId}</span>}
                      {vuln.cvssScore != null && (
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          vuln.cvssScore >= 9 ? "bg-red-900/30 text-red-400" :
                          vuln.cvssScore >= 7 ? "bg-orange-900/30 text-orange-400" :
                          vuln.cvssScore >= 4 ? "bg-yellow-900/30 text-yellow-400" :
                          "bg-blue-900/30 text-blue-400"
                        }`}>CVSS {vuln.cvssScore.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-foreground/80 mb-4">{vuln.description}</p>
                
                {vuln.affectedCode && (
                  <div className="bg-black/60 p-3 rounded border border-border/50 font-mono text-xs text-muted-foreground overflow-x-auto mb-4">
                    {vuln.lineNumber && <div className="text-primary/70 mb-1 select-none">Line {vuln.lineNumber}</div>}
                    <pre className="whitespace-pre-wrap break-all"><code>{vuln.affectedCode}</code></pre>
                  </div>
                )}
                
                <div className="bg-primary/5 border border-primary/20 p-3 rounded text-sm mb-3">
                  <div className="font-bold text-primary mb-1 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Recommendation
                  </div>
                  <p className="text-foreground/90">{vuln.recommendation}</p>
                </div>

                {vuln.references && vuln.references.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {vuln.references.map((ref: string, i: number) => (
                      <a key={i} href={ref} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary/50 hover:text-primary underline font-mono truncate max-w-xs">
                        {ref.replace(/^https?:\/\//, "")}
                      </a>
                    ))}
                  </div>
                )}

                {vuln.exploitPoC && (
                  <div className="border border-orange-500/30 rounded-lg overflow-hidden mt-2">
                    <button
                      onClick={() => setExpandedExploit(p => ({ ...p, [vuln.id]: !p[vuln.id] }))}
                      className="w-full flex items-center justify-between p-3 bg-orange-500/5 hover:bg-orange-500/10 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-bold text-orange-400 font-mono">Exploit PoC — {vuln.exploitPoC.exploitType}</span>
                        <span className="text-xs text-muted-foreground">({vuln.exploitPoC.language})</span>
                      </div>
                      {expandedExploit[vuln.id] ? <ChevronDown className="w-4 h-4 text-orange-400" /> : <ChevronRight className="w-4 h-4 text-orange-400" />}
                    </button>
                    {expandedExploit[vuln.id] && (
                      <div className="p-4 space-y-4 bg-background/60">
                        <p className="text-sm text-foreground/80">{vuln.exploitPoC.description}</p>
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded p-3 text-sm">
                          <p className="text-xs font-mono text-orange-400 mb-1">ATTACK VECTOR</p>
                          <p className="text-foreground/80">{vuln.exploitPoC.attackVector}</p>
                        </div>
                        <div className="bg-destructive/5 border border-destructive/20 rounded p-3 text-sm">
                          <p className="text-xs font-mono text-destructive mb-1">IMPACT</p>
                          <p className="text-foreground/80">{vuln.exploitPoC.impact}</p>
                        </div>
                        <div>
                          <p className="text-xs font-mono text-orange-400 mb-2">STEPS TO REPRODUCE</p>
                          <ol className="space-y-1">
                            {vuln.exploitPoC.stepsToReproduce.map((step: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                <span className="text-orange-400 font-mono font-bold flex-shrink-0">{i + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs font-mono text-orange-400 mb-2">PROOF-OF-CONCEPT CODE</p>
                          <div className="bg-black/70 rounded border border-orange-500/20 p-3 overflow-x-auto max-h-96 overflow-y-auto">
                            <pre className="text-xs font-mono text-orange-200 whitespace-pre">{vuln.exploitPoC.code}</pre>
                          </div>
                        </div>
                        {vuln.exploitPoC.defenseCode && (
                          <div>
                            <p className="text-xs font-mono text-green-400 mb-2">FIXED VERSION</p>
                            <div className="bg-black/70 rounded border border-green-500/20 p-3 overflow-x-auto max-h-64 overflow-y-auto">
                              <pre className="text-xs font-mono text-green-200 whitespace-pre">{vuln.exploitPoC.defenseCode}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
