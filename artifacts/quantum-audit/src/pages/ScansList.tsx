import { useListScans } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle, Plus, Cpu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ScansList() {
  const [status, setStatus] = useState<string>("all");
  const [chain, setChain] = useState<string>("all");
  
  const { data, isLoading, error } = useListScans({ 
    status: status !== "all" ? status : undefined,
    chain: chain !== "all" ? chain : undefined
  });

  const getStatusColor = (s: string) => {
    switch (s) {
      case "complete": return "bg-primary/20 text-primary border-primary/30";
      case "running": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Scans</h1>
          <p className="text-muted-foreground mt-1">View and manage blockchain security audits.</p>
        </div>
        <Link href="/scan/new">
          <Button><Plus className="w-4 h-4 mr-2" /> New Scan</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 border border-border bg-card/50 rounded-lg">
        <div className="flex-1">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Select value={chain} onValueChange={setChain}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chains</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="solana">Solana</SelectItem>
              <SelectItem value="bitcoin">Bitcoin</SelectItem>
              <SelectItem value="polygon">Polygon</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : error ? (
        <div className="p-10 border border-destructive/50 bg-destructive/10 rounded-lg text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h3 className="font-bold text-lg">Failed to load scans</h3>
          <p className="text-muted-foreground">Please try again later.</p>
        </div>
      ) : data?.scans.length === 0 ? (
        <div className="p-10 border border-border bg-card/30 rounded-lg text-center">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-bold text-lg">No scans found</h3>
          <p className="text-muted-foreground">Adjust your filters or create a new scan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.scans.map((scan) => (
            <Link href={`/scans/${scan.id}`} key={scan.id} className="block">
              <Card className="hover:border-primary/50 transition-colors bg-card/40 cursor-pointer">
                <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg font-mono">{scan.name}</h3>
                      <Badge className={getStatusColor(scan.status)} variant="outline">
                        {scan.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground font-mono">
                      <span>ID: #{scan.id}</span>
                      <span>Chain: {scan.chain}</span>
                      <span>Type: {scan.scanType}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    {scan.status === 'complete' && (
                      <>
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-orange-500" />
                          <span className="font-mono text-orange-500 font-bold">{scan.quantumRiskScore}/100</span>
                        </div>
                        <div className="flex gap-2">
                          {scan.criticalCount > 0 && <Badge variant="destructive">{scan.criticalCount} C</Badge>}
                          {scan.highCount > 0 && <Badge className="bg-orange-500">{scan.highCount} H</Badge>}
                          <Badge variant="secondary" className="bg-accent">{scan.totalFindings} Total</Badge>
                        </div>
                      </>
                    )}
                    {scan.status === 'running' && (
                      <div className="font-mono text-primary font-bold">
                        {scan.progress}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
