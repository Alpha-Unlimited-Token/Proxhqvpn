import React, { createContext, useContext, useMemo, useState } from "react";
import type { UxMode } from "./modes";

const STORAGE_KEY = "proxhqvpn.uxMode";

function readStoredMode(): UxMode {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "business" || value === "security" || value === "consumer"
    ? value
    : "consumer";
}

const UxModeContext = createContext<{
  mode: UxMode;
  setMode: (mode: UxMode) => void;
} | null>(null);

export function UxModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UxMode>(() => readStoredMode());

  const value = useMemo(
    () => ({
      mode,
      setMode(next: UxMode) {
        localStorage.setItem(STORAGE_KEY, next);
        setModeState(next);
      },
    }),
    [mode],
  );

  return <UxModeContext.Provider value={value}>{children}</UxModeContext.Provider>;
}

export function useUxMode() {
  const ctx = useContext(UxModeContext);
  if (!ctx) throw new Error("useUxMode must be used inside UxModeProvider");
  return ctx;
}
