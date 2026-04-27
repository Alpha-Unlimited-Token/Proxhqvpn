import { useListQuantumThreats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, ShieldCheck, Zap } from "lucide-react";

export default function QuantumThreats() {
  const { data, isLoading } = useListQuantumThreats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-orange-500 flex items-center gap-3">
          <Cpu className="w-8 h-8" /> Quantum Threat Library
        </h1>
        <p className="text-muted-foreground mt-2">
          Catalog of post-quantum threats and their impact on classical blockchain cryptography.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data?.threats.map((threat) => (
          <Card key={threat.id} className="bg-card/50 border-orange-500/20 hover:border-orange-500/50 transition-colors">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl font-mono text-foreground">{threat.name}</CardTitle>
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                  {threat.algorithm.toUpperCase()}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {threat.affectedChains.map(chain => (
                  <Badge key={chain} variant="secondary" className="text-xs bg-accent/50">{chain}</Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-sm text-foreground/80 leading-relaxed">{threat.description}</p>
              </div>
              
              <div className="bg-background/50 p-3 rounded border border-border/50 text-xs font-mono text-muted-foreground">
                <div className="mb-1 text-primary">Technical Detail:</div>
                {threat.technicalDetail}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-mono pt-2">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Est. Qubits</span>
                  <span className="font-bold">{threat.estimatedQubitsNeeded?.toLocaleString() || "Unknown"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Timeline</span>
                  <span className="font-bold text-orange-400">{threat.estimatedFeasibleYear || "Ongoing"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-bold">{threat.currentlyFeasible ? "Feasible" : "Theoretical"}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <h4 className="text-sm font-bold flex items-center gap-2 mb-2 text-primary">
                  <ShieldCheck className="w-4 h-4" /> PQC Alternatives
                </h4>
                <div className="flex flex-wrap gap-2">
                  {threat.pqcAlternatives.map(alt => (
                    <Badge key={alt} variant="outline" className="border-primary/30 text-primary">
                      <Zap className="w-3 h-3 mr-1" /> {alt}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
