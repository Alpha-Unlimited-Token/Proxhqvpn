// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Shared API response envelope helpers — use ok() / fail() in all route handlers
// for consistent response shapes that simplify frontend hooks and support debugging.

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(code: string, message: string, details?: unknown): ApiFailure {
  return { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
}
