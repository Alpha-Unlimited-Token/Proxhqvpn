import type { ReactNode } from "react";

export function SecurityConsoleShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-red-500/20 bg-red-950/20 px-6 py-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-red-300/70">
          ProxhqVPN Security Console
        </div>
        <h1 className="mt-2 text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}
