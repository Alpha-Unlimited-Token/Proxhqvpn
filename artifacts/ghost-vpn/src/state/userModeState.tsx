// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { createContext, useContext, useMemo, useState } from "react";
import type { UserMode } from "@/routes/routeRegistry";

const KEY = "proxhqvpn.userMode";

function readMode(): UserMode {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "business" || value === "security" || value === "admin") return value;
  } catch {
    // localStorage unavailable (SSR/private mode)
  }
  return "consumer";
}

const UserModeContext = createContext<{
  mode: UserMode;
  setMode: (mode: UserMode) => void;
} | null>(null);

export function UserModeProvider({ children }: { children: React.ReactNode }) {
  const [modeState, setModeState] = useState<UserMode>(() => readMode());

  const value = useMemo(
    () => ({
      mode: modeState,
      setMode(mode: UserMode) {
        try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
        setModeState(mode);
      },
    }),
    [modeState],
  );

  return <UserModeContext.Provider value={value}>{children}</UserModeContext.Provider>;
}

export function useUserMode() {
  const ctx = useContext(UserModeContext);
  if (!ctx) throw new Error("useUserMode must be used inside UserModeProvider");
  return ctx;
}
