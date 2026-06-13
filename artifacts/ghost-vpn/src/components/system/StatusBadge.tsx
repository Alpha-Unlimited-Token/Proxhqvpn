export function StatusBadge({
  status,
}: {
  status: "healthy" | "degraded" | "offline" | "critical" | "active" | "inactive";
}) {
  const classes =
    status === "healthy" || status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "degraded"
        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
        : "border-red-400/30 bg-red-400/10 text-red-300";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
        classes,
      ].join(" ")}
    >
      {status}
    </span>
  );
}
