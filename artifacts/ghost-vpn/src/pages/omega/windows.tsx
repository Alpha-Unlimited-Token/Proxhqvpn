import { useState } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppWindow, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type WinEntry = { id: number; hostId: number; windowHandle: string; title: string; processName: string; isActive: boolean; isClosed: boolean; createdAt: string };

async function fetchWindows(hostId: number): Promise<WinEntry[]> {
  const r = await fetch(`${BASE}/api/windows/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function closeWindow(hostId: number, handle: string) {
  const r = await fetch(`${BASE}/api/windows/${hostId}/${handle}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export default function Windows() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: windows, isLoading, refetch } = useQuery({
    queryKey: ["windows", selectedHostId],
    queryFn: () => fetchWindows(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 15000,
  });

  const closeMut = useMutation({
    mutationFn: ({ handle }: { handle: string }) => closeWindow(selectedHostId!, handle),
    onSuccess: (_, { handle }) => {
      qc.invalidateQueries({ queryKey: ["windows", selectedHostId] });
      toast({ title: "Window closed", variant: "destructive" });
    },
  });

  const active = windows?.filter(w => w.isActive) ?? [];
  const inactive = windows?.filter(w => !w.isActive) ?? [];

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <AppWindow className="h-7 w-7 text-primary" /> Windows Manager
            </h1>
            <p className="text-muted-foreground mt-1">View and close open windows on remote hosts.</p>
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
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {selectedHostId && windows && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">TOTAL WINDOWS</p>
                <p className="text-2xl font-bold text-primary font-mono">{windows.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">ACTIVE</p>
                <p className="text-2xl font-bold text-green-400 font-mono">{active.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">BACKGROUND</p>
                <p className="text-2xl font-bold text-muted-foreground font-mono">{inactive.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to view open windows.</CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/40">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-mono text-xs">Window Title</TableHead>
                      <TableHead className="font-mono text-xs w-40">Process</TableHead>
                      <TableHead className="font-mono text-xs w-24">Handle</TableHead>
                      <TableHead className="font-mono text-xs w-24">Status</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(8)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : !windows || windows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No windows found.</TableCell>
                      </TableRow>
                    ) : (
                      windows.map(win => (
                        <TableRow key={win.id} className="border-border/50 hover:bg-muted/20 group">
                          <TableCell className="font-mono text-sm">
                            <span className={win.isActive ? "text-primary" : ""}>{win.title}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{win.processName}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{win.windowHandle}</TableCell>
                          <TableCell>
                            {win.isActive ? (
                              <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">background</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon"
                              className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => closeMut.mutate({ handle: win.windowHandle })}
                              disabled={closeMut.isPending}
                              title="Close window"
                            >
                              <X className="h-3.5 w-3.5" />
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
