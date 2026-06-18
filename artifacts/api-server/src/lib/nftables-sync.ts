// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// nftables-sync — reads all persistent user firewall rules from Postgres and
// writes /etc/proxhq/nftables-user-rules.nft, then hot-reloads just that table.
//
// Called:
//   • POST /api/firewall/user-rules/sync  (admin trigger / on-demand)
//   • At API server startup (so rules are always applied after a reboot)
//   • After any rule create / update / delete / toggle

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { db } from "@workspace/db";
import { userFirewallRulesTable } from "@workspace/db";
import { devicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

const NFT_USER_RULES_PATH = process.env.NFT_USER_RULES_PATH
  ?? "/etc/proxhq/nftables-user-rules.nft";

// ── Build a single nft rule line ──────────────────────────────────────────────
function buildNftLine(rule: {
  protocol:     string;
  direction:    string;
  action:       string;
  externalPort: number;
  internalPort: number | null | undefined;
  sourceIp:     string | null | undefined;
  tunnelIp:     string | null | undefined;
  label:        string;
  id:           number;
}): string[] {
  const lines: string[] = [];
  const proto = rule.protocol === "both" ? ["tcp", "udp"] : [rule.protocol];
  const target = rule.action === "allow" ? "accept" : "drop";
  const internalPort = rule.internalPort ?? rule.externalPort;
  const srcMatch = rule.sourceIp ? `ip saddr ${rule.sourceIp} ` : "";
  const comment  = `comment "proxhq-rule-${rule.id}: ${rule.label.replace(/"/g, "")}"`;

  for (const p of proto) {
    if (rule.direction === "inbound" || rule.direction === "both") {
      if (rule.tunnelIp) {
        // Forward chain: traffic arriving inbound destined for this tunnel IP
        lines.push(
          `    ${srcMatch}ip daddr ${rule.tunnelIp} ${p} dport ${internalPort} ` +
          `counter ${target} ${comment}`
        );
      } else {
        // Input chain: traffic destined for the server itself
        lines.push(
          `    ${srcMatch}${p} dport ${rule.externalPort} counter ${target} ${comment}`
        );
      }
    }
    if (rule.direction === "outbound" || rule.direction === "both") {
      if (rule.tunnelIp) {
        lines.push(
          `    ip saddr ${rule.tunnelIp} ${p} dport ${rule.externalPort} ` +
          `counter ${target} ${comment}`
        );
      }
    }
  }
  return lines;
}

// ── Main sync function ────────────────────────────────────────────────────────
export async function syncUserFirewallRules(): Promise<{
  ok: boolean;
  rulesWritten: number;
  usersAffected: number;
  error?: string;
  dryRun?: boolean;
}> {
  // In development / non-Linux environments, generate the file but skip nft exec
  const isDev = process.env.NODE_ENV !== "production" &&
                process.platform !== "linux";

  try {
    // Load all enabled rules with tunnel IPs
    const rules = await db
      .select()
      .from(userFirewallRulesTable)
      .where(eq(userFirewallRulesTable.enabled, true));

    // For rules missing tunnelIp, try to look up from devices table
    const enriched = await Promise.all(rules.map(async (r) => {
      if (r.tunnelIp) return r;
      const [device] = await db
        .select({ assignedIp: devicesTable.assignedIp })
        .from(devicesTable)
        .where(and(
          eq(devicesTable.userId, r.userId),
          eq(devicesTable.status, "active"),
        ))
        .limit(1);
      return { ...r, tunnelIp: device?.assignedIp ?? null };
    }));

    const userIds = new Set(enriched.map(r => r.userId));

    // ── Generate nftables file ────────────────────────────────────────────────
    const inputLines:   string[] = [];
    const forwardLines: string[] = [];

    for (const rule of enriched) {
      const lines = buildNftLine(rule);
      if (rule.tunnelIp) {
        forwardLines.push(...lines);
      } else {
        inputLines.push(...lines);
      }
    }

    const nftContent = [
      `# ============================================================`,
      `# ProxhqVPN — Per-User Persistent Firewall Rules`,
      `# © 2026 Alpha Unlimited Technologies LLC`,
      `# Generated: ${new Date().toISOString()}`,
      `# Rules: ${enriched.length}  Users: ${userIds.size}`,
      `#`,
      `# This file is auto-generated from the user_firewall_rules database table.`,
      `# DO NOT edit manually — changes will be overwritten on next sync.`,
      `# To modify rules: use the ProxhqVPN dashboard → Firewall → My Rules.`,
      `# ============================================================`,
      ``,
      `table inet proxhq_user_rules {`,
      ``,
      `    # ── Input chain — rules targeting the server itself ─────────────────`,
      `    chain user_input {`,
      `        type filter hook input priority filter + 10; policy accept;`,
      ...(inputLines.length > 0 ? inputLines : [`        # No server-level rules configured`]),
      `    }`,
      ``,
      `    # ── Forward chain — rules targeting VPN tunnel IPs ──────────────────`,
      `    # These apply to traffic being forwarded between wg0 and eth0.`,
      `    # Each rule targets a specific user's WireGuard tunnel IP (10.8.0.x).`,
      `    chain user_forward {`,
      `        type filter hook forward priority filter + 10; policy accept;`,
      ...(forwardLines.length > 0 ? forwardLines : [`        # No tunnel-level rules configured`]),
      `    }`,
      ``,
      `}`,
      ``,
    ].join("\n");

    // ── Write file ────────────────────────────────────────────────────────────
    if (!isDev) {
      await fs.mkdir(path.dirname(NFT_USER_RULES_PATH), { recursive: true });
      await fs.writeFile(NFT_USER_RULES_PATH, nftContent, "utf8");

      // Validate syntax first (-c = check only, no apply)
      await execFileAsync("nft", ["-c", "-f", NFT_USER_RULES_PATH]);

      // Delete old table cleanly then re-apply
      try {
        await execFileAsync("nft", ["delete", "table", "inet", "proxhq_user_rules"]);
      } catch {
        // Table may not exist yet on first run — that's fine
      }
      await execFileAsync("nft", ["-f", NFT_USER_RULES_PATH]);

      // Mark all applied rules as synced
      await db
        .update(userFirewallRulesTable)
        .set({ synced: true })
        .where(eq(userFirewallRulesTable.enabled, true));

      logger.info({ rulesWritten: enriched.length, users: userIds.size }, "[nftables-sync] rules applied");
    } else {
      logger.info(
        { rulesWritten: enriched.length, dryRun: true },
        "[nftables-sync] dry-run (non-production): nft exec skipped, file not written"
      );
    }

    return {
      ok: true,
      rulesWritten: enriched.length,
      usersAffected: userIds.size,
      dryRun: isDev,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[nftables-sync] sync failed");
    return { ok: false, rulesWritten: 0, usersAffected: 0, error: msg };
  }
}

// ── Startup sync — called once when the API server boots ────────────────────
export async function runStartupSync(): Promise<void> {
  const result = await syncUserFirewallRules();
  if (result.ok) {
    logger.info(
      { rulesWritten: result.rulesWritten, dryRun: result.dryRun },
      "[nftables-sync] startup sync complete"
    );
  } else {
    logger.warn({ error: result.error }, "[nftables-sync] startup sync failed (non-fatal)");
  }
}
