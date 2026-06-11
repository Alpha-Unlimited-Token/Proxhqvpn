// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotAttackers } from "@/hooks/useApi";
import { Users, Globe, Shield, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function ThreatBadge({ score }: { score: number }) {
  const level = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low";
  const colors: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-400/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-400/20",
    low: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono border", colors[level])}>
      {level.toUpperCase()} {score}
    </span>
  );
}

export default function Attackers() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data, isLoading } = useListHoneypotAttackers({ limit, offset: page * limit });

  const attackers = data?.attackers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-destructive" />
        <h1 className="text-lg font-bold font-mono">Attacker Profiles</h1>
        {total > 0 && (
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading attacker profiles...</div>
      ) : attackers.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-2">
          <Users className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-mono">No attackers captured yet.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-normal">IP ADDRESS</th>
                    <th className="px-4 py-2.5 text-left font-normal">COUNTRY</th>
                    <th className="px-4 py-2.5 text-left font-normal">ASN / ORG</th>
                    <th className="px-4 py-2.5 text-left font-normal">THREAT</th>
                    <th className="px-4 py-2.5 text-left font-normal">FLAGS</th>
                    <th className="px-4 py-2.5 text-left font-normal">SESSIONS</th>
                    <th className="px-4 py-2.5 text-left font-normal">CMDS</th>
                    <th className="px-4 py-2.5 text-left font-normal">LAST SEEN</th>
                  </tr>
                </thead>
                <tbody>
                  {attackers.map((a: any) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-primary font-bold">{a.ipAddress}</td>
                      <td className="px-4 py-2.5 text-foreground">
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                          {a.country ?? "—"} {a.countryCode && <span className="text-muted-foreground">({a.countryCode})</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[140px]">
                        {a.asnOrg ?? a.asn ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <ThreatBadge score={a.threatScore} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          {a.isTorExit && (
                            <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[9px] border border-purple-400/20">TOR</span>
                          )}
                          {a.isKnownBad && (
                            <span className="px-1 py-0.5 rounded bg-destructive/10 text-destructive text-[9px] border border-destructive/20">MALICIOUS</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-accent">{a.sessionCount}</td>
                      <td className="px-4 py-2.5 text-foreground">{a.commandCount}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(a.lastSeenAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Page {page + 1} of {totalPages} ({total} attackers)</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 border border-border rounded hover:bg-muted disabled:opacity-40">
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 border border-border rounded hover:bg-muted disabled:opacity-40">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
