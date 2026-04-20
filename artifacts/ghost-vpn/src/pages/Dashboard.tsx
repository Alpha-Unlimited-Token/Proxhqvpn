import { useGetSystemStats, useGetNodeStats, useGetBeaconStats, useGetFirewallStatus, useListBeaconAlerts, useListNodes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Server, ShieldAlert, Shield, ActivitySquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: sysStats } = useGetSystemStats({ query: { refetchInterval: 5000 } });
  const { data: nodeStats } = useGetNodeStats({ query: { refetchInterval: 8000 } });
  const { data: beaconStats } = useGetBeaconStats({ query: { refetchInterval: 6000 } });
  const { data: fwStatus } = useGetFirewallStatus({ query: { refetchInterval: 10000 } });

  const { data: recentAlerts } = useListBeaconAlerts({ status: 'active' }, { query: { refetchInterval: 5000 } });
  const { data: nodesData } = useListNodes(undefined, { query: { refetchInterval: 10000 } });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive border-destructive';
      case 'high': return 'text-orange-500 border-orange-500';
      case 'medium': return 'text-yellow-500 border-yellow-500';
      default: return 'text-primary border-primary/50';
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <h2 className="text-2xl font-bold tracking-tighter uppercase mb-6 flex items-center gap-2">
        <ActivitySquare className="w-6 h-6 text-primary" />
        Command Center
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black border-primary/20 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70 uppercase tracking-widest">Nodes Online</CardTitle>
            <Server className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{nodeStats?.activeNodes ?? "--"}/{nodeStats?.totalNodes ?? "--"}</div>
            <p className="text-xs text-primary/50 mt-1 font-mono">
              OUTER: {nodeStats?.outerNodes ?? 0} | INNER: {nodeStats?.innerNodes ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70 uppercase tracking-widest">System Load</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{sysStats?.cpuPercent ?? "--"}%</div>
            <p className="text-xs text-primary/50 mt-1 font-mono">
              RAM: {sysStats?.memoryPercent ?? "--"}% | UPTIME: {sysStats?.uptime ?? "--"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70 uppercase tracking-widest">Active Alerts</CardTitle>
            <ShieldAlert className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{beaconStats?.activeAlerts ?? "--"}</div>
            <p className="text-xs text-primary/50 mt-1 font-mono">
              CRIT: {beaconStats?.criticalAlerts ?? 0} | 24H: {beaconStats?.alertsLast24h ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20 hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70 uppercase tracking-widest">Firewall</CardTitle>
            <Shield className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{fwStatus?.enabled ? 'ACTIVE' : 'OFFLINE'}</div>
            <p className="text-xs text-primary/50 mt-1 uppercase font-mono">
              MODE: {fwStatus?.mode ?? "--"} | BLOCKS: {fwStatus?.blockedIps ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="bg-black border-primary/20 flex flex-col h-[400px]">
            <CardHeader className="border-b border-primary/20 pb-3">
              <CardTitle className="text-sm font-bold text-primary tracking-widest uppercase flex items-center gap-2">
                <Server className="w-4 h-4" />
                Live Node Feed (Top 5)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-primary/20 hover:bg-transparent">
                    <TableHead className="text-primary/70 text-xs">NODE</TableHead>
                    <TableHead className="text-primary/70 text-xs">IP</TableHead>
                    <TableHead className="text-primary/70 text-xs">REGION</TableHead>
                    <TableHead className="text-primary/70 text-xs">LATENCY</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodesData?.nodes?.slice(0, 5).map((node) => (
                    <TableRow key={node.id} className="border-primary/20 hover:bg-primary/5">
                      <TableCell className="font-mono text-xs">{node.name}</TableCell>
                      <TableCell className="font-mono text-xs">{node.ipAddress}</TableCell>
                      <TableCell className="font-mono text-xs">{node.region}</TableCell>
                      <TableCell className="font-mono text-xs">{node.latencyMs}ms</TableCell>
                    </TableRow>
                  ))}
                  {!nodesData?.nodes?.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-primary/50 py-8 font-mono text-xs">
                        NO NODES DETECTED
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
         </Card>

         <Card className="bg-black border-primary/20 flex flex-col h-[400px]">
            <CardHeader className="border-b border-primary/20 pb-3">
              <CardTitle className="text-sm font-bold text-destructive tracking-widest uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Recent Intrusion Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-primary/20 hover:bg-transparent">
                    <TableHead className="text-primary/70 text-xs">TIME</TableHead>
                    <TableHead className="text-primary/70 text-xs">TARGET</TableHead>
                    <TableHead className="text-primary/70 text-xs">ATTACKER</TableHead>
                    <TableHead className="text-primary/70 text-xs">SEVERITY</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAlerts?.alerts?.slice(0, 5).map((alert) => (
                    <TableRow key={alert.id} className="border-primary/20 hover:bg-primary/5">
                      <TableCell className="font-mono text-xs">{format(new Date(alert.detectedAt), 'HH:mm:ss')}</TableCell>
                      <TableCell className="font-mono text-xs">{alert.nodeName}</TableCell>
                      <TableCell className="font-mono text-xs text-destructive">{alert.attackerIp}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`uppercase text-[10px] ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!recentAlerts?.alerts?.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-primary/50 py-8 font-mono text-xs">
                        NO RECENT ALERTS
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
