// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useQuery } from "@tanstack/react-query";
import {
  MatrixBackground,
  SecurityOpsShell,
  EventTerminal,
  SecurityMetricCard,
} from "@/components/security-ops";
import { useSecurityOpsEvents } from "@/hooks/useSecurityOpsEvents";
import { ShieldCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type Snapshot = {
  counts?: {
    open_alerts?: number;
    security_events_24h?: number;
    open_cases?: number;
    ioc_matches_24h?: number;
  };
};

export default function SecurityOperationsCenter() {
  const stream = useSecurityOpsEvents(true);

  const { data: snapshot } = useQuery<Snapshot>({
    queryKey: ["security-dashboard-v2-snapshot"],
    queryFn: () => apiFetch("/api/command-center/security-dashboard-v2/snapshot"),
    refetchInterval: 15_000,
    retry: false,
  });

  const counts = snapshot?.counts ?? {};

  return (
    <>
      <MatrixBackground />
      <SecurityOpsShell
        title="Security Operations Center"
        subtitle="Live security telemetry, validation events, node status, and command-center monitoring."
        rightRail={
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
              Operational Mode
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-sm text-primary/90 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Defensive monitoring only. No retaliatory scanning. No counter-attack actions against public targets.
              </span>
            </div>
            <div className="space-y-2 text-xs text-white/50 leading-relaxed">
              <p>Ghost Trap: capture, isolate, log, alert, block — no retaliation.</p>
              <p>Ghost Nodes: deception-only assets, isolated from production VPN traffic.</p>
              <p>All actions are logged to the SHA3-256 audit chain.</p>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SecurityMetricCard
              label="Open alerts"
              value={counts.open_alerts ?? 0}
              status={(counts.open_alerts ?? 0) > 0 ? "warning" : "good"}
            />
            <SecurityMetricCard
              label="Events / 24h"
              value={counts.security_events_24h ?? 0}
              status="neutral"
            />
            <SecurityMetricCard
              label="Open cases"
              value={counts.open_cases ?? 0}
              status={(counts.open_cases ?? 0) > 0 ? "warning" : "neutral"}
            />
            <SecurityMetricCard
              label="IOC matches / 24h"
              value={counts.ioc_matches_24h ?? 0}
              status={(counts.ioc_matches_24h ?? 0) > 0 ? "warning" : "good"}
            />
          </div>

          <EventTerminal
            events={stream.events}
            loading={stream.loading}
            error={stream.error}
          />
        </div>
      </SecurityOpsShell>
    </>
  );
}
