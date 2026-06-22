// ============================================================
// lib/tax/validation/engine.ts
//
// runValidation() — executes the effective rule set for a scheme +
// subject and persists a TaxValidationRun with its findings.
//
// Effective rules = code defaults (registry) overlaid with any active
// DB rows (TaxValidationRule) of the same code. DB rows can disable a
// rule, change severity/blocking, or add org-specific rules. This means
// the engine works out-of-the-box AND supports hundreds of configurable
// rules per the product spec.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma, TaxScheme } from "@prisma/client";
import { resolveTaxConfig } from "../config/loader";
import { getHandler, defaultRuleDefinitions } from "./registry";
import type { RuleDefinition, StampedFinding, ValidationOutcome } from "./types";

export interface RunValidationArgs<S> {
  organizationId: string;
  scheme: TaxScheme;
  subjectType: string;
  subjectId?: string;
  period?: string;
  axis?: "FY" | "AY";
  subject: S;
  triggeredById?: string;
  /** When true (default) the run + findings are written to the DB. */
  persist?: boolean;
}

interface EffectiveRule extends RuleDefinition {
  isActive: boolean;
}

/** Merge code defaults with DB overrides (by code; org rows win). */
async function resolveEffectiveRules(
  organizationId: string,
  scheme: TaxScheme
): Promise<EffectiveRule[]> {
  const defaults = defaultRuleDefinitions(scheme);
  const byCode = new Map<string, EffectiveRule>();
  for (const d of defaults) byCode.set(d.code, { ...d, isActive: true });

  const dbRules = await prisma.taxValidationRule.findMany({
    where: {
      scheme,
      deletedAt: null,
      OR: [{ organizationId: null }, { organizationId }],
    },
    orderBy: { organizationId: "asc" }, // null (system) first, org overrides after
  });

  for (const r of dbRules) {
    byCode.set(r.code, {
      code: r.code,
      scheme: r.scheme,
      name: r.name,
      description: r.description ?? undefined,
      explanation: r.explanation ?? undefined,
      severity: r.severity,
      blocking: r.blocking,
      handlerKey: r.handlerKey,
      params: (r.params as Record<string, unknown> | null) ?? undefined,
      isActive: r.isActive,
    });
  }

  return [...byCode.values()].filter((r) => r.isActive);
}

export async function runValidation<S>(args: RunValidationArgs<S>): Promise<ValidationOutcome> {
  const { organizationId, scheme, subject, persist = true } = args;
  const config = await resolveTaxConfig({
    scheme,
    period: args.period ?? "2025-26",
    axis: args.axis ?? "FY",
    organizationId,
  });

  const rules = await resolveEffectiveRules(organizationId, scheme);
  const findings: StampedFinding[] = [];

  for (const rule of rules) {
    const handler = getHandler(rule.handlerKey);
    if (!handler) continue; // a configured rule with no implementation is skipped
    try {
      const issues = await handler({
        subject,
        params: rule.params ?? {},
        config,
        organizationId,
        period: args.period,
      });
      for (const issue of issues) {
        findings.push({
          ...issue,
          ruleCode: rule.code,
          severity: rule.severity,
          blocking: rule.blocking,
          explanation: issue.explanation ?? rule.explanation,
        });
      }
    } catch (err) {
      // A misbehaving rule must not abort the whole run.
      findings.push({
        ruleCode: rule.code,
        severity: "WARNING",
        blocking: false,
        message: `Rule ${rule.code} failed to evaluate: ${(err as Error).message}`,
      });
    }
  }

  const errorCount = findings.filter((f) => f.severity === "ERROR").length;
  const warningCount = findings.filter((f) => f.severity === "WARNING").length;
  const infoCount = findings.filter((f) => f.severity === "INFO").length;
  const blocked = findings.some((f) => f.severity === "ERROR" && f.blocking);
  const passed = errorCount === 0;

  let runId: string | null = null;
  if (persist) {
    const run = await prisma.taxValidationRun.create({
      data: {
        organizationId,
        scheme,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        period: args.period,
        passed,
        blocked,
        errorCount,
        warningCount,
        infoCount,
        triggeredById: args.triggeredById,
        findings: {
          create: findings.map((f) => ({
            ruleCode: f.ruleCode,
            severity: f.severity,
            blocking: f.blocking,
            field: f.field,
            message: f.message,
            explanation: f.explanation,
            pointer: f.pointer,
            value: (f.value ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        },
      },
    });
    runId = run.id;
  }

  return { runId, passed, blocked, errorCount, warningCount, infoCount, findings };
}

/**
 * Seed the default rule definitions for a scheme into TaxValidationRule
 * as SYSTEM rows (organizationId = null). Idempotent — skips existing
 * codes. Use from an admin/seed action so rules become editable in the UI.
 */
export async function seedDefaultRules(scheme?: TaxScheme): Promise<number> {
  const defs = defaultRuleDefinitions(scheme);
  let created = 0;
  for (const d of defs) {
    const exists = await prisma.taxValidationRule.findFirst({
      where: { organizationId: null, code: d.code },
    });
    if (exists) continue;
    await prisma.taxValidationRule.create({
      data: {
        organizationId: null,
        scheme: d.scheme,
        code: d.code,
        name: d.name,
        description: d.description,
        explanation: d.explanation,
        severity: d.severity,
        blocking: d.blocking,
        handlerKey: d.handlerKey,
        params: (d.params ?? undefined) as Prisma.InputJsonValue | undefined,
        isActive: true,
      },
    });
    created++;
  }
  return created;
}
