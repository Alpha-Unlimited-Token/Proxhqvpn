export type AppTheme = "dark" | "light" | "system";

const STORAGE_KEY = "proxhqvpn.theme";

export function getStoredTheme(): AppTheme {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "dark" || value === "light" || value === "system"
    ? value
    : "dark";
}

export function applyTheme(theme: AppTheme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function setStoredTheme(theme: AppTheme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
