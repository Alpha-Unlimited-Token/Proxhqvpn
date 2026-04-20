import { useGetSystemStats, useGetActiveConnections } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, Wifi } from "lucide-react";

export default function SystemMonitor() {
  const { data: sysStats } = useGetSystemStats({ query: { refetchInterval: 5000 } as any });
  const { data: connections } = useGetActiveConnections({ query: { refetchInterval: 5000 } as any });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Activity className="w-6 h-6" />
          System Monitor
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70">CPU Usage</CardTitle>
            <Cpu className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{sysStats?.cpuPercent ?? 0}%</div>
            <div className="w-full bg-primary/20 h-1 mt-2">
              <div className="bg-primary h-1" style={{ width: `${sysStats?.cpuPercent ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70">Memory</CardTitle>
            <HardDrive className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{sysStats?.memoryPercent ?? 0}%</div>
            <p className="text-xs text-primary/50 mt-1 font-mono">
              {sysStats?.memoryUsedMb}MB / {sysStats?.memoryTotalMb}MB
            </p>
            <div className="w-full bg-primary/20 h-1 mt-2">
              <div className="bg-primary h-1" style={{ width: `${sysStats?.memoryPercent ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70">Network IN</CardTitle>
            <Wifi className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{sysStats?.networkInMbps ?? 0}</div>
            <p className="text-xs text-primary/50 mt-1 font-mono">Mbps</p>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary/70">Network OUT</CardTitle>
            <Wifi className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{sysStats?.networkOutMbps ?? 0}</div>
            <p className="text-xs text-primary/50 mt-1 font-mono">Mbps</p>
          </CardContent>
        </Card>
      </div>

      <div className="border border-primary/20 rounded bg-black">
        <div className="p-3 border-b border-primary/20 text-xs font-bold text-primary/70 uppercase">
          Active Connections ({connections?.total ?? 0})
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-primary/20 hover:bg-transparent">
              <TableHead className="text-primary/70 text-xs">PROCESS</TableHead>
              <TableHead className="text-primary/70 text-xs">PID</TableHead>
              <TableHead className="text-primary/70 text-xs">PROTOCOL</TableHead>
              <TableHead className="text-primary/70 text-xs">LOCAL ADDRESS</TableHead>
              <TableHead className="text-primary/70 text-xs">REMOTE ADDRESS</TableHead>
              <TableHead className="text-primary/70 text-xs">STATE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections?.connections?.map((conn) => (
              <TableRow key={conn.id} className="border-primary/20 hover:bg-primary/5">
                <TableCell className="font-mono text-xs">{conn.process}</TableCell>
                <TableCell className="font-mono text-xs">{conn.pid}</TableCell>
                <TableCell className="font-mono text-xs text-primary/70 uppercase">{conn.protocol}</TableCell>
                <TableCell className="font-mono text-xs">{conn.localAddress}</TableCell>
                <TableCell className="font-mono text-xs text-orange-500">{conn.remoteAddress}</TableCell>
                <TableCell className="font-mono text-xs uppercase">{conn.state}</TableCell>
              </TableRow>
            ))}
            {!connections?.connections?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-primary/50 py-8">
                  NO ACTIVE CONNECTIONS
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
