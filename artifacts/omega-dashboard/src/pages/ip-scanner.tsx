import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation } from "@tanstack/react-query";
import { ScanLine, Wifi, WifiOff, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ScanResult = { ip: string; port: number; open: boolean; latencyMs: number; known: boolean };
type ScanResponse = { results: ScanResult[]; scanned: number; found: number };

async function runScan(startIp: string, endIp: string, port: number): Promise<ScanResponse> {
  const r = await fetch(`${BASE}/api/tools/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startIp, endIp, port }),
  });
  if (!r.ok) throw new Error("Scan failed");
  return r.json();
}

export default function IpScanner() {
  const [startIp, setStartIp] = useState("192.168.1.1");
  const [endIp, setEndIp] = useState("192.168.1.254");
  const [port, setPort] = useState("54896");
  const { toast } = useToast();

  const scanMut = useMutation({
    mutationFn: () => runScan(startIp, endIp, parseInt(port)),
    onSuccess: (data) => {
      toast({ title: `Scan complete`, description: `Found ${data.found} hosts out of ${data.scanned} scanned` });
    },
    onError: () => toast({ title: "Scan failed", variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ScanLine className="h-7 w-7 text-primary" /> IP Scanner
          </h1>
          <p className="text-muted-foreground mt-1">Scan IP ranges for hosts with open controller ports.</p>
        </div>

        <Card className="border-border bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Scan Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-mono mb-1 block">START IP</label>
                <Input value={startIp} onChange={e => setStartIp(e.target.value)} className="font-mono bg-black/20 border-border/50" placeholder="192.168.1.1" />
              </div>
              <div className="hidden sm:flex items-center pb-2 text-muted-foreground">—</div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-mono mb-1 block">END IP</label>
                <Input value={endIp} onChange={e => setEndIp(e.target.value)} className="font-mono bg-black/20 border-border/50" placeholder="192.168.1.254" />
              </div>
              <div className="w-32">
                <label className="text-xs text-muted-foreground font-mono mb-1 block">PORT</label>
                <Input value={port} onChange={e => setPort(e.target.value)} className="font-mono bg-black/20 border-border/50" placeholder="54896" />
              </div>
              <Button onClick={() => scanMut.mutate()} disabled={scanMut.isPending} className="gap-2 w-full sm:w-auto">
                <ScanLine className="h-4 w-4" />
                {scanMut.isPending ? "Scanning..." : "Start Scan"}
              </Button>
            </div>

            {scanMut.isPending && (
              <div className="mt-4 flex items-center gap-3 text-primary font-mono text-sm">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                Scanning {startIp} → {endIp} on port {port}...
              </div>
            )}
          </CardContent>
        </Card>

        {scanMut.data && (
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Scan Results</span>
                <div className="flex gap-3 text-xs font-normal font-mono text-muted-foreground">
                  <span>Scanned: <span className="text-foreground">{scanMut.data.scanned}</span></span>
                  <span>Found: <span className="text-primary">{scanMut.data.found}</span></span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {scanMut.data.results.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No hosts found in range.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-mono text-xs">IP Address</TableHead>
                      <TableHead className="font-mono text-xs">Port</TableHead>
                      <TableHead className="font-mono text-xs">Status</TableHead>
                      <TableHead className="font-mono text-xs">Latency</TableHead>
                      <TableHead className="font-mono text-xs">Known Host</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanMut.data.results.map((r, i) => (
                      <TableRow key={i} className="border-border/50 hover:bg-muted/20">
                        <TableCell className="font-mono text-sm text-primary">{r.ip}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{r.port}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Wifi className="h-3.5 w-3.5 text-green-400" />
                            <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">OPEN</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.latencyMs}ms</TableCell>
                        <TableCell>
                          {r.known
                            ? <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Known</Badge>
                            : <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-400/30">New</Badge>}
                        </TableCell>
                        <TableCell>
                          {!r.known && (
                            <Link href={`/hosts?add=${r.ip}`}>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs h-6">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
