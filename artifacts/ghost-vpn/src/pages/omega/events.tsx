import { useState } from "react";

import { 
  useListEvents,
  useListHosts,
  getListEventsQueryKey
} from "@workspace/omega-api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Filter, Network } from "lucide-react";

export default function Events() {
  const searchParams = new URLSearchParams(window.location.search);
  const hostIdParam = searchParams.get("hostId");
  
  const [category, setCategory] = useState<string | null>(null);
  const [hostIdFilter, setHostIdFilter] = useState<number | null>(hostIdParam ? parseInt(hostIdParam, 10) : null);

  const { data: hosts } = useListHosts();
  
  const params: any = {};
  if (category && category !== "all") params.category = category;
  if (hostIdFilter && hostIdFilter !== 0) params.hostId = hostIdFilter;
  
  const { data: events, isLoading } = useListEvents(params, {
    query: { queryKey: getListEventsQueryKey(params) }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "destructive";
      case "warn": return "secondary";
      case "info": default: return "default";
    }
  };

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Event Log</h1>
            <p className="text-muted-foreground mt-1">System-wide audit trail and telemetry history.</p>
          </div>
          
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={hostIdFilter ? hostIdFilter.toString() : "0"} 
                onValueChange={(val) => setHostIdFilter(val === "0" ? null : parseInt(val, 10))}
              >
                <SelectTrigger className="w-[150px] border-0 bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="All Hosts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Hosts</SelectItem>
                  {hosts?.map(h => (
                    <SelectItem key={h.id} value={h.id.toString()}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Select value={category || "all"} onValueChange={(val) => setCategory(val === "all" ? null : val)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="network">Network</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="health">Health</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-border bg-card/40">
          <CardContent className="p-0">
            <div className="rounded-md border-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="w-[120px]">Category</TableHead>
                    <TableHead className="w-[200px]">Host</TableHead>
                    <TableHead>Event Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full max-w-[300px]" /></TableCell>
                      </TableRow>
                    ))
                  ) : events?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        No events match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    events?.map((event) => (
                      <TableRow key={event.id} className="group border-border/50 hover:bg-muted/30 text-sm">
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                          {format(new Date(event.createdAt), "yyyy-MM-dd HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(event.severity) as any} className="uppercase text-[10px]">
                            {event.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {event.category}
                        </TableCell>
                        <TableCell>
                          {event.hostLabel ? (
                            <div className="flex items-center gap-2">
                              <Network className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[150px]">{event.hostLabel}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium mr-2">{event.action}</span>
                          {event.details && <span className="text-muted-foreground">{event.details}</span>}
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
    
  );
}