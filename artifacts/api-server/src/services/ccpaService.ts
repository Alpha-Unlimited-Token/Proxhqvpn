// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { createGdprRequest } from "./gdprService";

export async function createCcpaRequest(input: {
  userId?: string | null;
  email?: string | null;
  requestType: "know" | "delete" | "opt_out" | "correct";
  metadata?: Record<string, unknown>;
}) {
  return createGdprRequest({
    userId: input.userId,
    email: input.email,
    requestType:
      input.requestType === "know"
        ? "access"
        : input.requestType === "opt_out" || input.requestType === "correct"
          ? "rectify"
          : input.requestType,
    metadata: {
      regulation: "CCPA",
      originalRequestType: input.requestType,
      ...input.metadata,
    },
  });
}
