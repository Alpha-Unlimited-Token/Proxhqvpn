// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { ReactNode } from "react";

export function SecurityOpsShell({
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
    <div className="relative min-h-screen overflow-hidden bg-[#050805] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background:radial-gradient(circle_at_20%_20%,#00ff88,transparent_30%),radial-gradient(circle_at_80%_10%,#00bcff,transparent_25%)]" />
      <div className="relative z-10 space-y-6 p-4 md:p-6">
        <header className="rounded-2xl border border-primary/20 bg-black/50 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary/70">
            ProxhqVPN Security Operations
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-sm text-white/55">{subtitle}</p>}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <main>{children}</main>
          {rightRail && (
            <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              {rightRail}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
