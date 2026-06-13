// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import fs from "fs";
import path from "path";
import { findActiveBatchJobBySourceName } from "../repositories/batchJobsRepository";
import { createBatchJob } from "../lib/scheme-auditor/batch-worker";
import { logger } from "../lib/logger";

/**
 * Legacy preload for bundled intelligence datasets.
 *
 * Disabled by default because production startup should not implicitly queue
 * security jobs from local files. Enable only for controlled environments with:
 * PROXHQ_PRELOAD_ATTACKER_FILES=1
 */
export async function preloadAttackerFilesIfEnabled(): Promise<void> {
  if (process.env.PROXHQ_PRELOAD_ATTACKER_FILES !== "1") {
    logger.info("Attacker-file preload disabled");
    return;
  }

  try {
    const sourceNames = [
      "sillytuna_attacker_wallets",
      "sillytuna_attacker_tx_hashes",
    ];

    for (const sourceName of sourceNames) {
      const active = await findActiveBatchJobBySourceName(sourceName);

      if (active) continue;

      const attachedAssetsDir = path.join(
        process.cwd(),
        "..",
        "..",
        "attached_assets",
      );

      const exactCandidates = [
        path.join(attachedAssetsDir, `${sourceName}_1777326855520.txt`),
        path.join(attachedAssetsDir, `${sourceName}_1777326855652.txt`),
      ];

      const candidates = exactCandidates.filter((candidate) =>
        fs.existsSync(candidate),
      );

      if (candidates.length === 0 && fs.existsSync(attachedAssetsDir)) {
        const files = fs
          .readdirSync(attachedAssetsDir)
          .filter((file) => file.startsWith(sourceName));

        if (files.length > 0) {
          candidates.push(path.join(attachedAssetsDir, files[0]));
        }
      }

      if (candidates.length === 0) {
        logger.warn({ sourceName }, "Attacker file not found — skipping preload");
        continue;
      }

      const raw = fs.readFileSync(candidates[0], "utf8");
      const targets = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length >= 10);

      const name = sourceName.includes("wallet")
        ? "Sillytuna Attacker Wallets"
        : "Sillytuna Attacker TX Hashes";

      const jobId = await createBatchJob({
        name,
        sourceName,
        targets,
      });

      logger.info(
        { jobId, sourceName, total: targets.length },
        "Attacker file queued as batch job",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Attacker-file preload failed");
  }
}
