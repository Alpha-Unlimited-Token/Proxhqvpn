// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Router, RequestHandler } from "express";
import type { Capability } from "@workspace/capabilities";
import { registerRoute } from "./registerRoute";

const ADMIN_CAPABILITIES: Capability[] = [
  "admin.read",
  "admin.write",
  "command_center.write",
  "terminal.exec",
  "sql.exec",
  "security_lab.admin",
];

export function registerAdminRoute(
  router: Router,
  mountPath: string,
  capability: Capability,
  ...handlers: RequestHandler[]
): void {
  if (!ADMIN_CAPABILITIES.includes(capability)) {
    throw new Error(
      `Invalid admin route capability for ${mountPath}: ${capability}`,
    );
  }

  registerRoute(router, mountPath, capability, ...handlers);
}
