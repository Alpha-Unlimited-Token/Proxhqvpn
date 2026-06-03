// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { NoHostsBanner } from "@/components/omega/NoHostsBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Monitor, HardDrive, Cpu, MemoryStick, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SysInfo = {
  id: number; hostId: number; osName: string; osVersion: string; cpu: string;
  ramTotalMb: number; ramUsedMb: number; username: string; computerName: string;
  uptimeSeconds: number; diskTotalGb: number; diskUsedGb: number; resolution: string;
  lastUpdated: string;
};

async function fetchSysInfo(hostId: number): Promise<SysInfo> {
  const r = await fetch(`${BASE}/api/system-info/${hostId}`);
  if (!r.ok) throw new Error("No system info");
  return r.json();
}

async function refreshSysInfo(hostId: number): Promise<SysInfo> {
  const r = await fetch(`${BASE}/api/system-info/${hostId}/refresh`, { method: "POST" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function fmtUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function PctBar({ value, max, color = "#00ff41" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-muted/30 rounded-full h-2 mt-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function SystemInfo() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["system-info", selectedHostId],
    queryFn: () => fetchSysInfo(selectedHostId!),
    enabled: !!selectedHostId,
    retry: false,
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshSysInfo(selectedHostId!),
    onSuccess: (data) => {
      qc.setQueryData(["system-info", selectedHostId], data);
      toast({ title: "System info refreshed" });
    },
  });

  const ramPct = info ? (info.ramUsedMb / info.ramTotalMb) * 100 : 0;
  const diskPct = info ? (info.diskUsedGb / info.diskTotalGb) * 100 : 0;

  return (
    
      <div className="space-y-6">
        {hosts !== undefined && hosts.length === 0 && <NoHostsBanner />}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Monitor className="h-7 w-7 text-primary" /> System Info
            </h1>
            <p className="text-muted-foreground mt-1">Hardware and OS information from remote hosts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => setSelectedHostId(parseInt(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a host..." /></SelectTrigger>
              <SelectContent>
                {hosts?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full inline-block ${h.status === "online" ? "bg-green-500" : h.status === "offline" ? "bg-red-500" : "bg-gray-500"}`} />
                      {h.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHostId && (
              <Button variant="outline" size="icon" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
                <RefreshCw className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to view system info.</CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <Card key={i} className="bg-card/40 border-border"><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>)}
          </div>
        ) : isError ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">No system info available for this host.</CardContent>
          </Card>
        ) : info ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" /> Identity</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Computer Name</p><p className="font-mono text-sm text-primary">{info.computerName}</p></div>
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Username</p><p className="font-mono text-sm">{info.username}</p></div>
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Resolution</p><p className="font-mono text-sm">{info.resolution}</p></div>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Monitor className="h-4 w-4" /> Operating System</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">OS Name</p><p className="font-mono text-sm text-primary">{info.osName}</p></div>
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Version</p><p className="font-mono text-sm">{info.osVersion}</p></div>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Uptime</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono text-primary">{fmtUptime(info.uptimeSeconds)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Since last restart</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">Updated: {new Date(info.lastUpdated).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/40 border-border md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> Processor</CardTitle></CardHeader>
                <CardContent>
                  <p className="font-mono text-sm">{info.cpu}</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><MemoryStick className="h-4 w-4" /> Memory</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm font-mono mb-1">
                    <span className="text-primary">{(info.ramUsedMb / 1024).toFixed(1)} GB used</span>
                    <span className="text-muted-foreground">{(info.ramTotalMb / 1024).toFixed(1)} GB total</span>
                  </div>
                  <PctBar value={info.ramUsedMb} max={info.ramTotalMb} color={ramPct > 80 ? "#ef4444" : ramPct > 60 ? "#f59e0b" : "#00ff41"} />
                  <p className="text-xs text-muted-foreground mt-1">{ramPct.toFixed(0)}% used</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/40 border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><HardDrive className="h-4 w-4" /> Disk</CardTitle></CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm font-mono mb-1">
                  <span className="text-primary">{info.diskUsedGb.toFixed(1)} GB used</span>
                  <span className="text-muted-foreground">{info.diskTotalGb.toFixed(1)} GB total</span>
                </div>
                <PctBar value={info.diskUsedGb} max={info.diskTotalGb} color={diskPct > 85 ? "#ef4444" : diskPct > 70 ? "#f59e0b" : "#3b82f6"} />
                <p className="text-xs text-muted-foreground mt-1">{diskPct.toFixed(0)}% used — {(info.diskTotalGb - info.diskUsedGb).toFixed(1)} GB free</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    
  );
}
