// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import * as zod from "zod";

export const HealthCheckResponse = zod.object({
  status: zod.string(),
});

export const ListHostsResponseItem = zod.object({
  id: zod.number(),
  ip: zod.string(),
  port: zod.number(),
  label: zod.string(),
  comments: zod.string().nullable(),
  status: zod.enum(["online", "offline", "unknown"]),
  os: zod.string().nullable(),
  lastSeen: zod.string().nullable(),
  latencyMs: zod.number().nullable(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});
export const ListHostsResponse = zod.array(ListHostsResponseItem);

export const CreateHostBody = zod.object({
  ip: zod.string(),
  port: zod.number(),
  label: zod.string(),
  comments: zod.string().nullish(),
  os: zod.string().nullish(),
});

export const GetHostParams = zod.object({
  id: zod.coerce.number(),
});

export const GetHostResponse = zod.object({
  id: zod.number(),
  ip: zod.string(),
  port: zod.number(),
  label: zod.string(),
  comments: zod.string().nullable(),
  status: zod.enum(["online", "offline", "unknown"]),
  os: zod.string().nullable(),
  lastSeen: zod.string().nullable(),
  latencyMs: zod.number().nullable(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});

export const UpdateHostParams = zod.object({
  id: zod.coerce.number(),
});

export const UpdateHostBody = zod.object({
  ip: zod.string().optional(),
  port: zod.number().optional(),
  label: zod.string().optional(),
  comments: zod.string().nullish(),
  status: zod.enum(["online", "offline", "unknown"]).optional(),
  os: zod.string().nullish(),
  latencyMs: zod.number().nullish(),
});

export const UpdateHostResponse = zod.object({
  id: zod.number(),
  ip: zod.string(),
  port: zod.number(),
  label: zod.string(),
  comments: zod.string().nullable(),
  status: zod.enum(["online", "offline", "unknown"]),
  os: zod.string().nullable(),
  lastSeen: zod.string().nullable(),
  latencyMs: zod.number().nullable(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});

export const DeleteHostParams = zod.object({
  id: zod.coerce.number(),
});

export const PingHostParams = zod.object({
  id: zod.coerce.number(),
});

export const PingHostResponse = zod.object({
  hostId: zod.number(),
  ip: zod.string(),
  status: zod.enum(["online", "offline", "unknown"]),
  latencyMs: zod.number().nullable(),
  timestamp: zod.string(),
});

export const ListEventsQueryParams = zod.object({
  hostId: zod.coerce.number().nullish(),
  category: zod.coerce.string().nullish(),
  limit: zod.coerce.number().nullish(),
});

export const ListEventsResponseItem = zod.object({
  id: zod.number(),
  hostId: zod.number().nullable(),
  hostIp: zod.string().nullable(),
  hostLabel: zod.string().nullable(),
  category: zod.string(),
  action: zod.string(),
  details: zod.string().nullable(),
  severity: zod.enum(["info", "warn", "error"]),
  createdAt: zod.string(),
});
export const ListEventsResponse = zod.array(ListEventsResponseItem);

export const CreateEventBody = zod.object({
  hostId: zod.number().nullish(),
  category: zod.string(),
  action: zod.string(),
  details: zod.string().nullish(),
  severity: zod.enum(["info", "warn", "error"]),
});

export const GetDashboardSummaryResponse = zod.object({
  totalHosts: zod.number(),
  onlineHosts: zod.number(),
  offlineHosts: zod.number(),
  unknownHosts: zod.number(),
  totalEvents: zod.number(),
  recentEventsCount: zod.number(),
  avgLatencyMs: zod.number().nullable(),
});

export const GetRecentActivityResponseItem = zod.object({
  id: zod.number(),
  hostId: zod.number().nullable(),
  hostIp: zod.string().nullable(),
  hostLabel: zod.string().nullable(),
  category: zod.string(),
  action: zod.string(),
  details: zod.string().nullable(),
  severity: zod.enum(["info", "warn", "error"]),
  createdAt: zod.string(),
});
export const GetRecentActivityResponse = zod.array(GetRecentActivityResponseItem);

export const GetHostStatusBreakdownResponseItem = zod.object({
  status: zod.string(),
  count: zod.number(),
});
export const GetHostStatusBreakdownResponse = zod.array(GetHostStatusBreakdownResponseItem);

export const GetEventCategoryBreakdownResponseItem = zod.object({
  category: zod.string(),
  count: zod.number(),
});
export const GetEventCategoryBreakdownResponse = zod.array(GetEventCategoryBreakdownResponseItem);
