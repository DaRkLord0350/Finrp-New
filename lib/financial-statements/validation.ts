// ============================================================
// lib/financial-statements/validation.ts
// Pre-export validation engine for financial statements.
// ============================================================

import { prisma } from "@/lib/prisma";
import { computeReport, computeTrialBalance } from "./computation-engine";
import type { ValidationResult, ValidationIssue, ComputedLineItem } from "./types";

// ── Sum leaf amounts for a node key ───────────────────────────
function findNodeAmount(sections: ComputedLineItem[], key: string): number | null {
  for (const section of sections) {
    if (section.key === key) return section.amount;
    if (section.children) {
      const found = findNodeAmount(section.children, key);
      if (found !== null) return found;
    }
  }
  return null;
}

// ── Run all validations ───────────────────────────────────────
export async function validateReport(
  reportId: string,
  organizationId: string
): Promise<ValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];

  const report = await prisma.financialReport.findUniqueOrThrow({
    where: { id: reportId, organizationId },
    include: { template: true },
  });

  const computed = await computeReport(reportId);

  // ── 1. Unmapped accounts check ─────────────────────────────
  const mappedAccountIds = await prisma.accountScheduleMap.findMany({
    where: { organizationId, templateId: report.templateId, isActive: true },
    select: { accountId: true },
  });
  const mappedIds = new Set(mappedAccountIds.map((m) => m.accountId));

  const activeAccounts = await prisma.account.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true },
  });

  const unmapped = activeAccounts.filter((a) => !mappedIds.has(a.id));
  if (unmapped.length > 0) {
    errors.push({
      code: "UNMAPPED_ACCOUNTS",
      severity: "error",
      message: `${unmapped.length} account(s) are not mapped to any Schedule III line item: ${unmapped.slice(0, 5).map((a) => a.code + " " + a.name).join(", ")}${unmapped.length > 5 ? "..." : ""}`,
    });
  }

  // ── 2. Balance Sheet must balance ─────────────────────────
  if (report.statementType === "BALANCE_SHEET") {
    const totalAssets = findNodeAmount(computed.sections, "bs.total_assets") ??
      findNodeAmount(computed.sections, "ncbs.total_assets");
    const totalLiabilities = findNodeAmount(computed.sections, "bs.total_equity_liabilities") ??
      findNodeAmount(computed.sections, "ncbs.total_liabilities");

    if (totalAssets !== null && totalLiabilities !== null) {
      const diff = Math.abs(totalAssets - totalLiabilities);
      if (diff > 1) {
        errors.push({
          code: "BS_IMBALANCE",
          severity: "error",
          message: `Balance Sheet does not balance. Assets: ₹${totalAssets.toFixed(2)}, Equity+Liabilities: ₹${totalLiabilities.toFixed(2)}, Difference: ₹${diff.toFixed(2)}`,
          amount: diff,
        });
      }
    }
  }

  // ── 3. Trial balance check ─────────────────────────────────
  const tb = await computeTrialBalance(organizationId, report.periodStart, report.periodEnd);
  if (!tb.balanced) {
    errors.push({
      code: "TB_IMBALANCE",
      severity: "error",
      message: `Trial Balance is out of balance by ₹${Math.abs(tb.difference).toFixed(2)}. Statements cannot be finalised.`,
      amount: tb.difference,
    });
  }

  // ── 4. Zero-value totals warning ──────────────────────────
  const sections = computed.sections;
  for (const section of sections) {
    if (section.isTotal && Math.abs(section.amount) < 0.01) {
      warnings.push({
        code: "ZERO_TOTAL",
        severity: "warning",
        message: `Total "${section.label}" is zero. Verify all accounts are mapped.`,
        affectedKeys: [section.key],
      });
    }
  }

  // ── 5. Negative assets warning ─────────────────────────────
  function walkForNegative(items: ComputedLineItem[]) {
    for (const item of items) {
      if (!item.isSubtotal && !item.isTotal && item.amount < -0.01) {
        warnings.push({
          code: "NEGATIVE_ASSET",
          severity: "warning",
          message: `Line item "${item.label}" has a negative value: ₹${item.amount.toFixed(2)}`,
          affectedKeys: [item.key],
          amount: item.amount,
        });
      }
      if (item.children) walkForNegative(item.children);
    }
  }
  walkForNegative(sections);

  // ── 6. Status check ───────────────────────────────────────
  if (report.status === "LOCKED") {
    infos.push({
      code: "REPORT_LOCKED",
      severity: "info",
      message: "This report is locked. No further changes can be made.",
    });
  }

  // ── 7. Low-confidence mappings warning ────────────────────
  const lowConfidence = await prisma.accountScheduleMap.count({
    where: {
      organizationId,
      templateId: report.templateId,
      isActive: true,
      source: "AI_AUTO",
      confidence: { lt: 0.7 },
    },
  });
  if (lowConfidence > 0) {
    warnings.push({
      code: "LOW_CONFIDENCE_MAPPINGS",
      severity: "warning",
      message: `${lowConfidence} account mapping(s) have low AI confidence (< 70%). Please review in Ledger Mapping.`,
    });
  }

  // ── 8. Adjustment journals not posted ─────────────────────
  const draftAdjustments = await prisma.adjustmentJournal.count({
    where: { financialStatementId: reportId, status: "DRAFT" },
  });
  if (draftAdjustments > 0) {
    warnings.push({
      code: "DRAFT_ADJUSTMENTS",
      severity: "warning",
      message: `${draftAdjustments} adjustment journal(s) are still in DRAFT status and will NOT be included in the statement.`,
    });
  }

  const valid = errors.length === 0;
  const summary = valid
    ? `Validation passed with ${warnings.length} warning(s).`
    : `Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`;

  return { valid, errors, warnings, infos, summary };
}
