// ============================================================
// lib/financial-statements/computation-engine.ts
// Computes financial statement line items from GL data.
// NEVER reads Invoice / Payment / etc. directly — only JournalLine.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { ComputedLineItem, ComputedReport, ScheduleNode, TemplateStructure } from "./types";

// ── Account balance from GL for a period ──────────────────────
interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
  netBalance: number; // debit-positive convention
}

async function getAccountBalances(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Map<string, AccountBalance>> {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        organizationId,
        status: "POSTED",
        entryDate: { gte: periodStart, lte: periodEnd },
        deletedAt: null,
      },
    },
    include: { account: { select: { id: true, code: true, name: true } } },
  });

  const map = new Map<string, AccountBalance>();
  for (const line of lines) {
    const existing = map.get(line.accountId) ?? {
      accountId: line.accountId,
      code: line.account.code,
      name: line.account.name,
      debit: 0,
      credit: 0,
      netBalance: 0,
    };
    const amt = Number(line.amount.toString());
    if (line.type === "DEBIT") {
      existing.debit += amt;
    } else {
      existing.credit += amt;
    }
    existing.netBalance = existing.debit - existing.credit;
    map.set(line.accountId, existing);
  }
  return map;
}

// ── Adjustment delta per scheduleKey ──────────────────────────
async function getAdjustmentDeltas(reportId: string): Promise<Map<string, number>> {
  const entries = await prisma.adjustmentEntry.findMany({
    where: {
      adjustmentJournal: {
        financialStatementId: reportId,
        status: "POSTED",
      },
    },
  });

  const map = new Map<string, number>();
  for (const e of entries) {
    const cur = map.get(e.scheduleKey) ?? 0;
    const amt = Number(e.amount.toString());
    map.set(e.scheduleKey, cur + (e.type === "DEBIT" ? amt : -amt));
  }
  return map;
}

// ── Mapping: scheduleKey → list of accountIds ─────────────────
async function getScheduleMappings(
  organizationId: string,
  templateId: string
): Promise<Map<string, string[]>> {
  const mappings = await prisma.accountScheduleMap.findMany({
    where: { organizationId, templateId, isActive: true },
    select: { accountId: true, scheduleKey: true },
  });

  const map = new Map<string, string[]>();
  for (const m of mappings) {
    const list = map.get(m.scheduleKey) ?? [];
    list.push(m.accountId);
    map.set(m.scheduleKey, list);
  }
  return map;
}

// ── Recursive node computation ─────────────────────────────────
function computeNode(
  node: ScheduleNode,
  accountBalances: Map<string, AccountBalance>,
  scheduleMappings: Map<string, string[]>,
  adjustments: Map<string, number>,
  comparativeBalances?: Map<string, AccountBalance>,
  comparativeMappings?: Map<string, string[]>
): ComputedLineItem {
  if (node.children && node.children.length > 0) {
    const children = node.children.map((child) =>
      computeNode(child, accountBalances, scheduleMappings, adjustments, comparativeBalances, comparativeMappings)
    );
    const amount = children.reduce((sum, c) => sum + c.amount, 0);
    const comparativeAmount = comparativeBalances
      ? children.reduce((sum, c) => sum + (c.comparativeAmount ?? 0), 0)
      : undefined;
    return {
      key: node.key,
      label: node.label,
      amount,
      comparativeAmount,
      noteRef: node.noteRef,
      isSubtotal: node.isSubtotal,
      isTotal: node.isTotal,
      children,
    };
  }

  // Leaf: sum GL balances for mapped accounts
  const accountIds = scheduleMappings.get(node.key) ?? [];
  let amount = 0;
  for (const id of accountIds) {
    const bal = accountBalances.get(id);
    if (bal) {
      amount += node.signConvention === "credit" ? -bal.netBalance : bal.netBalance;
    }
  }
  amount += adjustments.get(node.key) ?? 0;

  let comparativeAmount: number | undefined;
  if (comparativeBalances && comparativeMappings) {
    const cmpIds = comparativeMappings.get(node.key) ?? [];
    let cmpAmount = 0;
    for (const id of cmpIds) {
      const bal = comparativeBalances.get(id);
      if (bal) {
        cmpAmount += node.signConvention === "credit" ? -bal.netBalance : bal.netBalance;
      }
    }
    comparativeAmount = cmpAmount;
  }

  return {
    key: node.key,
    label: node.label,
    amount,
    comparativeAmount,
    noteRef: node.noteRef,
    isSubtotal: node.isSubtotal,
    isTotal: node.isTotal,
  };
}

// ── Public: compute a full report ─────────────────────────────
export async function computeReport(reportId: string): Promise<ComputedReport> {
  const report = await prisma.financialReport.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      template: true,
      organization: { select: { accountingSettings: { select: { baseCurrency: true } } } },
    },
  });

  const structure = report.template.structure as unknown as TemplateStructure;

  const [accountBalances, scheduleMappings, adjustments] = await Promise.all([
    getAccountBalances(report.organizationId, report.periodStart, report.periodEnd),
    getScheduleMappings(report.organizationId, report.template.id),
    getAdjustmentDeltas(reportId),
  ]);

  let comparativeBalances: Map<string, AccountBalance> | undefined;
  let comparativeMappings: Map<string, string[]> | undefined;
  if (report.comparativeStart && report.comparativeEnd) {
    [comparativeBalances, comparativeMappings] = await Promise.all([
      getAccountBalances(report.organizationId, report.comparativeStart, report.comparativeEnd),
      getScheduleMappings(report.organizationId, report.template.id),
    ]);
  }

  const sections = structure.sections.map((node) =>
    computeNode(node, accountBalances, scheduleMappings, adjustments, comparativeBalances, comparativeMappings)
  );

  return {
    reportId,
    statementType: report.statementType,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    comparativeStart: report.comparativeStart?.toISOString(),
    comparativeEnd: report.comparativeEnd?.toISOString(),
    currency: report.organization.accountingSettings?.baseCurrency ?? "INR",
    sections,
    includesAdjustments: adjustments.size > 0,
    computedAt: new Date().toISOString(),
  };
}

// ── Public: compute trial balance ─────────────────────────────
export async function computeTrialBalance(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const balances = await getAccountBalances(organizationId, periodStart, periodEnd);

  const accounts = await prisma.account.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  let totalDebit = 0;
  let totalCredit = 0;
  const rows = [];

  for (const acc of accounts) {
    const bal = balances.get(acc.id);
    if (!bal) continue;
    if (bal.debit === 0 && bal.credit === 0) continue;
    totalDebit += bal.debit;
    totalCredit += bal.credit;
    rows.push({
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: bal.debit,
      credit: bal.credit,
      netBalance: bal.netBalance,
    });
  }

  return {
    rows,
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}
