// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";

export function signPayload(input: {
  payload: unknown;
  secret?: string;
}) {
  const secret = input.secret ?? process.env.PLATFORM_SIGNING_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("PLATFORM_SIGNING_SECRET must be at least 32 characters");
  }

  const body = JSON.stringify(input.payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return {
    payload: input.payload,
    signature,
    algorithm: "HMAC-SHA256",
  };
}

export function verifySignedPayload(input: {
  payload: unknown;
  signature: string;
  secret?: string;
}) {
  const signed = signPayload({
    payload: input.payload,
    secret: input.secret,
  });

  return crypto.timingSafeEqual(
    Buffer.from(signed.signature),
    Buffer.from(input.signature),
  );
}
