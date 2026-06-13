// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Link } from "wouter";
import { Panel } from "@/components/system";

function CommandCenterShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-6">
        <div className="text-xs uppercase tracking-[0.35em] text-primary/70">
          Security Operations
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-white/55">{subtitle}</p>
        )}
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
        Defensive deception mode only: capture, isolate, log, alert, and block.
        No counter-attack behavior.
      </div>

      {children}
    </main>
  );
}

export default function SecurityOperationsDashboard() {
  return (
    <CommandCenterShell
      title="Security Operations"
      subtitle="Threat monitoring, deception, investigations, and response."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Open Alerts">
          <div className="text-2xl font-bold text-white">—</div>
        </Panel>
        <Panel title="Ghost Trap Events">
          <Link
            href="/ghost-trap"
            className="text-2xl font-bold text-white hover:text-primary transition"
          >
            —
          </Link>
        </Panel>
        <Panel title="Node Health">
          <div className="text-2xl font-bold text-primary">—</div>
        </Panel>
        <Panel title="Threat Intel">
          <Link
            href="/threat-intel"
            className="text-sm text-white/55 hover:text-primary transition"
          >
            View intel →
          </Link>
        </Panel>
        <Panel title="Cases">
          <div className="text-sm text-white/55">Investigations</div>
        </Panel>
        <Panel title="Validation">
          <Link
            href="/validation"
            className="text-sm text-white/55 hover:text-primary transition"
          >
            Continuous checks →
          </Link>
        </Panel>
      </div>
    </CommandCenterShell>
  );
}
