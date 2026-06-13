// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Router, RequestHandler } from "express";
import type { Capability } from "@workspace/capabilities";
import { registerRoute } from "./registerRoute";

const VPN_CAPABILITIES: Capability[] = ["vpn.read", "vpn.write"];

export function registerVpnRoute(
  router: Router,
  mountPath: string,
  capability: Capability,
  childRouter: RequestHandler,
): void {
  if (!VPN_CAPABILITIES.includes(capability)) {
    throw new Error(
      `Invalid VPN route capability for ${mountPath}: ${capability}`,
    );
  }

  registerRoute(router, mountPath, capability, childRouter);
}
