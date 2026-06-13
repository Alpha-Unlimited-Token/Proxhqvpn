// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodTypeAny, z } from "zod";

type ValidationSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export function validateRequest(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.validated = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };

    next();
  };
}

export function getValidatedBody<T extends ZodTypeAny>(
  req: Request,
  _schema?: T,
): z.infer<T> {
  return req.validated?.body as z.infer<T>;
}

export function getValidatedQuery<T extends ZodTypeAny>(
  req: Request,
  _schema?: T,
): z.infer<T> {
  return req.validated?.query as z.infer<T>;
}

export function getValidatedParams<T extends ZodTypeAny>(
  req: Request,
  _schema?: T,
): z.infer<T> {
  return req.validated?.params as z.infer<T>;
}
