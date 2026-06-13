// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { upsertComplianceControl, assessComplianceFramework } from "./complianceEngineService";

const SOC2_CONTROLS = [
  ["CC1.1", "Control environment"],
  ["CC2.1", "Communication and information"],
  ["CC3.1", "Risk assessment"],
  ["CC6.1", "Logical access controls"],
  ["CC7.1", "System operations monitoring"],
  ["CC8.1", "Change management"],
];

export async function seedSoc2Controls() {
  for (const [controlId, title] of SOC2_CONTROLS) {
    await upsertComplianceControl({
      framework: "SOC2",
      controlId,
      title,
      status: "in_progress",
    });
  }

  return assessComplianceFramework("SOC2");
}
