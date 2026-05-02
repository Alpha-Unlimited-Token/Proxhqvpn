// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useListVulnerabilities } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

export default function VulnerabilitiesList() {
  const [severity, setSeverity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data, isLoading } = useListVulnerabilities({
    severity: severity !== "all" ? severity : undefined,
    category: category !== "all" ? category : undefined
  });

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vulnerability Database</h1>
        <p className="text-muted-foreground mt-1">Cross-scan findings and historical security threats.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 border border-border bg-card/50 rounded-lg">
        <div className="flex-1">
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-full sm:w-[200px] font-mono">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-[250px] font-mono">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="reentrancy">Reentrancy</SelectItem>
              <SelectItem value="access_control">Access Control</SelectItem>
              <SelectItem value="quantum_crypto">Quantum Crypto</SelectItem>
              <SelectItem value="elliptic_curve">Elliptic Curve</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm font-mono text-muted-foreground">Showing {data?.total || 0} findings</div>
          {data?.vulnerabilities.map((vuln) => (
            <Card key={vuln.id} className="bg-card/40 border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div>
                    <h3 className="font-bold text-lg font-mono mb-2">{vuln.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3 max-w-3xl line-clamp-2">{vuln.description}</p>
                    <div className="flex gap-2 font-mono text-xs">
                      <Badge variant="outline" className={getSeverityColor(vuln.severity)}>
                        {vuln.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="bg-accent/50 text-muted-foreground">
                        {vuln.category.replace(/_/g, ' ')}
                      </Badge>
                      {vuln.isQuantumRelated && (
                        <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                          Quantum Related
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <Link href={`/scans/${vuln.scanId}`} className="text-primary hover:underline text-sm font-mono">
                      View Scan #{vuln.scanId}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
