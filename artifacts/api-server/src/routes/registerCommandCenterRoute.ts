// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Router, RequestHandler } from "express";
import type { Capability } from "@workspace/capabilities";
import { registerRoute } from "./registerRoute";

const COMMAND_CENTER_CAPABILITIES: Capability[] = [
  "command_center.read",
  "command_center.write",
];

export function registerCommandCenterRoute(
  router: Router,
  mountPath: string,
  capability: Capability,
  childRouter: RequestHandler,
): void {
  if (!COMMAND_CENTER_CAPABILITIES.includes(capability)) {
    throw new Error(
      `Invalid Command Center route capability for ${mountPath}: ${capability}`,
    );
  }

  registerRoute(router, mountPath, capability, childRouter);
}
