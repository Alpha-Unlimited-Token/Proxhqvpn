import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type AppTheme,
} from "./themeStore";

const ThemeContext = createContext<{
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme(next: AppTheme) {
        setStoredTheme(next);
        setThemeState(next);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
