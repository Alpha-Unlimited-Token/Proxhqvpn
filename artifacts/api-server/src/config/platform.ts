const e = process.env;

export const platformConfig = {
  APP_URL:      (e.APP_URL      || "https://proxhqvpn.com").replace(/\/$/, ""),
  API_URL:      (e.API_URL      || "https://proxhqvpn.com/api").replace(/\/$/, ""),
  SECURITY_URL: (e.SECURITY_URL || "https://security.proxhqvpn.com").replace(/\/$/, ""),
  STATUS_URL:   (e.STATUS_URL   || "https://status.proxhqvpn.com").replace(/\/$/, ""),
  DOWNLOAD_URL: (e.DOWNLOAD_URL || "https://downloads.proxhqvpn.com").replace(/\/$/, ""),
  DOCS_URL:     (e.DOCS_URL     || "https://docs.proxhqvpn.com").replace(/\/$/, ""),
} as const;

export type PlatformConfig = typeof platformConfig;
