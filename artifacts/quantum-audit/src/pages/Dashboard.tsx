import { useGetQuantumAuditDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Activity, CheckCircle, Cpu, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetQuantumAuditDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Failed to load dashboard</h2>
        <p className="text-muted-foreground">Unable to fetch metrics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <Link href="/scan/new">
          <Button>New Scan</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalScans}</div>
            <p className="text-xs text-muted-foreground mt-1">{dashboard.completedScans} completed</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Findings</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{dashboard.criticalFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of {dashboard.totalVulnerabilities} total</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Quantum Risk</CardTitle>
            <Cpu className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{dashboard.avgQuantumRiskScore.toFixed(1)}/100</div>
            <p className="text-xs text-muted-foreground mt-1">Post-quantum readiness</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Chains</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{dashboard.highRiskChains.join(", ") || "None"}</div>
            <p className="text-xs text-muted-foreground mt-1">Most vulnerable environments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentScans.map((scan) => (
                <Link href={`/scans/${scan.id}`} key={scan.id} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors border border-border/50">
                    <div>
                      <div className="font-medium font-mono">{scan.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {scan.chain} • {scan.scanType}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${scan.status === 'complete' ? 'text-primary' : 'text-orange-500'}`}>
                        {scan.status.toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {scan.totalFindings} findings
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {dashboard.recentScans.length === 0 && (
                <div className="text-center text-muted-foreground py-4">No recent scans</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.topVulnerabilityCategories.map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div className="font-mono text-sm capitalize">{cat.category.replace(/_/g, ' ')}</div>
                  <div className="font-bold">{cat.count}</div>
                </div>
              ))}
              {dashboard.topVulnerabilityCategories.length === 0 && (
                <div className="text-center text-muted-foreground py-4">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
