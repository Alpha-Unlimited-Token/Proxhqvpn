import { useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";

import { 
  useGetHost, 
  useUpdateHost, 
  usePingHost,
  useListEvents,
  getGetHostQueryKey,
  getListEventsQueryKey
} from "@workspace/omega-api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Activity, Server, Clock, Calendar, AlertCircle } from "lucide-react";
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

export default function HostDetails() {
  const { id } = useParams<{ id: string }>();
  const hostId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: host, isLoading, isError } = useGetHost(hostId, {
    query: { enabled: !!hostId, queryKey: getGetHostQueryKey(hostId) }
  });

  const { data: events, isLoading: loadingEvents } = useListEvents({ hostId, limit: 10 }, {
    query: { enabled: !!hostId, queryKey: getListEventsQueryKey({ hostId, limit: 10 }) }
  });

  const updateHost = useUpdateHost();
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

  useEffect(() => {
    if (host) {
      form.reset({
        label: host.label,
        ip: host.ip,
        port: host.port,
        os: host.os || "",
        comments: host.comments || "",
      });
    }
  }, [host, form]);

  const onSubmit = (data: HostFormValues) => {
    updateHost.mutate({ id: hostId, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHostQueryKey(hostId) });
        toast({ title: "Host updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to update host", variant: "destructive" });
      }
    });
  };

  const handlePing = () => {
    pingHost.mutate({ id: hostId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetHostQueryKey(hostId) });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey({ hostId, limit: 10 }) });
        toast({ 
          title: `Ping result: ${result.status}`, 
          description: result.latencyMs ? `Latency: ${result.latencyMs}ms` : "Host unreachable",
          variant: result.status === "online" ? "default" : "destructive" 
        });
      }
    });
  };

  if (isError) {
    return (
      
        <div className="text-center py-20">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Host Not Found</h2>
          <p className="text-muted-foreground mt-2">The host you are looking for does not exist or has been removed.</p>
          <Button className="mt-6" onClick={() => setLocation("/omega-hosts")}>Back to Hosts</Button>
        </div>
      
    );
  }

  return (
    
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/omega-hosts">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate">
              {isLoading ? <Skeleton className="h-9 w-48" /> : host?.label}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {isLoading ? <Skeleton className="h-4 w-32" /> : (
                <>
                  <span className="font-mono">{host?.ip}:{host?.port}</span>
                  <span className="text-border">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      host?.status === 'online' ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]' : 
                      host?.status === 'offline' ? 'bg-destructive' : 'bg-muted-foreground'
                    }`} />
                    <span className="capitalize font-medium">{host?.status}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <Button 
            onClick={handlePing} 
            disabled={pingHost.isPending || isLoading}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            Ping Now
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Update host details and network parameters.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="label"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Label</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="os"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>OS / System</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IP Address</FormLabel>
                              <FormControl><Input className="font-mono" {...field} /></FormControl>
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
                              <FormControl><Input type="number" className="font-mono" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="comments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comments</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={updateHost.isPending || !form.formState.isDirty}>
                          {updateHost.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle>Recent Telemetry</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : events?.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No events logged for this host.</p>
                ) : (
                  <div className="space-y-3">
                    {events?.map(event => (
                      <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded bg-muted/30 border border-border/50 text-sm">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={event.severity === "error" ? "destructive" : event.severity === "warn" ? "secondary" : "outline"} className="text-[10px]">
                              {event.severity}
                            </Badge>
                            <span className="font-medium text-primary">[{event.category}]</span>
                            <span>{event.action}</span>
                          </div>
                          {event.details && <span className="text-muted-foreground text-xs ml-14">{event.details}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-2 sm:mt-0 whitespace-nowrap">
                          {format(new Date(event.createdAt), "MM/dd HH:mm:ss")}
                        </div>
                      </div>
                    ))}
                    {events && events.length >= 10 && (
                      <Button variant="link" className="w-full mt-2" onClick={() => setLocation(`/omega-events?hostId=${hostId}`)}>
                        View all events for this host
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle>Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/40">
                      <Clock className="h-5 w-5 text-secondary mt-0.5" />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latency</div>
                        <div className="font-mono text-lg mt-0.5">{host?.latencyMs ? `${host.latencyMs} ms` : "N/A"}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/40">
                      <Activity className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Seen</div>
                        <div className="font-mono text-sm mt-1">{host?.lastSeen ? format(new Date(host.lastSeen), "yyyy-MM-dd HH:mm:ss") : "Never"}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/40">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Added On</div>
                        <div className="font-mono text-sm mt-1">{host?.createdAt ? format(new Date(host.createdAt), "yyyy-MM-dd") : "N/A"}</div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    
  );
}