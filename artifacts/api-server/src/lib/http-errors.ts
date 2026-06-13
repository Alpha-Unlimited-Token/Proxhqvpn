// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
export class HttpError extends Error {
  statusCode: number;
  code: string;
  expose: boolean;
  details?: unknown;

  constructor(input: {
    statusCode: number;
    code: string;
    message: string;
    expose?: boolean;
    details?: unknown;
  }) {
    super(input.message);
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.expose = input.expose ?? input.statusCode < 500;
    this.details = input.details;
  }
}

export function badRequest(message = "Bad request", details?: unknown) {
  return new HttpError({
    statusCode: 400,
    code: "BAD_REQUEST",
    message,
    details,
  });
}

export function unauthorized(message = "Unauthorized") {
  return new HttpError({
    statusCode: 401,
    code: "UNAUTHORIZED",
    message,
  });
}

export function forbidden(message = "Forbidden") {
  return new HttpError({
    statusCode: 403,
    code: "FORBIDDEN",
    message,
  });
}

export function notFound(message = "Not found") {
  return new HttpError({
    statusCode: 404,
    code: "NOT_FOUND",
    message,
  });
}

export function conflict(message = "Conflict", details?: unknown) {
  return new HttpError({
    statusCode: 409,
    code: "CONFLICT",
    message,
    details,
  });
}
