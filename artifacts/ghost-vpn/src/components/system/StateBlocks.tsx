import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-sm text-white/55">
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-center">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">
      {message}
    </div>
  );
}
