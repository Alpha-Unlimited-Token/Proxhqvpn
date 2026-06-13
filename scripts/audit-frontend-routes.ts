// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { routeRegistry } from "../artifacts/ghost-vpn/src/routes/routeRegistry";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTES_DIR = path.resolve(
  __dirname,
  "../artifacts/ghost-vpn/src/routes",
);

const ROUTE_FILES = [
  "publicRoutes.tsx",
  "vpnRoutes.tsx",
  "commandCenterRoutes.tsx",
  "adminRoutes.tsx",
  "omegaRoutes.tsx",
];

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function extractRoutePaths(source: string): string[] {
  const matches = source.matchAll(/<Route\s+path=["'`]([^"'`]+)["'`]/g);
  return [...matches].map((match) => match[1]);
}

function main() {
  const actualRoutes = new Set<string>();

  for (const file of ROUTE_FILES) {
    const fullPath = path.join(ROUTES_DIR, file);

    if (!fs.existsSync(fullPath)) {
      fail(`Missing route module: ${file}`);
    }

    const source = fs.readFileSync(fullPath, "utf8");

    for (const routePath of extractRoutePaths(source)) {
      actualRoutes.add(routePath);
    }
  }

  const registryRoutes = new Set(routeRegistry.map((route) => route.path));

  const actualMissingFromRegistry = [...actualRoutes].filter(
    (routePath) =>
      !registryRoutes.has(routePath) &&
      !routePath.includes(":") &&
      routePath !== "/sign-in/*?" &&
      routePath !== "/sign-up/*?",
  );

  const registryMissingFromActual = [...registryRoutes].filter(
    (routePath) =>
      !actualRoutes.has(routePath) &&
      routePath !== "/" &&
      routePath !== "/app",
  );

  const duplicateRegistryRoutes = routeRegistry
    .map((route) => route.path)
    .filter((routePath, index, paths) => paths.indexOf(routePath) !== index);

  if (duplicateRegistryRoutes.length > 0) {
    fail(`Duplicate registry routes: ${duplicateRegistryRoutes.join(", ")}`);
  }

  if (actualMissingFromRegistry.length > 0) {
    fail(
      `Frontend routes missing from routeRegistry: ${actualMissingFromRegistry.join(", ")}`,
    );
  }

  if (registryMissingFromActual.length > 0) {
    fail(
      `routeRegistry entries missing actual <Route>: ${registryMissingFromActual.join(", ")}`,
    );
  }

  const visibleOmegaRoutes = routeRegistry.filter(
    (route) => route.group === "omega" && route.nav,
  );

  if (visibleOmegaRoutes.length > 0) {
    fail(
      `Omega routes must not appear in normal nav: ${visibleOmegaRoutes
        .map((route) => route.path)
        .join(", ")}`,
    );
  }

  console.log("✅ Frontend route/nav audit passed");
  console.log(`   Actual routes:    ${actualRoutes.size}`);
  console.log(`   Registry routes:  ${registryRoutes.size}`);
}

main();
