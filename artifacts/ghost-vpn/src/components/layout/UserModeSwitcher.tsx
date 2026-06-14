// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useUserMode } from "@/state/userModeState";
import { useAccess } from "@/hooks/useAccess";
import type { UserMode } from "@/routes/routeRegistry";

const MODES: Array<{ value: UserMode; label: string; requiresAdmin?: boolean; requiresCommandCenter?: boolean }> = [
  { value: "consumer",  label: "Personal" },
  { value: "business",  label: "Business" },
  { value: "security",  label: "Security Ops", requiresCommandCenter: true },
  { value: "admin",     label: "Admin",         requiresAdmin: true },
];

export function UserModeSwitcher() {
  const { mode, setMode } = useUserMode();
  const { isAdmin, hasCommandCenter } = useAccess();

  const available = MODES.filter((m) => {
    if (m.requiresAdmin && !isAdmin) return false;
    if (m.requiresCommandCenter && !hasCommandCenter && !isAdmin) return false;
    return true;
  });

  if (available.length < 2) return null;

  return (
    <div className="grid gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs"
         style={{ gridTemplateColumns: `repeat(${available.length}, 1fr)` }}>
      {available.map((item) => (
        <button
          key={item.value}
          onClick={() => setMode(item.value)}
          className={
            item.value === mode
              ? "rounded-lg bg-primary px-2 py-1 font-semibold text-black"
              : "rounded-lg px-2 py-1 text-white/55 hover:text-white transition-colors"
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
