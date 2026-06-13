const env = import.meta.env;

export const config = {
  APP_URL:      (env.VITE_APP_URL      || "https://proxhqvpn.com").replace(/\/$/, ""),
  API_URL:      (env.VITE_API_URL      || "https://proxhqvpn.com/api").replace(/\/$/, ""),
  SECURITY_URL: (env.VITE_SECURITY_URL || "https://security.proxhqvpn.com").replace(/\/$/, ""),
  STATUS_URL:   (env.VITE_STATUS_URL   || "https://status.proxhqvpn.com").replace(/\/$/, ""),
  DOWNLOAD_URL: (env.VITE_DOWNLOAD_URL || "https://downloads.proxhqvpn.com").replace(/\/$/, ""),
  DOCS_URL:     (env.VITE_DOCS_URL     || "https://docs.proxhqvpn.com").replace(/\/$/, ""),
  SITE_URL:     (env.VITE_SITE_URL     || "https://proxhqvpn.com").replace(/\/$/, ""),
} as const;

export type PlatformConfig = typeof config;
