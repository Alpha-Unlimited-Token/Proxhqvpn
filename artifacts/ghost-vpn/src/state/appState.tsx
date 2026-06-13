import React, { createContext, useContext, useMemo, useState } from "react";

type AppState = {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
};

type AppStateContextValue = AppState & {
  setSidebarOpen: (value: boolean) => void;
  setCommandPaletteOpen: (value: boolean) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const value = useMemo(
    () => ({
      sidebarOpen,
      commandPaletteOpen,
      setSidebarOpen,
      setCommandPaletteOpen,
    }),
    [sidebarOpen, commandPaletteOpen],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
