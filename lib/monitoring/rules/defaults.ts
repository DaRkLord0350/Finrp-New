// ============================================================
// lib/monitoring/rules/defaults.ts
//
// Illustrative starting thresholds only — NOT asserted as any
// regulator's mandated reporting threshold (e.g. FIU-IND's actual CTR
// cutoff). Every organization should tune these via MonitoringRule.config;
// these are just what an evaluator falls back to when an org hasn't
// configured a rule of that type yet.
// ============================================================

import type { MonitoringRuleType } from "@prisma/client";

export const DEFAULT_RULE_CONFIG: Record<MonitoringRuleType, Record<string, number>> = {
  HIGH_CASH_TRANSACTION: { amountThreshold: 200_000, lookbackDays: 1 },
  LARGE_TRANSACTION: { amountThreshold: 1_000_000, lookbackDays: 1 },
  DORMANT_ACCOUNT: { dormancyDays: 90 },
  REPAYMENT_OVERDUE: { lookbackDays: 1 },
  LOAN_DEFAULT: { lookbackDays: 1 },
  BOUNCE_DETECTION: { lookbackDays: 1 },
  CREDIT_SCORE_DROP: { dropThreshold: 50, lookbackDays: 180 },
  AML_CASE_OPENED: {},
  FRAUD_CASE_OPENED: {},
};

export function getRuleConfig(ruleType: MonitoringRuleType, override: Record<string, unknown> | null | undefined): Record<string, number> {
  const base = DEFAULT_RULE_CONFIG[ruleType];
  if (!override) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (typeof value === "number" && key in base) merged[key as keyof typeof base] = value;
  }
  return merged;
}
