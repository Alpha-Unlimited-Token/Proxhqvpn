// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
export function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v instanceof Date ? v.toISOString() : v;
  }
  return result as T;
}

export function serializeDateArray<T extends Record<string, unknown>>(arr: T[]): T[] {
  return arr.map(serializeDates);
}
