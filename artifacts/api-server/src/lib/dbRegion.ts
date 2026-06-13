// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export function getDatabaseRegion() {
  return process.env.DATABASE_REGION ?? process.env.PROXHQ_REGION ?? "unknown";
}

export function getDatabaseRole() {
  return process.env.DATABASE_ROLE === "replica" ? "replica" : "primary";
}

export function assertWritableDatabase() {
  if (getDatabaseRole() !== "primary") {
    throw new Error("Write attempted against replica database role");
  }
}
