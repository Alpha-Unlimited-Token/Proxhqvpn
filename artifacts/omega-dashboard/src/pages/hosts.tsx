// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListHosts,
  useDeleteHost,
  usePingHost,
  useCreateHost,
  getListHostsQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/omega-api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Plus, Activity, Trash2, Edit, Network, Code2, Copy, Check, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BASE_API = "/api";

const hostSchema = z.object({
  label: z.string().min(1, "Label is required"),
  ip: z.string().min(1, "IP address is required"),
  port: z.coerce.number().min(1).max(65535),
  os: z.string().optional(),
  comments: z.string().optional(),
});

type HostFormValues = z.infer<typeof hostSchema>;

type AgentInfo = { hostId: number; token: string; apiBase: string; script: string };

function AgentScriptDialog({ hostId, hostLabel }: { hostId: number; hostLabel: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fetchAgent = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_API}/hosts/${hostId}/agent-script`);
      if (!r.ok) throw new Error("Failed to generate agent script");
      const data = await r.json();
      setAgent(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !agent) fetchAgent();
  };

  const copyScript = () => {
    if (!agent) return;
    const snippet = `<script>\n${agent.script}\n</script>`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10" title="Generate agent script">
          <Code2 className="h-3.5 w-3.5" />
          <span className="text-xs hidden sm:inline">Agent</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Omega Agent — {hostLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm space-y-1">
            <p className="font-semibold text-primary">How to use</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Paste the script below into the <code className="bg-muted px-1 rounded text-xs">&lt;head&gt;</code> or <code className="bg-muted px-1 rounded text-xs">&lt;body&gt;</code> of
              the web page you want to test. Once the page loads, the agent connects back to Omega and begins streaming data.
              All Omega tools (keylogger, screen capture, remote commands, processes, etc.) will then receive live data.
            </p>
            <p className="text-yellow-400/80 text-xs">⚠ Use only on websites you own or have explicit written authorization to test.</p>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : agent ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-card border border-border rounded p-2">
                  <p className="text-muted-foreground/60 uppercase text-[10px] mb-1">Host ID</p>
                  <p className="text-primary">{agent.hostId}</p>
                </div>
                <div className="bg-card border border-border rounded p-2">
                  <p className="text-muted-foreground/60 uppercase text-[10px] mb-1">Agent Token</p>
                  <p className="text-primary truncate" title={agent.token}>{agent.token.substring(0, 16)}…</p>
                </div>
                <div className="bg-card border border-border rounded p-2 col-span-2">
                  <p className="text-muted-foreground/60 uppercase text-[10px] mb-1">API Base</p>
                  <p className="text-primary truncate">{agent.apiBase}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Agent Payload — copy and inject into target page</p>
                  <Button size="sm" variant="outline" onClick={copyScript} className="h-7 text-xs gap-1 border-primary/30 text-primary">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Snippet"}
                  </Button>
                </div>
                <pre className="bg-black/60 border border-border rounded-md p-3 text-[10px] font-mono text-green-400/90 overflow-auto max-h-72 leading-relaxed whitespace-pre-wrap">
{`<script>\n${agent.script.substring(0, 1200)}${agent.script.length > 1200 ? "\n/* … truncated — copy full script above … */" : "\n</script>"}`}
                </pre>
              </div>

              <Card className="border-border/40 bg-card/30">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground">Agent Capabilities</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {[
                      "✓ Real keystroke capture",
                      "✓ Canvas DOM screenshots",
                      "✓ localStorage / sessionStorage",
                      "✓ Cookie reader",
                      "✓ Form enumeration",
                      "✓ Loaded script inventory",
                      "✓ Remote JS execution",
                      "✓ HTML injection",
                      "✓ Element click & form fill",
                      "✓ Overlay injection",
                      "✓ Clipboard read/write",
                      "✓ Service worker discovery",
                      "✓ Browser fingerprint (OS, RAM, GPU, screen)",
                      "✓ Page navigation control",
                      "✓ Real-time event streaming",
                    ].map(cap => <p key={cap}>{cap}</p>)}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Hosts() {
  const { data: hosts, isLoading } = useListHosts();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createHost = useCreateHost();
  const deleteHost = useDeleteHost();
  const pingHost = usePingHost();

  const form = useForm<HostFormValues>({
    resolver: zodResolver(hostSchema),
    defaultValues: { label: "", ip: "", port: 22, os: "", comments: "" },
  });

  const onSubmit = (data: HostFormValues) => {
    createHost.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Host created successfully" });
      },
      onError: (err) => {
        toast({ title: "Error creating host", description: (err as any).message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this host?")) {
      deleteHost.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Host deleted" });
        }
      });
    }
  };

  const handlePing = (id: number) => {
    pingHost.mutate({ id }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListHostsQueryKey() });
        toast({
          title: `Ping: ${result.status}`,
          description: result.latencyMs ? `TCP latency: ${result.latencyMs}ms` : "Host unreachable (TCP timeout)",
          variant: result.status === "online" ? "default" : "destructive"
        });
      }
    });
  };

  const filteredHosts = hosts?.filter(h =>
    h.label.toLowerCase().includes(search.toLowerCase()) ||
    h.ip.includes(search)
  ) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Host Address Book</h1>
            <p className="text-muted-foreground mt-1">Manage hosts and deploy live Omega agents.</p>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search hosts..."
                className="pl-8 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add Host
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Host</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label</FormLabel>
                          <FormControl><Input placeholder="web-server-01" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IP / Hostname</FormLabel>
                            <FormControl><Input placeholder="192.168.1.1" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="os"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OS / System (Optional)</FormLabel>
                          <FormControl><Input placeholder="Ubuntu 22.04" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comments (Optional)</FormLabel>
                          <FormControl><Input placeholder="Primary database node" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={createHost.isPending}>
                      {createHost.isPending ? "Creating..." : "Save Host"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border bg-card/40">
          <CardContent className="p-0">
            <div className="rounded-md border-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[200px]">Host</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Latency</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredHosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No hosts found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHosts.map((host) => (
                      <TableRow key={host.id} className="group border-border/50 hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <Link href={`/hosts/${host.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                            <Network className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            {host.label}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {host.ip}:{host.port}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              host.status === 'online' ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]' :
                              host.status === 'offline' ? 'bg-destructive' : 'bg-muted-foreground'
                            }`} />
                            <span className="capitalize text-xs font-semibold">{host.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-sm">
                          {host.latencyMs ? `${host.latencyMs}ms` : '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-xs font-mono">
                          {host.lastSeen ? format(new Date(host.lastSeen), "MM/dd/yy HH:mm:ss") : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <AgentScriptDialog hostId={host.id} hostLabel={host.label} />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handlePing(host.id)}
                              disabled={pingHost.isPending}
                              title="TCP Ping"
                            >
                              <Activity className="h-4 w-4" />
                            </Button>
                            <Link href={`/hosts/${host.id}`}>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDelete(host.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
