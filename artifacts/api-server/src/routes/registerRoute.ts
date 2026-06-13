// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Router, RequestHandler } from "express";
import type { Capability } from "@workspace/capabilities";
import { requireCapability } from "../middlewares/requireCapability";
import { apiRouteCapabilities } from "./routeCapabilities";

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
    console.warn(
      `[route-capability] ${mountPath} mounted with ${capability} but missing from apiRouteCapabilities`,
    );
  }

  router.use(mountPath, requireCapability(capability), ...handlers);
}
