// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 347 — Smoke route manifest. Used by audit:frontend-routes to verify
// that all critical paths have registry entries.
export const smokeRoutes = [
  "/",
  "/dashboard",
  "/vpn",
  "/my-vpn",
  "/devices",
  "/wireguard",
  "/kill-switch",
  "/leaks",
  "/dns-shield",
  "/downloads",
  "/pricing",
  "/guide",
  "/account",
  "/settings",
  "/threat-intel",
  "/siem",
  "/security-audit",
  "/nodes",
  "/terminal",
  "/sql",
] as const;

export type SmokeRoute = (typeof smokeRoutes)[number];
