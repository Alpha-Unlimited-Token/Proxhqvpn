// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { appendAuditEvent } from "../lib/audit-chain";

type FeatureGateOptions = {
  featureName: string;
  enabled: () => boolean;
};

export function featureGate({ featureName, enabled }: FeatureGateOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (enabled()) return next();

    void appendAuditEvent({
      actor: (req as any).auth?.userId ?? req.ip ?? "unknown",
      action: "feature_gate.denied",
      resource: featureName,
      result: "deny",
      ip: req.ip,
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(404).json({
      error: "Not found",
    });
  };
}
