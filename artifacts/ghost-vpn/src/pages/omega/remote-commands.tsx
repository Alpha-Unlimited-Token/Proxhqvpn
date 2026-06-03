// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { NoHostsBanner } from "@/components/omega/NoHostsBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TerminalSquare, Globe, Search, FlipHorizontal2, Monitor, ScreenShare,
  Power, PowerOff, Volume2, Clock, Calendar, Palette, Printer, Mouse, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type RCmd = { id: number; hostId: number; commandType: string; params: string; status: string; result: string; executedAt: string };

type CommandDef = {
  type: string;
  label: string;
  icon: React.ElementType;
  group: string;
  paramLabel?: string;
  paramPlaceholder?: string;
  dangerous?: boolean;
};

const COMMANDS: CommandDef[] = [
  { type: "open_url",         label: "Open URL",         icon: Globe,          group: "Browser",  paramLabel: "URL", paramPlaceholder: "https://example.com" },
  { type: "find_files",       label: "Find Files",       icon: Search,         group: "Browser",  paramLabel: "Filename pattern", paramPlaceholder: "*.txt" },
  { type: "flip_screen",      label: "Flip Screen",      icon: FlipHorizontal2,group: "Display" },
  { type: "set_resolution",   label: "Set Resolution",   icon: Monitor,        group: "Display",  paramLabel: "Resolution", paramPlaceholder: "1024x768" },
  { type: "screensaver",      label: "Screen Saver",     icon: ScreenShare,    group: "Display" },
  { type: "restart_windows",  label: "Restart Windows",  icon: Power,          group: "Power",    dangerous: true },
  { type: "shutdown_windows", label: "Shutdown",         icon: PowerOff,       group: "Power",    dangerous: true },
  { type: "set_volume",       label: "Set Volume",       icon: Volume2,        group: "System",   paramLabel: "Volume (0–100)", paramPlaceholder: "50" },
  { type: "set_time",         label: "Set Time",         icon: Clock,          group: "System",   paramLabel: "Time (HH:MM)", paramPlaceholder: "12:00" },
  { type: "set_date",         label: "Set Date",         icon: Calendar,       group: "System",   paramLabel: "Date (MM/DD/YYYY)", paramPlaceholder: "01/01/2025" },
  { type: "win_colors",       label: "Win Colors",       icon: Palette,        group: "System",   paramLabel: "Preset", paramPlaceholder: "default" },
  { type: "print_text",       label: "Print Text",       icon: Printer,        group: "Misc",     paramLabel: "Text to print", paramPlaceholder: "Hello World" },
  { type: "set_mouse_speed",  label: "Mouse Speed",      icon: Mouse,          group: "Misc",     paramLabel: "Speed (1–20)", paramPlaceholder: "10" },
];

const GROUPS = ["Browser", "Display", "Power", "System", "Misc"];

async function fetchHistory(hostId: number): Promise<RCmd[]> {
  const r = await fetch(`${BASE}/api/remote-commands/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function execCommand(hostId: number, commandType: string, params: string) {
  const r = await fetch(`${BASE}/api/remote-commands/${hostId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandType, params }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function CommandCard({ cmd, hostId, onExec }: { cmd: CommandDef; hostId: number; onExec: (type: string, params: string) => void }) {
  const [param, setParam] = useState("");
  const Icon = cmd.icon;

  return (
    <div className={`border rounded-md p-3 flex flex-col gap-2 bg-card/40 ${cmd.dangerous ? "border-red-500/30" : "border-border/50"} hover:bg-muted/10`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${cmd.dangerous ? "text-red-400" : "text-primary"}`} />
        <span className="font-mono text-sm font-medium">{cmd.label}</span>
      </div>
      {cmd.paramLabel && (
        <Input
          value={param}
          onChange={e => setParam(e.target.value)}
          placeholder={cmd.paramPlaceholder}
          className="h-7 text-xs font-mono bg-black/20 border-border/50"
        />
      )}
      <Button
        size="sm"
        variant={cmd.dangerous ? "destructive" : "outline"}
        className={`h-7 text-xs w-full ${!cmd.dangerous ? "border-primary/30 text-primary hover:bg-primary/10" : ""}`}
        onClick={() => onExec(cmd.type, param)}
      >
        Execute
      </Button>
    </div>
  );
}

export default function RemoteCommands() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: history, isLoading, refetch } = useQuery({
    queryKey: ["remote-commands", selectedHostId],
    queryFn: () => fetchHistory(selectedHostId!),
    enabled: !!selectedHostId,
  });

  const execMut = useMutation({
    mutationFn: ({ type, params }: { type: string; params: string }) => execCommand(selectedHostId!, type, params),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["remote-commands", selectedHostId] });
      toast({ title: `Command executed`, description: data.result });
    },
  });

  const handleExec = (type: string, params: string) => {
    const cmd = COMMANDS.find(c => c.type === type);
    if (cmd?.dangerous) {
      if (!window.confirm(`Are you sure you want to send "${cmd.label}" to the remote host?`)) return;
    }
    execMut.mutate({ type, params });
  };

  return (
    
      <div className="space-y-6">
        {hosts !== undefined && hosts.length === 0 && <NoHostsBanner />}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <TerminalSquare className="h-7 w-7 text-primary" /> Remote Commands
            </h1>
            <p className="text-muted-foreground mt-1">Execute commands on remote hosts — browser, display, power, system, misc.</p>
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

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to execute remote commands.</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {GROUPS.map(group => {
              const cmds = COMMANDS.filter(c => c.group === group);
              return (
                <div key={group}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest mb-2 uppercase">{group}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {cmds.map(cmd => (
                      <CommandCard key={cmd.type} cmd={cmd} hostId={selectedHostId} onExec={handleExec} />
                    ))}
                  </div>
                </div>
              );
            })}

            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Command History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted/20 rounded animate-pulse" />)}</div>
                ) : !history || history.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No commands executed yet.</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
                    {history.map(h => {
                      const cmd = COMMANDS.find(c => c.type === h.commandType);
                      const Icon = cmd?.icon ?? TerminalSquare;
                      return (
                        <div key={h.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-primary">{h.commandType}</span>
                          {h.params && <span className="text-muted-foreground truncate">{h.params}</span>}
                          <span className="ml-auto text-muted-foreground/50 shrink-0">{new Date(h.executedAt).toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400 shrink-0">{h.status}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    
  );
}
