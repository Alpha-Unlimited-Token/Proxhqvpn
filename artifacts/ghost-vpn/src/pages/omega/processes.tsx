import { useState } from "react";

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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Process = { id: number; hostId: number; pid: number; name: string; cpuPct: number; memMb: number; status: string; createdAt: string };

async function fetchProcesses(hostId: number): Promise<Process[]> {
  const r = await fetch(`${BASE}/api/processes/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function killProcess(hostId: number, pid: number) {
  const r = await fetch(`${BASE}/api/processes/${hostId}/${pid}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
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
      toast({ title: `Process ${pid} terminated`, variant: "destructive" });
    },
  });

  const filtered = procs?.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const totalCpu = procs?.reduce((s, p) => s + p.cpuPct, 0) ?? 0;
  const totalMem = procs?.reduce((s, p) => s + p.memMb, 0) ?? 0;

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Cpu className="h-7 w-7 text-primary" /> Process Manager
            </h1>
            <p className="text-muted-foreground mt-1">View and terminate processes on remote hosts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => setSelectedHostId(parseInt(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a host..." /></SelectTrigger>
              <SelectContent>
                {hosts?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full inline-block ${h.status==='online'?'bg-green-500':h.status==='offline'?'bg-red-500':'bg-gray-500'}`} />
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
                <p className="text-xs text-muted-foreground mb-1">PROCESSES</p>
                <p className="text-2xl font-bold text-primary font-mono">{procs.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">CPU USAGE</p>
                <p className="text-2xl font-bold text-yellow-400 font-mono">{totalCpu.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">MEMORY</p>
                <p className="text-2xl font-bold text-blue-400 font-mono">{(totalMem/1024).toFixed(1)}GB</p>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to view running processes.</CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/40">
            <CardContent className="p-0">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter processes..." className="pl-9 bg-black/20 border-border/50 font-mono" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-mono text-xs w-20">PID</TableHead>
                      <TableHead className="font-mono text-xs">Process Name</TableHead>
                      <TableHead className="font-mono text-xs w-24 text-right">CPU %</TableHead>
                      <TableHead className="font-mono text-xs w-24 text-right">Memory</TableHead>
                      <TableHead className="font-mono text-xs w-20">Status</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(10)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(6)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No processes found.</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(proc => (
                        <TableRow key={proc.id} className="border-border/50 hover:bg-muted/20 group">
                          <TableCell className="font-mono text-xs text-muted-foreground">{proc.pid}</TableCell>
                          <TableCell className="font-mono text-sm font-medium">{proc.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            <span className={proc.cpuPct > 5 ? "text-yellow-400" : "text-muted-foreground"}>{proc.cpuPct.toFixed(1)}%</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{proc.memMb.toFixed(0)} MB</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">running</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon"
                              className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => killMut.mutate({ pid: proc.pid })}
                              disabled={killMut.isPending}
                              title={`Kill PID ${proc.pid}`}
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
    
  );
}
