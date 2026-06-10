// ============================================================
// FinRP Banking OS — Auto-Categorization Engine
// Evaluates BankingRule conditions against transactions and
// applies the resulting actions (category, txnType, flags, tags).
// ============================================================

import { prisma } from "@/lib/prisma";
import type { RuleCondition, RuleAction } from "./types";

// ---------------------------------------------------------------------------
// Keyword patterns for fallback (system-level, pre-rule matching)
// ---------------------------------------------------------------------------
const KEYWORD_PATTERNS: Array<{
  pattern: RegExp;
  category: string;
  txnType: string;
}> = [
  { pattern: /\b(salary|sal|wages|payroll|hrmspayroll)\b/i, category: "Salary", txnType: "SALARY" },
  { pattern: /\bgst\b/i, category: "GST Payment", txnType: "GST_PAYMENT" },
  { pattern: /\btds\b/i, category: "TDS Payment", txnType: "TDS_PAYMENT" },
  { pattern: /\b(emi|loan\s*emi|equated\s*monthly)\b/i, category: "Loan EMI", txnType: "LOAN_EMI" },
  { pattern: /\b(neft|rtgs|imps|upi)\b/i, category: "Bank Transfer", txnType: "NEFT" },
  { pattern: /\b(int(erest)?\s*cr|interest\s*on)\b/i, category: "Bank Interest", txnType: "INTEREST" },
  { pattern: /\b(bank\s*charge|service\s*charge|processing\s*fee|annual\s*fee)\b/i, category: "Bank Charges", txnType: "BANK_CHARGE" },
  { pattern: /\b(refund|reversal|ret(urn)?)\b/i, category: "Refund", txnType: "REFUND" },
  { pattern: /\b(vendor|supplier|purchase)\b/i, category: "Vendor Payment", txnType: "VENDOR_PAYMENT" },
  { pattern: /\b(invoice|inv|rcpt|receipt)\b/i, category: "Customer Receipt", txnType: "CUSTOMER_RECEIPT" },
  { pattern: /\bdividend\b/i, category: "Dividend", txnType: "DIVIDEND" },
  { pattern: /\b(atm|cash\s*withdrawal|withdrawal)\b/i, category: "Cash Withdrawal", txnType: "CASH" },
];

