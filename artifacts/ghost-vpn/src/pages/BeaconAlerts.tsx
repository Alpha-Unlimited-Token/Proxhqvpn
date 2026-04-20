import { useState } from "react";
import { useListBeaconAlerts, useDismissBeaconAlert, useTriggerBeacon, useListNodes, getListBeaconAlertsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldOff, AlertOctagon, Target, Ban } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function blockIpApi(ip: string, reason: string) {
  const r = await fetch(`${BASE}/api/firewall/blocked-ips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ip, reason }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
import { format } from "date-fns";

export default function BeaconAlerts() {
  const { data } = useListBeaconAlerts(undefined, { query: { refetchInterval: 5000 } as any });
  const { data: nodesData } = useListNodes(undefined, { query: { refetchInterval: 30000 } as any });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dismissAlert = useDismissBeaconAlert();
  const triggerBeacon = useTriggerBeacon();

  const blockIpMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason: string }) => blockIpApi(ip, reason),
    onSuccess: (_data, vars) => {
      toast({ title: "IP Blocked", description: `${vars.ip} has been added to the firewall blacklist.` });
      queryClient.invalidateQueries({ queryKey: ["firewall-blocked-ips"] });
    },
    onError: (e: Error) => toast({ title: "Block failed", description: e.message, variant: "destructive" }),
  });

  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ nodeId: '', probeType: 'ping' });

  const handleDismiss = (id: number) => {
    dismissAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert Dismissed", description: `Alert ${id} has been dismissed.` });
        queryClient.invalidateQueries({ queryKey: getListBeaconAlertsQueryKey() });
      }
    });
  };

  const handleTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerForm.nodeId) return;
    triggerBeacon.mutate({ data: { nodeId: Number(triggerForm.nodeId), probeType: triggerForm.probeType as any } }, {
      onSuccess: () => {
        toast({ title: "Beacon Triggered", description: `Simulated probe executed.` });
        setIsTriggerOpen(false);
        queryClient.invalidateQueries({ queryKey: getListBeaconAlertsQueryKey() });
      }
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive border-destructive';
      case 'high': return 'text-orange-500 border-orange-500';
      case 'medium': return 'text-yellow-500 border-yellow-500';
      default: return 'text-primary border-primary/50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <AlertOctagon className="w-6 h-6" />
          Intrusion Detection
        </h2>

        <Dialog open={isTriggerOpen} onOpenChange={setIsTriggerOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/20">
              <Target className="w-4 h-4 mr-2" />
              SIMULATE PROBE
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-primary/50 text-primary font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-widest text-primary/70">Trigger Beacon Test</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleTrigger} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Select value={triggerForm.nodeId} onValueChange={v => setTriggerForm({...triggerForm, nodeId: v})}>
                  <SelectTrigger className="border-primary/20 bg-black/50 text-primary">
                    <SelectValue placeholder="SELECT TARGET NODE" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-primary/50 text-primary">
                    {nodesData?.nodes?.map(n => (
                      <SelectItem key={n.id} value={n.id.toString()}>{n.name} ({n.ipAddress})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Select value={triggerForm.probeType} onValueChange={v => setTriggerForm({...triggerForm, probeType: v})}>
                  <SelectTrigger className="border-primary/20 bg-black/50 text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-primary/50 text-primary">
                    <SelectItem value="ping">PING SWEEP</SelectItem>
                    <SelectItem value="port_scan">PORT SCAN</SelectItem>
                    <SelectItem value="tunnel_probe">TUNNEL PROBE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={triggerBeacon.isPending} className="w-full bg-primary text-black hover:bg-primary/80">
                EXECUTE PROBE
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-primary/20 rounded bg-black">
        <Table>
          <TableHeader>
            <TableRow className="border-primary/20 hover:bg-transparent">
              <TableHead className="text-primary/70">TIME</TableHead>
              <TableHead className="text-primary/70">NODE</TableHead>
              <TableHead className="text-primary/70">ATTACKER IP</TableHead>
              <TableHead className="text-primary/70">TYPE</TableHead>
              <TableHead className="text-primary/70">SEVERITY</TableHead>
              <TableHead className="text-primary/70">STATUS</TableHead>
              <TableHead className="text-primary/70">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.alerts?.map((alert) => (
              <TableRow key={alert.id} className="border-primary/20 hover:bg-primary/5">
                <TableCell className="font-mono text-xs">{format(new Date(alert.detectedAt), 'HH:mm:ss.SSS')}</TableCell>
                <TableCell className="font-mono text-xs">{alert.nodeName}</TableCell>
                <TableCell className="font-mono text-xs text-destructive">{alert.attackerIp}</TableCell>
                <TableCell className="font-mono text-xs uppercase">{alert.probeType}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`uppercase text-xs ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-primary/30 text-primary/70 uppercase text-xs">
                    {alert.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20 h-6 px-2 text-xs"
                      onClick={() => blockIpMutation.mutate({ ip: alert.attackerIp, reason: `Auto-blocked: ${alert.probeType} detected by beacon` })}
                      disabled={blockIpMutation.isPending}
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      BLOCK IP
                    </Button>
                    {alert.status === 'active' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-primary/50 text-primary hover:bg-primary/20 h-6 px-2 text-xs"
                        onClick={() => handleDismiss(alert.id)}
                        disabled={dismissAlert.isPending}
                      >
                        <ShieldOff className="w-3 h-3 mr-1" />
                        DISMISS
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!data?.alerts?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-primary/50 py-8">
                  NO ACTIVE INTRUSIONS DETECTED
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
