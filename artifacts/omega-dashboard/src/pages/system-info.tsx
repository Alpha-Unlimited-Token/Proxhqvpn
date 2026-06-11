// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Monitor, HardDrive, Cpu, MemoryStick, User, Clock, Globe } from "lucide-react";

const BASE = "/api/omega";

type SysInfo = {
  id: number; hostId: number; osName: string; osVersion: string; cpu: string;
  ramTotalMb: number; ramUsedMb: number; username: string; computerName: string;
  uptimeSeconds: number; diskTotalGb: number; diskUsedGb: number; resolution: string;
  lastUpdated: string;
};

async function fetchSysInfo(hostId: number): Promise<SysInfo> {
  const r = await fetch(`${BASE}/system-info/${hostId}`);
  if (!r.ok) throw new Error("No system info");
  return r.json();
}

function fmtUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${secs % 60}s`;
}

function PctBar({ value, max, color = "#00ff41" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-muted/30 rounded-full h-2 mt-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function SystemInfo() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const { data: hosts } = useListHosts();

  const { data: info, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["system-info", selectedHostId],
    queryFn: () => fetchSysInfo(selectedHostId!),
    enabled: !!selectedHostId,
    retry: false,
    refetchInterval: 30000,
  });

  const ramPct = info && info.ramTotalMb > 0 ? (info.ramUsedMb / info.ramTotalMb) * 100 : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Monitor className="h-7 w-7 text-primary" /> System Info
            </h1>
            <p className="text-muted-foreground mt-1">Browser fingerprint and environment data sent by live Omega agents.</p>
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
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to view browser fingerprint data.</CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <Card key={i} className="bg-card/40 border-border"><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>)}
          </div>
        ) : isError ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">
              No system info yet — deploy the Omega agent on the target page and it will automatically send browser fingerprint data.
            </CardContent>
          </Card>
        ) : info ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Globe className="h-4 w-4" /> Browser / Origin</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Hostname</p><p className="font-mono text-sm text-primary">{info.computerName}</p></div>
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Language</p><p className="font-mono text-sm">{info.username}</p></div>
                  <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Screen Resolution</p><p className="font-mono text-sm">{info.resolution}</p></div>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Monitor className="h-4 w-4" /> Platform</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {/* navigator.platform always returns "Win32" even on 64-bit Windows — parse UA instead */}
                  {(() => {
                    const ua = info.osVersion ?? "";
                    let arch = "Unknown";
                    let archColor = "text-muted-foreground";
                    if (/Win64.*x64|x64.*Win64/i.test(ua)) { arch = "x64 (native 64-bit)"; archColor = "text-green-400"; }
                    else if (/WOW64/i.test(ua)) { arch = "x86 on WOW64 (32-bit browser on 64-bit OS)"; archColor = "text-yellow-400"; }
                    else if (/ARM64/i.test(ua)) { arch = "ARM64"; archColor = "text-blue-400"; }
                    else if (/Win32|Windows/i.test(ua)) { arch = "x86 or 64-bit (UA ambiguous)"; archColor = "text-orange-400"; }
                    const winVer = ua.match(/Windows NT ([\d.]+)/)?.[1];
                    const winName = winVer ? ({ "10.0": "Windows 10/11", "6.3": "Windows 8.1", "6.2": "Windows 8", "6.1": "Windows 7" } as Record<string, string>)[winVer] ?? `Windows NT ${winVer}` : null;
                    return (
                      <>
                        <div>
                          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Architecture (from UA)</p>
                          <p className={`font-mono text-sm font-semibold ${archColor}`}>{arch}</p>
                          <p className="text-[9px] text-muted-foreground/40 mt-0.5">navigator.platform always returns "Win32" — UA parsing is the only accurate method</p>
                        </div>
                        {winName && <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Windows Version</p><p className="font-mono text-sm">{winName}</p></div>}
                        <div><p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">User Agent</p><p className="font-mono text-xs leading-relaxed break-all text-muted-foreground/60">{ua.substring(0, 100)}</p></div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Session Uptime</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono text-primary">{fmtUptime(info.uptimeSeconds)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Since page load</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">Updated: {new Date(info.lastUpdated).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Cpu className="h-4 w-4" /> Hardware Concurrency</CardTitle></CardHeader>
                <CardContent>
                  <p className="font-mono text-sm">{info.cpu}</p>
                  <p className="text-xs text-muted-foreground mt-1">navigator.hardwareConcurrency — logical CPU cores</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><MemoryStick className="h-4 w-4" /> Device Memory</CardTitle></CardHeader>
                <CardContent>
                  {info.ramTotalMb > 0 ? (
                    <>
                      <div className="flex justify-between text-sm font-mono mb-1">
                        <span className="text-primary">{info.ramUsedMb > 0 ? `${info.ramUsedMb} MB JS heap` : "heap unavailable"}</span>
                        <span className="text-muted-foreground">{(info.ramTotalMb / 1024).toFixed(0)} GB device</span>
                      </div>
                      {info.ramUsedMb > 0 && (
                        <>
                          <PctBar value={info.ramUsedMb} max={info.ramTotalMb * 1024 / 16} color={ramPct > 80 ? "#ef4444" : ramPct > 60 ? "#f59e0b" : "#00ff41"} />
                          <p className="text-xs text-muted-foreground mt-1">performance.memory.usedJSHeapSize</p>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">navigator.deviceMemory not available (requires secure context)</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
