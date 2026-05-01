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
import { Search, Plus, Activity, Trash2, Edit, Network } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const hostSchema = z.object({
  label: z.string().min(1, "Label is required"),
  ip: z.string().min(1, "IP address is required"),
  port: z.coerce.number().min(1).max(65535),
  os: z.string().optional(),
  comments: z.string().optional(),
});

type HostFormValues = z.infer<typeof hostSchema>;

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
    defaultValues: {
      label: "",
      ip: "",
      port: 22,
      os: "",
      comments: "",
    },
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
          title: `Ping result: ${result.status}`, 
          description: result.latencyMs ? `Latency: ${result.latencyMs}ms` : "Host unreachable",
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
            <p className="text-muted-foreground mt-1">Manage and monitor network infrastructure.</p>
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
                            <FormLabel>IP Address</FormLabel>
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
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
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
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => handlePing(host.id)}
                              disabled={pingHost.isPending}
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