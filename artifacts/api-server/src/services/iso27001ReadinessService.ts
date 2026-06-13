// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { upsertComplianceControl, assessComplianceFramework } from "./complianceEngineService";

const ISO_CONTROLS = [
  ["A.5", "Information security policies"],
  ["A.6", "Organization of information security"],
  ["A.8", "Asset management"],
  ["A.9", "Access control"],
  ["A.12", "Operations security"],
  ["A.16", "Information security incident management"],
];

export async function seedIso27001Controls() {
  for (const [controlId, title] of ISO_CONTROLS) {
    await upsertComplianceControl({
      framework: "ISO27001",
      controlId,
      title,
      status: "in_progress",
    });
  }

  return assessComplianceFramework("ISO27001");
}
