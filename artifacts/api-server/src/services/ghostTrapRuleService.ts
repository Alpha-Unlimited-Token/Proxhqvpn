// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap Rule Service — detection rule CRUD and evaluation.
import { db } from "@workspace/db";
import { ghostTrapRulesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

export type RuleAction = "log" | "tarpit" | "block" | "silk_trap";
export type RuleType   = "path_pattern" | "ua_pattern" | "header_pattern" | "ip_cidr";

export async function listRules(userId: string) {
  return db
    .select()
    .from(ghostTrapRulesTable)
    .where(eq(ghostTrapRulesTable.userId, userId))
    .orderBy(desc(ghostTrapRulesTable.priority));
}

export async function createRule(userId: string, opts: {
  ruleType: RuleType;
  pattern: string;
  action: RuleAction;
  priority?: number;
  description?: string;
}) {
  const [row] = await db
    .insert(ghostTrapRulesTable)
    .values({
      userId,
      ruleType:    opts.ruleType,
      pattern:     opts.pattern,
      action:      opts.action,
      priority:    opts.priority ?? 50,
      description: opts.description ?? null,
    })
    .returning();
  return row!;
}

export async function updateRule(id: number, userId: string, patch: Partial<{
  pattern: string;
  action: RuleAction;
  priority: number;
  enabled: boolean;
  description: string;
}>) {
  const [row] = await db
    .update(ghostTrapRulesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(ghostTrapRulesTable.id, id), eq(ghostTrapRulesTable.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteRule(id: number, userId: string) {
  const result = await db
    .delete(ghostTrapRulesTable)
    .where(and(eq(ghostTrapRulesTable.id, id), eq(ghostTrapRulesTable.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export function evaluateRules(
  rules: Array<{ ruleType: string; pattern: string; action: string; enabled: boolean; priority: number }>,
  context: { path?: string; ua?: string; ip?: string },
): { matched: boolean; action: string; rule?: typeof rules[number] } {
  const sorted = [...rules].filter(r => r.enabled).sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    try {
      const re = new RegExp(rule.pattern, "i");
      let hit = false;
      if (rule.ruleType === "path_pattern"   && context.path && re.test(context.path)) hit = true;
      if (rule.ruleType === "ua_pattern"     && context.ua   && re.test(context.ua))   hit = true;
      if (rule.ruleType === "header_pattern" && context.ua   && re.test(context.ua))   hit = true;
      if (rule.ruleType === "ip_cidr"        && context.ip   && context.ip === rule.pattern) hit = true;
      if (hit) return { matched: true, action: rule.action, rule };
    } catch {
      /* invalid regex — skip rule */
    }
  }
  return { matched: false, action: "log" };
}
