import type { ReactNode } from "react";

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-400/20 bg-red-950/10 p-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-red-300/70">
          Admin Console
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-white/55">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}
