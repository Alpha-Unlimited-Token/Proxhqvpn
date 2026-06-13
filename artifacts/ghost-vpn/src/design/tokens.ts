export const designTokens = {
  color: {
    background: "#080d09",
    panel: "#0d1610",
    panelSoft: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
    primary: "#00ff88",
    primarySoft: "rgba(0,255,136,0.12)",
    danger: "#ff4d4d",
    warning: "#ffd166",
    success: "#00ff88",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.58)",
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
  },
  shadow: {
    panel: "0 18px 50px rgba(0,0,0,0.35)",
    glow: "0 0 35px rgba(0,255,136,0.12)",
  },
  spacing: {
    pageX: "1.5rem",
    pageY: "1.5rem",
  },
} as const;

export type DesignTokens = typeof designTokens;
