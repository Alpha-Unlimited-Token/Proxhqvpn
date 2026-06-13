import type { ButtonHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const base =
    "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40";
  const variants = {
    primary: "bg-primary text-black hover:brightness-110",
    secondary:
      "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]",
    danger:
      "border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  };
  return (
    <button
      className={[base, variants[variant], className].join(" ")}
      {...props}
    />
  );
}
