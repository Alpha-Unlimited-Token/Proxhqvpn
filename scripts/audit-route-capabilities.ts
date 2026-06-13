// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { capabilityRegistry } from "../lib/capabilities/src/index.ts";
import {
  apiRouteCapabilities,
  getApiRouteCapability,
} from "../artifacts/api-server/src/routes/routeCapabilities.ts";

const REQUIRED_CRITICAL_ROUTES = [
  "/terminal",
  "/sql",
  "/omega",
  "/node-cracker",
  "/dev-audit",
];

const REQUIRED_ADMIN_ROUTES = [
  "/nodes",
  "/admin/users",
  "/employees",
  "/setup",
];

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function warn(message: string): void {
  console.warn(`⚠️ ${message}`);
}

function assertNoDuplicates(): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const route of apiRouteCapabilities) {
    const key = `${route.mountPath}:${route.capability}`;

    if (seen.has(key)) {
      duplicates.push(key);
    }

    seen.add(key);
  }

  if (duplicates.length > 0) {
    fail(`Duplicate route capability mappings found: ${duplicates.join(", ")}`);
  }
}

function assertCapabilitiesExist(): void {
  for (const route of apiRouteCapabilities) {
    if (!capabilityRegistry[route.capability]) {
      fail(
        `Route ${route.mountPath} references unknown capability ${route.capability}`,
      );
    }
  }
}

function assertCriticalRoutesMapped(): void {
  for (const mountPath of REQUIRED_CRITICAL_ROUTES) {
    const route = getApiRouteCapability(mountPath);

    if (!route) {
      fail(`Critical route is missing capability mapping: ${mountPath}`);
    }

    const meta = capabilityRegistry[route.capability];

    if (meta.risk !== "critical") {
      fail(
        `Critical route ${mountPath} maps to ${route.capability}, but that capability risk is ${meta.risk}`,
      );
    }
  }
}

function assertAdminRoutesMapped(): void {
  for (const mountPath of REQUIRED_ADMIN_ROUTES) {
    const route = getApiRouteCapability(mountPath);

    if (!route) {
      fail(`Admin route is missing capability mapping: ${mountPath}`);
    }

    if (!route.capability.startsWith("admin.")) {
      fail(
        `Admin route ${mountPath} maps to non-admin capability ${route.capability}`,
      );
    }
  }
}

function assertNoPublicCriticalRoutes(): void {
  for (const route of apiRouteCapabilities) {
    const meta = capabilityRegistry[route.capability];

    if (route.capability === "public.read" && meta.risk !== "low") {
      fail(`Public route ${route.mountPath} maps to non-low-risk capability`);
    }
  }
}

function assertLongestPrefixLookupWorks(): void {
  const terminalChild = getApiRouteCapability("/terminal/exec");

  if (!terminalChild || terminalChild.capability !== "terminal.exec") {
    fail("Longest-prefix lookup failed for /terminal/exec");
  }

  const adminUserChild = getApiRouteCapability("/admin/users/list");

  if (!adminUserChild || adminUserChild.capability !== "admin.write") {
    fail("Longest-prefix lookup failed for /admin/users/list");
  }
}

function main(): void {
  console.log("🔎 Auditing API route capabilities...");

  assertNoDuplicates();
  assertCapabilitiesExist();
  assertCriticalRoutesMapped();
  assertAdminRoutesMapped();
  assertNoPublicCriticalRoutes();
  assertLongestPrefixLookupWorks();

  const highOrCritical = apiRouteCapabilities.filter((route) => {
    const meta = capabilityRegistry[route.capability];
    return meta.risk === "high" || meta.risk === "critical";
  });

  if (highOrCritical.length === 0) {
    warn("No high/critical route mappings found. This is unusual for ProxhqVPN.");
  }

  console.log(`✅ Capability audit passed`);
  console.log(`   Total mappings: ${apiRouteCapabilities.length}`);
  console.log(`   High/Critical mappings: ${highOrCritical.length}`);
}

main();
