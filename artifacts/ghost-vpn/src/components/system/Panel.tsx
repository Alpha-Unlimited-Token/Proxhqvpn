import type { ReactNode } from "react";

export function Panel({
  children,
  title,
  subtitle,
  actions,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-white/10 bg-white/[0.035] shadow-xl shadow-black/20",
        className,
      ].join(" ")}
    >
      {(title || subtitle || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}

      <div className="p-5">{children}</div>
    </section>
  );
}
