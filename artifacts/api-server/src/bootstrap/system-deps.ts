// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { execSync } from "child_process";
import { logger } from "../lib/logger";

type DependencyCheck = {
  name: string;
  binaries: string[];
  installHint: string;
};

const REQUIRED_DEPENDENCIES: DependencyCheck[] = [
  {
    name: "OpenVPN",
    binaries: ["openvpn"],
    installHint: "apt-get install -y openvpn",
  },
  {
    name: "Proxychains",
    binaries: ["proxychains4", "proxychains"],
    installHint: "apt-get install -y proxychains4",
  },
  {
    name: "WireGuard",
    binaries: ["wg"],
    installHint: "apt-get install -y wireguard wireguard-tools",
  },
];

function hasBinary(binary: string): boolean {
  try {
    execSync(`command -v ${binary} >/dev/null 2>&1`, {
      timeout: 1000,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Production-safe dependency check.
 *
 * The API server must not mutate the host OS at runtime. Missing system
 * dependencies should be installed in Dockerfile/Replit setup/node bootstrap,
 * not by the request-serving process.
 */
export function verifySystemDependencies(): void {
  if (process.env.PROXHQ_SKIP_SYSTEM_DEP_CHECK === "1") {
    logger.info("System dependency check skipped");
    return;
  }

  const missing = REQUIRED_DEPENDENCIES.filter(
    (dep) => !dep.binaries.some(hasBinary),
  );

  if (missing.length === 0) {
    logger.info("System dependency check passed");
    return;
  }

  logger.warn(
    {
      missing: missing.map((dep) => ({
        name: dep.name,
        installHint: dep.installHint,
      })),
    },
    "System dependencies missing. Install during image/build/bootstrap, not API startup.",
  );
}
