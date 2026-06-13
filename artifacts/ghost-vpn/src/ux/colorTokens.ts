export const uxColorTokens = {
  background: "#080d09",
  panel: "#0d1610",
  panelSoft: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.10)",
  primary: "#00ff88",
  primarySoft: "rgba(0,255,136,0.12)",
  danger: "#ff4d4d",
  warning: "#ffd166",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.58)",
} as const;

export type UxColorToken = keyof typeof uxColorTokens;
