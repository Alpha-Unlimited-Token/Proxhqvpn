// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { assertWritableDatabase } from "../lib/dbRegion";

export function requireWritableDatabase(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    assertWritableDatabase();
    next();
  } catch {
    res.status(503).json({
      error: "This API instance is connected to a read replica",
    });
  }
}
