import { useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Network, Skull, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function SilkWeb() {
  const { data: web } = useGetSilkWeb();
  const { data: attackers } = useListTrappedAttackers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const collapse = useCollapseSilkWeb();

  const handleCollapse = () => {
    collapse.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Silk Web Collapsed", description: "Web geometry has been regenerated." });
        queryClient.invalidateQueries({ queryKey: getGetSilkWebQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Network className="w-6 h-6" />
          Silk Web Traps
        </h2>
        <Button 
          variant="outline" 
          className="border-destructive text-destructive hover:bg-destructive hover:text-black"
          onClick={handleCollapse}
          disabled={collapse.isPending}
        >
          <Skull className="w-4 h-4 mr-2" />
          COLLAPSE WEB
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Total Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{web?.totalRoutes ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Dead Ends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{web?.deadEndRoutes ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Highways</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{web?.activeHighways ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Generation ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-primary font-mono truncate">{web?.generationId ?? "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
        <div className="border border-primary/20 rounded bg-black flex flex-col items-center justify-center relative overflow-hidden h-full min-h-[300px]">
           <Network className="w-32 h-32 text-primary/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
           <div className="z-10 text-center font-mono text-primary/50 uppercase">
               [TOPOLOGY_VISUALIZATION_RENDERER_OFFLINE]
           </div>
        </div>

        <div className="border border-primary/20 rounded bg-black flex flex-col h-full min-h-[300px]">
          <div className="p-3 border-b border-primary/20 flex items-center gap-2 text-destructive font-bold text-sm tracking-widest uppercase">
            <ShieldAlert className="w-4 h-4" />
            Trapped Entities
          </div>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-primary/20 hover:bg-transparent">
                  <TableHead className="text-primary/70 text-xs">TIME</TableHead>
                  <TableHead className="text-primary/70 text-xs">IP</TableHead>
                  <TableHead className="text-primary/70 text-xs">LOOPS</TableHead>
                  <TableHead className="text-primary/70 text-xs">FINGERPRINT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attackers?.attackers?.map((att) => (
                  <TableRow key={att.id} className="border-primary/20 hover:bg-primary/5">
                    <TableCell className="font-mono text-xs">{format(new Date(att.trappedAt), 'HH:mm:ss')}</TableCell>
                    <TableCell className="font-mono text-xs text-destructive">{att.ip}</TableCell>
                    <TableCell className="font-mono text-xs">{att.loopCount}</TableCell>
                    <TableCell className="font-mono text-[10px] truncate max-w-[120px]">{att.fingerprint}</TableCell>
                  </TableRow>
                ))}
                {!attackers?.attackers?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-primary/50 py-8 font-mono text-xs">
                      NO ENTITIES CURRENTLY TRAPPED
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
