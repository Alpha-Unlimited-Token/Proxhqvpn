// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { capabilityRegistry } from "@workspace/capabilities";
import { apiRouteCapabilities } from "./routeCapabilities";

const router = Router();

router.get("/", (_req, res) => {
  const capabilities = Object.values(capabilityRegistry);

  const criticalRoutes = apiRouteCapabilities.filter((route) => {
    const meta = capabilityRegistry[route.capability];
    return meta?.risk === "critical";
  });

  const highRoutes = apiRouteCapabilities.filter((route) => {
    const meta = capabilityRegistry[route.capability];
    return meta?.risk === "high";
  });

  res.json({
    totalCapabilities: capabilities.length,
    totalMappedRoutes: apiRouteCapabilities.length,
    criticalRoutes,
    highRoutes,
    capabilities,
  });
});

export default router;