// ---------------------------------------------------------------------------
// Evaluate a single rule condition against a transaction
// ---------------------------------------------------------------------------
function evalCondition(
  condition: RuleCondition,
  txn: {
    narration: string;
    credit?: number | null;
    debit?: number | null;
    referenceNumber?: string | null;
    txnType?: string | null;
  }
): boolean {
  const rawValue = condition.field === "narration"
    ? txn.narration
    : condition.field === "referenceNumber"
    ? (txn.referenceNumber ?? "")
    : condition.field === "txnType"
    ? (txn.txnType ?? "")
    : condition.field === "credit"
    ? (txn.credit ?? 0)
    : condition.field === "debit"
    ? (txn.debit ?? 0)
    : condition.field === "amount"
    ? Math.max(txn.credit ?? 0, txn.debit ?? 0)
    : "";

  const cv = condition.value;

  switch (condition.operator) {
    case "contains":
      return typeof rawValue === "string" && rawValue.toLowerCase().includes(String(cv).toLowerCase());
    case "starts_with":
      return typeof rawValue === "string" && rawValue.toLowerCase().startsWith(String(cv).toLowerCase());
    case "ends_with":
      return typeof rawValue === "string" && rawValue.toLowerCase().endsWith(String(cv).toLowerCase());
    case "equals":
      return String(rawValue).toLowerCase() === String(cv).toLowerCase();
    case "gt":
      return Number(rawValue) > Number(cv);
    case "lt":
      return Number(rawValue) < Number(cv);
    case "gte":
      return Number(rawValue) >= Number(cv);
    case "lte":
      return Number(rawValue) <= Number(cv);
    case "regex":
      try {
        return new RegExp(String(cv), "i").test(String(rawValue));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Evaluate all conditions for a rule (AND/OR logic)
// ---------------------------------------------------------------------------
function evalRuleConditions(
  conditions: RuleCondition[],
  txn: Parameters<typeof evalCondition>[1]
): boolean {
  if (conditions.length === 0) return false;

  let result = evalCondition(conditions[0], txn);

  for (let i = 1; i < conditions.length; i++) {
    const cond = conditions[i];
    const current = evalCondition(cond, txn);
    if ((cond.logic ?? "AND") === "OR") {
      result = result || current;
    } else {
      result = result && current;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Apply rule actions and return update payload
// ---------------------------------------------------------------------------
function applyActions(
  actions: RuleAction[],
  existing: { tags?: string[] }
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  const tags = [...(existing.tags ?? [])];

  for (const action of actions) {
    switch (action.type) {
      case "set_category":
        update.category = action.value;
        update.status = "CATEGORIZED";
        break;
      case "set_subcategory":
        update.subCategory = action.value;
        break;
      case "set_txn_type":
        update.txnType = action.value;
        break;
      case "flag":
        update.isFlagged = true;
        break;
      case "add_tag":
        if (!tags.includes(action.value)) tags.push(action.value);
        break;
      case "set_gst_category":
        update.gstCategory = action.value;
        break;
    }
  }

  if (tags.length > 0) update.tags = tags;
  return update;
}

// ---------------------------------------------------------------------------
// Categorize a single transaction using active rules
// Falls back to keyword matching if no rule fires
// ---------------------------------------------------------------------------
export async function categorizeTransaction(
  transactionId: string,
  organizationId: string
): Promise<void> {
  const txn = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true, narration: true, credit: true, debit: true,
      referenceNumber: true, txnType: true, tags: true,
      status: true, category: true,
    },
  });
  if (!txn || txn.status === "MATCHED" || txn.status === "EXCLUDED") return;

  const rules = await prisma.bankingRule.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  for (const rule of rules) {
    const conditions = rule.conditions as unknown as RuleCondition[];
    const actions = rule.actions as unknown as RuleAction[];
    const amount = Math.max(Number(txn.credit ?? 0), Number(txn.debit ?? 0));

    const matched = evalRuleConditions(conditions, {
      narration: txn.narration,
      credit: Number(txn.credit ?? 0),
      debit: Number(txn.debit ?? 0),
      referenceNumber: txn.referenceNumber,
      txnType: txn.txnType,
    });

    if (matched) {
      const update = applyActions(actions, { tags: txn.tags });
      await prisma.$transaction([
        prisma.bankTransaction.update({ where: { id: txn.id }, data: update }),
        prisma.bankingRule.update({
          where: { id: rule.id },
          data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() },
        }),
      ]);
      return;
    }
  }

  // Keyword fallback (only if uncategorized)
  if (!txn.category) {
    for (const kp of KEYWORD_PATTERNS) {
      if (kp.pattern.test(txn.narration)) {
        await prisma.bankTransaction.update({
          where: { id: txn.id },
          data: { category: kp.category, txnType: kp.txnType as never, status: "CATEGORIZED", aiCategory: kp.category, aiConfidence: 0.7 },
        });
        return;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Bulk categorize — run rules on a batch of unreviewed transactions
// ---------------------------------------------------------------------------
export async function bulkCategorize(
  organizationId: string,
  transactionIds?: string[]
): Promise<{ processed: number; categorized: number }> {
  const where = {
    organizationId,
    status: { in: ["UNREVIEWED" as const, "REVIEWED" as const] },
    ...(transactionIds ? { id: { in: transactionIds } } : {}),
  };

  const txns = await prisma.bankTransaction.findMany({
    where,
    select: { id: true },
    take: 500,
  });

  let categorized = 0;
  for (const txn of txns) {
    const before = await prisma.bankTransaction.findUnique({
      where: { id: txn.id },
      select: { category: true },
    });
    await categorizeTransaction(txn.id, organizationId);
    const after = await prisma.bankTransaction.findUnique({
      where: { id: txn.id },
      select: { category: true },
    });
    if (after?.category && !before?.category) categorized++;
  }

  return { processed: txns.length, categorized };
}

// ---------------------------------------------------------------------------
// Apply a specific set of updates to multiple transactions at once
// (UI bulk categorization panel)
// ---------------------------------------------------------------------------
export async function bulkSetCategory(
  organizationId: string,
  transactionIds: string[],
  category: string,
  subCategory?: string,
  txnType?: string
): Promise<number> {
  const result = await prisma.bankTransaction.updateMany({
    where: { organizationId, id: { in: transactionIds } },
    data: {
      category,
      subCategory: subCategory ?? null,
      ...(txnType ? { txnType: txnType as never } : {}),
      status: "CATEGORIZED",
    },
  });
  return result.count;
}
