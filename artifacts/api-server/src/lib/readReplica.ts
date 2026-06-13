// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";

export function getReadDb() {
  // Adapter point for future replica connection.
  // Today it returns primary db so behavior stays safe.
  return db;
}

export function shouldUseReplicaForRead() {
  return process.env.PROXHQ_ENABLE_READ_REPLICA === "1";
}
