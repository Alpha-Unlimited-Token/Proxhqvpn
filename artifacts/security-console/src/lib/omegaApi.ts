// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { securityApiFetch } from "./securityApiClient";

export type OmegaHost = {
  id: string;
  hostname?: string;
  ip?: string;
  status?: string;
  lastSeenAt?: string;
};

export type OmegaEvent = {
  id: string;
  type: string;
  hostId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export function listOmegaHosts() {
  return securityApiFetch<{ hosts: OmegaHost[] }>("/api/omega/hosts");
}

export function getOmegaHost(id: string) {
  return securityApiFetch<{ host: OmegaHost }>(
    `/api/omega/hosts/${encodeURIComponent(id)}`,
  );
}

export function listOmegaEvents() {
  return securityApiFetch<{ events: OmegaEvent[] }>("/api/omega/events");
}

export function getOmegaOverview() {
  return securityApiFetch<{
    hostCount: number;
    onlineCount: number;
    eventCount: number;
  }>("/api/omega/overview");
}
