import { useState } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, RefreshCw, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Screenshot = { id: number; hostId: number; label: string; widthPx: number; heightPx: number; sizeKb: number; createdAt: string };

async function fetchShots(hostId: number): Promise<Screenshot[]> {
  const r = await fetch(`${BASE}/api/screenshots/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function captureShot(hostId: number): Promise<Screenshot> {
  const r = await fetch(`${BASE}/api/screenshots/${hostId}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Desktop" }) });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const PALETTE = ["#1a1a2e","#16213e","#0f3460","#533483","#2d4059","#1b262c","#0a3d62","#1e3799"];

function ScreenCard({ shot, seed }: { shot: Screenshot; seed: number }) {
  const color = PALETTE[seed % PALETTE.length];
  const color2 = PALETTE[(seed + 3) % PALETTE.length];
  return (
    <Card className="border-border bg-card/40 hover:border-primary/40 transition-all overflow-hidden group">
      <div className="relative aspect-video" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color2} 100%)` }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Monitor className="w-16 h-16 text-white" />
        </div>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 21px),
            repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 21px)`
        }} />
        <div className="absolute inset-4 border border-white/10 rounded" />
        <div className="absolute top-3 left-3 right-3 h-4 bg-white/10 rounded-sm" />
        <div className="absolute top-9 left-3 w-2/3 h-2 bg-white/5 rounded-sm" />
        <div className="absolute top-14 left-3 right-3 bottom-3 bg-white/5 rounded-sm" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
          <p className="text-xs text-white/80 font-mono">ID #{shot.id} • {shot.widthPx}×{shot.heightPx} • {shot.sizeKb}kb</p>
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30">{shot.label}</Badge>
          <span className="text-xs text-muted-foreground font-mono">{format(new Date(shot.createdAt), "MM/dd HH:mm:ss")}</span>
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

  const { data: shots, isLoading } = useQuery({
    queryKey: ["screenshots", selectedHostId],
    queryFn: () => fetchShots(selectedHostId!),
    enabled: !!selectedHostId,
  });

  const captureMut = useMutation({
    mutationFn: () => captureShot(selectedHostId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screenshots", selectedHostId] });
      toast({ title: "Screenshot captured" });
    },
  });

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Camera className="h-7 w-7 text-primary" /> Screen Capture
            </h1>
            <p className="text-muted-foreground mt-1">Remote desktop screenshots from connected hosts.</p>
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
              <Button onClick={() => captureMut.mutate()} disabled={captureMut.isPending} className="gap-2">
                <Camera className="h-4 w-4" />
                {captureMut.isPending ? "Capturing..." : "Capture"}
              </Button>
            )}
          </div>
        </div>

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
            <CardContent className="py-16 text-center text-muted-foreground">No screenshots captured yet. Click Capture to take one.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shots.map((shot, i) => <ScreenCard key={shot.id} shot={shot} seed={shot.id + i} />)}
          </div>
        )}
      </div>
    
  );
}
