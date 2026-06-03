// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Skull, Search, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api";

type Process = { id: number; hostId: number; pid: number; name: string; cpuPct: number; memMb: number; status: string; createdAt: string };

async function fetchProcesses(hostId: number): Promise<Process[]> {
  const r = await fetch(`${BASE}/processes/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function killProcess(hostId: number, pid: number) {
  const r = await fetch(`${BASE}/processes/${hostId}/${pid}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function procLabel(name: string): string {
  if (name.startsWith("SW:")) return "Service Worker";
  if (name === "[inline]" || name.startsWith("[inline-")) return "Inline Script";
  if (name.startsWith("[")) return "Browser Context";
  return "Script";
}

export default function Processes() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: procs, isLoading, refetch } = useQuery({
    queryKey: ["processes", selectedHostId],
    queryFn: () => fetchProcesses(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 15000,
  });

  const killMut = useMutation({
    mutationFn: ({ pid }: { pid: number }) => killProcess(selectedHostId!, pid),
    onSuccess: (_, { pid }) => {
      qc.invalidateQueries({ queryKey: ["processes", selectedHostId] });
      toast({ title: `Entry ${pid} removed`, variant: "destructive" });
    },
  });

  const filtered = procs?.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const totalMem = procs?.reduce((s, p) => s + p.memMb, 0) ?? 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Cpu className="h-7 w-7 text-primary" /> Process Inspector
            </h1>
            <p className="text-muted-foreground mt-1">Scripts, service workers, and JS heap usage reported by live agents.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => setSelectedHostId(parseInt(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a host..." /></SelectTrigger>
              <SelectContent>
                {hosts?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full inline-block ${h.status === 'online' ? 'bg-green-500' : h.status === 'offline' ? 'bg-red-500' : 'bg-gray-500'}`} />
                      {h.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHostId && (
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {selectedHostId && procs && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">ENTRIES</p>
                <p className="text-2xl font-bold text-primary font-mono">{procs.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">SERVICE WORKERS</p>
                <p className="text-2xl font-bold text-yellow-400 font-mono">
                  {procs.filter(p => p.name.startsWith("SW:")).length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">JS HEAP</p>
                <p className="text-2xl font-bold text-blue-400 font-mono">
                  {totalMem >= 1 ? `${totalMem.toFixed(0)}MB` : `${(totalMem * 1024).toFixed(0)}KB`}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to inspect browser processes.</CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/40">
            <CardContent className="p-0">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name..." className="pl-9 bg-black/20 border-border/50 font-mono" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-mono text-xs w-16">PID</TableHead>
                      <TableHead className="font-mono text-xs">Name / URL</TableHead>
                      <TableHead className="font-mono text-xs w-28">Type</TableHead>
                      <TableHead className="font-mono text-xs w-24 text-right">Memory</TableHead>
                      <TableHead className="font-mono text-xs w-20">Status</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(8)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(6)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No data — agent not connected or no scripts loaded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(proc => (
                        <TableRow key={proc.id} className="border-border/50 hover:bg-muted/20 group">
                          <TableCell className="font-mono text-xs text-muted-foreground">{proc.pid}</TableCell>
                          <TableCell className="font-mono text-sm font-medium max-w-xs truncate" title={proc.name}>{proc.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/20">{procLabel(proc.name)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {proc.memMb > 0 ? `${proc.memMb.toFixed(0)} MB` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">active</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon"
                              className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => killMut.mutate({ pid: proc.pid })}
                              disabled={killMut.isPending}
                              title={`Remove entry ${proc.pid}`}
                            >
                              <Skull className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
