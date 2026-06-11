// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotAlerts, useAcknowledgeHoneypotAlert } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { getListHoneypotAlertsQueryKey } from "@workspace/api-client-react";
import { Bell, CheckCheck, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-400/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-400/30",
  low: "bg-primary/10 text-primary border-primary/30",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-primary",
};

export default function Alerts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAck, setShowAck] = useState(false);
  const { data: alerts, isLoading } = useListHoneypotAlerts(showAck ? { acknowledged: true } : { acknowledged: false });
  const ackFn = useAcknowledgeHoneypotAlert();

  const ack = async (id: number) => {
    try {
      await ackFn.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: getListHoneypotAlertsQueryKey() });
      toast({ title: "Alert acknowledged" });
    } catch {
      toast({ title: "Failed to acknowledge alert", variant: "destructive" });
    }
  };

  const unackCount = !showAck && alerts ? (alerts as any[]).length : 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" />
          <h1 className="text-lg font-bold font-mono">Honeypot Alerts</h1>
          {!showAck && unackCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-xs font-mono">
              {unackCount} unacknowledged
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAck(!showAck)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded hover:bg-muted",
            showAck ? "border-primary/30 text-primary bg-primary/5" : "border-border text-muted-foreground"
          )}
        >
          <Filter className="w-3 h-3" />
          {showAck ? "Showing: Acknowledged" : "Showing: Active"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading alerts...</div>
      ) : !alerts?.length ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-2">
          <Bell className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-mono">
            {showAck ? "No acknowledged alerts." : "No active alerts — system is clear."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(alerts as any[]).map((alert: any) => (
            <div
              key={alert.id}
              className={cn(
                "border rounded-lg p-4 bg-card transition-opacity",
                alert.acknowledged && "opacity-60",
                SEVERITY_COLORS[alert.severity] ?? "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", SEVERITY_DOT[alert.severity] ?? "bg-muted")} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-foreground">{alert.title}</span>
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-mono", SEVERITY_COLORS[alert.severity])}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">
                        {alert.alertType}
                      </span>
                    </div>
                    {alert.description && (
                      <p className="text-xs text-muted-foreground font-mono mt-1">{alert.description}</p>
                    )}
                    <div className="flex gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      {alert.acknowledged && alert.acknowledgedBy && (
                        <span>Acked by: {alert.acknowledgedBy}</span>
                      )}
                    </div>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => ack(alert.id)}
                    disabled={ackFn.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono border border-border rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0 disabled:opacity-50"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Ack
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
