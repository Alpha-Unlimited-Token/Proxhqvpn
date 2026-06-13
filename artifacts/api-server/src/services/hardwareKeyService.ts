// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";

export type HardwareKeyProvider = "software" | "hsm" | "kms";

export async function signWithManagedKey(input: {
  provider?: HardwareKeyProvider;
  keyRef?: string;
  payload: string | Buffer;
}) {
  const provider = input.provider ?? "software";

  if (provider !== "software") {
    throw new Error(`Managed key provider not implemented yet: ${provider}`);
  }

  const secret = process.env.PLATFORM_SIGNING_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("PLATFORM_SIGNING_SECRET must be configured");
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(input.payload)
    .digest("hex");

  return {
    provider,
    keyRef: input.keyRef ?? "env:PLATFORM_SIGNING_SECRET",
    algorithm: "HMAC-SHA256",
    signature,
  };
}

export async function verifyWithManagedKey(input: {
  provider?: HardwareKeyProvider;
  keyRef?: string;
  payload: string | Buffer;
  signature: string;
}) {
  const signed = await signWithManagedKey(input);

  return crypto.timingSafeEqual(
    Buffer.from(signed.signature),
    Buffer.from(input.signature),
  );
}
