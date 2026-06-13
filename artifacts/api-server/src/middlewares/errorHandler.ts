// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-errors";
import { logger } from "../lib/logger";

function getRequestId(req: Request): string {
  return String(
    req.headers["x-request-id"] ??
      (req as any).id ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      path: req.originalUrl,
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (res.headersSent) return;

  const requestId = getRequestId(req);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
        requestId,
      },
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.expose ? err.message : "Internal server error",
        details: err.expose ? err.details : undefined,
        requestId,
      },
    });
  }

  const message = err instanceof Error ? err.message : String(err);

  logger.error(
    {
      err,
      requestId,
      path: req.originalUrl,
      method: req.method,
    },
    "Unhandled route error",
  );

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : message,
      requestId,
    },
  });
}
