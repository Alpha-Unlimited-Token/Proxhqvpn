export const messages = {
  en: {
    appName: "ProxhqVPN",
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    retry: "Retry",
    dashboard: "Dashboard",
    commandCenter: "Command Center",
    devices: "Devices",
    nodes: "Nodes",
  },
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof messages.en;
