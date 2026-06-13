import type { ReactNode } from "react";
import { Panel } from "@/components/system";

export function CommandCenterShell({
  title,
  subtitle,
  children,
  rightRail,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightRail?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-primary/60">
          ProxhqVPN Command Center
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-white/55">{subtitle}</p>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>{children}</div>
        {rightRail && <Panel title="Live Context">{rightRail}</Panel>}
      </div>
    </div>
  );
}
