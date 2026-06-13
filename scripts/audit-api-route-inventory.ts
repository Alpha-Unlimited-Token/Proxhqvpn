// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Relative import to avoid workspace package resolution issues with tsx
import { capabilityRegistry } from "../lib/capabilities/src/index";
import {
  apiRouteCapabilities,
  getApiRouteCapability,
} from "../artifacts/api-server/src/routes/routeCapabilities";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTE_GROUP_DIR = path.resolve(
  __dirname,
  "../artifacts/api-server/src/routes/groups",
);

const ROUTE_GROUP_FILES = [
  "public.ts",
  "vpn.ts",
  "command-center.ts",
  "admin.ts",
  "security-lab.ts",
  "omega.ts",
  "misc-authenticated.ts",
];

const PUBLIC_ALLOWED_PREFIXES = [
  "/health",
  "/healthz",
  "/my-ip",
  "/updates",
  "/update/check",
  "/anon",
  "/ambassadors",
  "/stripe",
  "/payments/crypto",
  "/notifications",
  "/daemon-inbound",
  "/omega-agent",
  "/node-provision",
  "/node-agent",
  "/wallet",
  "/wallet-intel",
  "/warrant-canary",
  "/t/",
  "/honeypot/ingest",
  // Ghost trap lure endpoints (/lure, /u/, /beacon/) must be publicly
  // reachable so honeypot links work without authentication
  "/ghost-trap",
];

const MUST_BE_CRITICAL = [
  "/terminal",
  "/sql",
  "/omega",
  "/node-cracker",
  "/dev-audit",
];

const MUST_BE_FEATURE_GATED = [
  "/omega",
  "/node-cracker",
  "/dev-audit",
];

type MountedRoute = {
  file: string;
  mountPath: string;
  raw: string;
};

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function readGroupFile(file: string): string {
  const fullPath = path.join(ROUTE_GROUP_DIR, file);

  if (!fs.existsSync(fullPath)) {
    fail(`Missing route group file: ${file}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function extractMountedRoutes(source: string, file: string): MountedRoute[] {
  const mounted: MountedRoute[] = [];

  const routerUseMatches = source.matchAll(
    /router\.use\(\s*["'`]([^"'`]+)["'`][\s\S]*?\);/g,
  );

  for (const match of routerUseMatches) {
    mounted.push({ file, mountPath: match[1], raw: match[0] });
  }

  const routerMethodMatches = source.matchAll(
    /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`][\s\S]*?\);/g,
  );

  for (const match of routerMethodMatches) {
    mounted.push({ file, mountPath: match[2], raw: match[0] });
  }

  const registerMatches = source.matchAll(
    /register[A-Za-z]*Route\(\s*router,\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g,
  );

  for (const match of registerMatches) {
    mounted.push({ file, mountPath: match[1], raw: match[0] });
  }

  return mounted;
}

function assertNoDuplicateCapabilityMappings(): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const mapping of apiRouteCapabilities) {
    if (seen.has(mapping.mountPath)) duplicates.push(mapping.mountPath);
    seen.add(mapping.mountPath);
  }

  if (duplicates.length > 0) {
    fail(`Duplicate capability mount paths: ${duplicates.join(", ")}`);
  }
}

function assertMappedCapabilitiesExist(): void {
  for (const mapping of apiRouteCapabilities) {
    if (!capabilityRegistry[mapping.capability]) {
      fail(
        `Unknown capability ${mapping.capability} for ${mapping.mountPath}`,
      );
    }
  }
}

function isPublicAllowed(mountPath: string): boolean {
  return PUBLIC_ALLOWED_PREFIXES.some(
    (prefix) => mountPath === prefix || mountPath.startsWith(prefix),
  );
}

function assertPublicGroupSafety(publicSource: string): void {
  const mounted = extractMountedRoutes(publicSource, "public.ts");

  const suspicious = mounted.filter((route) => {
    if (route.mountPath === "/") return false;
    return !isPublicAllowed(route.mountPath);
  });

  if (suspicious.length > 0) {
    fail(
      `Suspicious public route mounts: ${suspicious
        .map((route) => `${route.mountPath} (${route.file})`)
        .join(", ")}`,
    );
  }
}

function assertCriticalRoutesMapped(): void {
  for (const mountPath of MUST_BE_CRITICAL) {
    const mapping = getApiRouteCapability(mountPath);

    if (!mapping) {
      fail(`Critical route missing capability mapping: ${mountPath}`);
    }

    const meta = capabilityRegistry[mapping.capability];

    if (meta.risk !== "critical") {
      fail(
        `Critical route ${mountPath} maps to ${mapping.capability}, risk ${meta.risk}`,
      );
    }
  }
}

function assertFeatureGates(): void {
  for (const file of ["security-lab.ts", "omega.ts"]) {
    const source = readGroupFile(file);

    if (!source.includes("featureGate")) {
      fail(`${file} is missing featureGate(...)`);
    }
  }

  for (const mountPath of MUST_BE_FEATURE_GATED) {
    const mapping = getApiRouteCapability(mountPath);

    if (!mapping) {
      fail(`Feature-gated route missing mapping: ${mountPath}`);
    }
  }
}

function assertMountedRoutesHaveMappings(mountedRoutes: MountedRoute[]): void {
  const ignored = new Set([
    "/",
    "/update/check",
    "/daemon-download",
    "/setup-script",
    "/node-enrollment-token",
    "/oast/cb",
    "/config-lifecycle-events",
    // PSK-authenticated routes — bypass Clerk capability system entirely;
    // auth is enforced by x-psk / x-daemon-psk headers, not by requireAuth
    "/daemon-inbound",
    "/omega-agent",
    "/node-provision",
    "/node-agent",
  ]);

  const missing = mountedRoutes.filter((route) => {
    if (ignored.has(route.mountPath)) return false;
    if (route.mountPath.includes(":")) return false;

    const capability = getApiRouteCapability(route.mountPath);
    return !capability;
  });

  if (missing.length > 0) {
    fail(
      `Mounted routes missing capability mappings: ${missing
        .map((route) => `${route.mountPath} (${route.file})`)
        .join(", ")}`,
    );
  }
}

function main() {
  console.log("🔎 Auditing backend API route inventory...");

  const allMounted: MountedRoute[] = [];

  for (const file of ROUTE_GROUP_FILES) {
    const source = readGroupFile(file);
    allMounted.push(...extractMountedRoutes(source, file));

    if (file === "public.ts") {
      assertPublicGroupSafety(source);
    }
  }

  assertNoDuplicateCapabilityMappings();
  assertMappedCapabilitiesExist();
  assertCriticalRoutesMapped();
  assertFeatureGates();
  assertMountedRoutesHaveMappings(allMounted);

  console.log("✅ Backend API route inventory audit passed");
  console.log(`   Route group files: ${ROUTE_GROUP_FILES.length}`);
  console.log(`   Mounted route declarations scanned: ${allMounted.length}`);
  console.log(`   Capability mappings: ${apiRouteCapabilities.length}`);
}

main();
