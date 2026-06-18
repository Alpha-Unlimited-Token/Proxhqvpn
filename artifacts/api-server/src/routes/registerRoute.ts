// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Router, RequestHandler } from "express";
import type { Capability } from "@workspace/capabilities";
import { requireCapability } from "../middlewares/requireCapability";
import { apiRouteCapabilities } from "./routeCapabilities";
import { logger } from "../lib/logger";

export function registerRoute(
  router: Router,
  mountPath: string,
  capability: Capability,
  ...handlers: RequestHandler[]
): void {
  const alreadyMapped = apiRouteCapabilities.some(
    (route) => route.mountPath === mountPath && route.capability === capability,
  );

  if (!alreadyMapped && process.env.NODE_ENV !== "production") {
    logger.warn(
      { mountPath, capability },
      "[route-capability] route mounted but missing from apiRouteCapabilities",
    );
  }

  router.use(mountPath, requireCapability(capability), ...handlers);
}
