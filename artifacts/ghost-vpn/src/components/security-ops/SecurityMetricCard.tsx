// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
export function SecurityMetricCard({
  label,
  value,
  status = "neutral",
  detail,
}: {
  label: string;
  value: string | number;
  status?: "good" | "warning" | "critical" | "neutral";
  detail?: string;
}) {
  const color =
    status === "good"
      ? "text-primary border-primary/20"
      : status === "warning"
        ? "text-yellow-300 border-yellow-300/20"
        : status === "critical"
          ? "text-red-300 border-red-300/20"
          : "text-white border-white/10";

  return (
    <div className={`rounded-2xl border bg-white/[0.035] p-5 ${color}`}>
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {detail && <div className="mt-2 text-xs text-white/45">{detail}</div>}
    </div>
  );
}
