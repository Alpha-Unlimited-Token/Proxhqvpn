// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import type { Capability } from "@workspace/capabilities";
import { getCapabilityMeta } from "@workspace/capabilities";
import { requireAccess } from "./requireAccess";
import { requireCommandCenter } from "./requireCommandCenter";
import { requireAdmin } from "./requireAdmin";

function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: Response,
): Promise<boolean> {
  return new Promise((resolve) => {
    middleware(req, res, (err?: unknown) => {
      if (err) {
        resolve(false);
        return;
      }

      resolve(!res.headersSent);
    });
  });
}

export function requireCapability(capability: Capability) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const meta = getCapabilityMeta(capability);

    try {
      switch (capability) {
        case "public.read":
        case "auth.read":
          return next();

        case "vpn.read":
        case "vpn.write": {
          const ok = await runMiddleware(requireAccess, req, res);
          if (ok) return next();
          return;
        }

        case "command_center.read":
        case "command_center.write": {
          const ok = await runMiddleware(requireCommandCenter, req, res);
          if (ok) return next();
          return;
        }

        case "admin.read":
        case "admin.write":
        case "security_lab.admin":
        case "terminal.exec":
        case "sql.exec": {
          const ok = await runMiddleware(requireAdmin, req, res);
          if (ok) return next();
          return;
        }

        default:
          return res.status(403).json({
            error: "Forbidden",
            capability,
            risk: meta.risk,
          });
      }
    } catch {
      return res.status(403).json({
        error: "Forbidden",
        capability,
        risk: meta.risk,
      });
    }
  };
}
