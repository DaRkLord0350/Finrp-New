// ============================================================
// lib/tax/financials/service.ts
//
// Trial Balance import → intelligent ledger mapping → Balance Sheet
// & Profit-and-Loss generation. Mapping is heuristic by default and
// overridable per-org via LedgerMapping rows.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma, TbStatement, TaxImportSource } from "@prisma/client";
import { round2, toNumber } from "../core/money";
import type { RawRow } from "../import/types";

// ── Default ledger classifier (group + head + statement) ──────
interface Classification { group: string; head: string; statement: TbStatement }

const RULES: { re: RegExp; group: string; head: string; statement: TbStatement }[] = [
  { re: /sales|revenue|service income|fees earned/i, group: "Revenue", head: "Revenue from Operations", statement: "PROFIT_LOSS" },
  { re: /other income|interest income|discount received|commission received/i, group: "Other Income", head: "Other Income", statement: "PROFIT_LOSS" },
  { re: /purchase|cost of goods|cogs|raw material/i, group: "Direct Expenses", head: "Cost of Materials", statement: "PROFIT_LOSS" },
  { re: /salary|wages|payroll|staff/i, group: "Employee Cost", head: "Employee Benefits", statement: "PROFIT_LOSS" },
  { re: /rent|electricity|telephone|travel|office|admin|professional|audit fee|expense/i, group: "Indirect Expenses", head: "Other Expenses", statement: "PROFIT_LOSS" },
  { re: /depreciation/i, group: "Depreciation", head: "Depreciation & Amortisation", statement: "PROFIT_LOSS" },
  { re: /interest paid|finance cost|bank charges/i, group: "Finance Cost", head: "Finance Costs", statement: "PROFIT_LOSS" },
  { re: /building|plant|machinery|furniture|vehicle|computer|fixed asset|equipment/i, group: "Fixed Assets", head: "Property, Plant & Equipment", statement: "BALANCE_SHEET" },
  { re: /investment/i, group: "Investments", head: "Investments", statement: "BALANCE_SHEET" },
  { re: /debtor|receivable|sundry debtor/i, group: "Current Assets", head: "Trade Receivables", statement: "BALANCE_SHEET" },
  { re: /cash|bank|petty cash/i, group: "Current Assets", head: "Cash & Bank Balances", statement: "BALANCE_SHEET" },
  { re: /stock|inventory|closing stock/i, group: "Current Assets", head: "Inventories", statement: "BALANCE_SHEET" },
  { re: /capital|proprietor|partner.?s? capital|share capital/i, group: "Equity", head: "Capital Account", statement: "BALANCE_SHEET" },
  { re: /reserve|surplus|retained/i, group: "Equity", head: "Reserves & Surplus", statement: "BALANCE_SHEET" },
  { re: /loan|borrowing|term loan|od|cc limit/i, group: "Borrowings", head: "Borrowings", statement: "BALANCE_SHEET" },
  { re: /creditor|payable|sundry creditor/i, group: "Current Liabilities", head: "Trade Payables", statement: "BALANCE_SHEET" },
  { re: /duties|taxes|gst|tds payable|provision/i, group: "Current Liabilities", head: "Other Current Liabilities", statement: "BALANCE_SHEET" },
];

function classifyLedger(name: string): Classification {
  for (const r of RULES) if (r.re.test(name)) return { group: r.group, head: r.head, statement: r.statement };
  return { group: "Unclassified", head: "Suspense", statement: "UNMAPPED" };
}

// ── Import ────────────────────────────────────────────────────
export interface TbRow { ledgerName: string; debit: number; credit: number }

export function normalizeTbRows(rows: RawRow[]): TbRow[] {
  const pick = (raw: RawRow, keys: string[]): string | undefined => {
    const lower = new Map<string, unknown>();
    for (const [k, v] of Object.entries(raw)) lower.set(k.toLowerCase().replace(/[\s_]+/g, ""), v);
    for (const key of keys) { const hit = lower.get(key.toLowerCase().replace(/[\s_]+/g, "")); if (hit !== undefined && hit !== null && hit !== "") return String(hit).trim(); }
    return undefined;
  };
  const num = (v?: string) => { if (!v) return 0; const x = Number(v.replace(/[, ]/g, "")); return Number.isFinite(x) ? x : 0; };
  return rows
    .map((r) => ({ ledgerName: pick(r, ["ledger", "ledger_name", "account", "particulars", "name"]) ?? "", debit: num(pick(r, ["debit", "dr"])), credit: num(pick(r, ["credit", "cr"])) }))
    .filter((r) => r.ledgerName);
}

export async function importTrialBalance(params: {
  organizationId: string;
  financialYear: string;
  rows: TbRow[];
  source?: TaxImportSource;
  fileName?: string;
  createdById?: string;
}) {
  const { organizationId, financialYear, rows } = params;

  // Pull org overrides once.
  const overrides = await prisma.ledgerMapping.findMany({ where: { organizationId } });
  const overrideMap = new Map(overrides.map((o) => [o.ledgerName.toLowerCase(), o]));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 1;

  const created = await prisma.trialBalanceImport.create({
    data: {
      organizationId, financialYear,
      source: params.source ?? "MANUAL", fileName: params.fileName,
      totalDebit: round2(totalDebit), totalCredit: round2(totalCredit), balanced, lineCount: rows.length,
      createdById: params.createdById,
      lines: {
        create: rows.map((r) => {
          const ov = overrideMap.get(r.ledgerName.toLowerCase());
          const cls = ov ? { group: ov.group, head: ov.head, statement: ov.statement } : classifyLedger(r.ledgerName);
          return {
            organizationId, ledgerName: r.ledgerName,
            debit: round2(r.debit), credit: round2(r.credit),
            group: cls.group, head: cls.head, statement: cls.statement,
          };
        }),
      },
    },
    include: { lines: true },
  });

  return created;
}

export async function getLatestTrialBalance(organizationId: string, financialYear?: string) {
  return prisma.trialBalanceImport.findFirst({
    where: { organizationId, deletedAt: null, ...(financialYear ? { financialYear } : {}) },
    orderBy: { createdAt: "desc" },
    include: { lines: { orderBy: { ledgerName: "asc" } } },
  });
}

export async function saveLedgerMapping(params: { organizationId: string; ledgerName: string; group: string; head: string; statement: TbStatement }) {
  return prisma.ledgerMapping.upsert({
    where: { organizationId_ledgerName: { organizationId: params.organizationId, ledgerName: params.ledgerName } },
    create: params,
    update: { group: params.group, head: params.head, statement: params.statement },
  });
}

// ── Financial statement generation ────────────────────────────
interface HeadLine { head: string; amount: number }

export async function generateFinancialStatements(params: { organizationId: string; financialYear: string; generatedById?: string }) {
  const { organizationId, financialYear } = params;
  const tb = await getLatestTrialBalance(organizationId, financialYear);
  if (!tb) throw new Error("No trial balance imported for this year");

  const plExpenses = new Map<string, number>();
  const plIncome = new Map<string, number>();
  const bsAssets = new Map<string, number>();
  const bsLiab = new Map<string, number>();

  for (const l of tb.lines) {
    const net = toNumber(l.debit) - toNumber(l.credit); // Dr +, Cr -
    const head = l.head ?? "Suspense";
    if (l.statement === "PROFIT_LOSS") {
      if (net >= 0) plExpenses.set(head, (plExpenses.get(head) ?? 0) + net);
      else plIncome.set(head, (plIncome.get(head) ?? 0) - net);
    } else if (l.statement === "BALANCE_SHEET") {
      if (net >= 0) bsAssets.set(head, (bsAssets.get(head) ?? 0) + net);
      else bsLiab.set(head, (bsLiab.get(head) ?? 0) - net);
    }
  }

  const toLines = (m: Map<string, number>): HeadLine[] => [...m.entries()].map(([head, amount]) => ({ head, amount: round2(amount).toNumber() })).filter((x) => x.amount !== 0);
  const sumLines = (l: HeadLine[]) => round2(l.reduce((s, x) => s + x.amount, 0)).toNumber();

  const incomeLines = toLines(plIncome);
  const expenseLines = toLines(plExpenses);
  const totalIncome = sumLines(incomeLines);
  const totalExpenses = sumLines(expenseLines);
  const netProfit = round2(totalIncome - totalExpenses).toNumber();

  const assetLines = toLines(bsAssets);
  const liabLines = toLines(bsLiab);
  const totalAssets = sumLines(assetLines);
  // Net profit accrues to equity on the liabilities side.
  const liabWithProfit = [...liabLines, { head: "Profit for the year", amount: netProfit }];
  const totalLiabilities = round2(sumLines(liabLines) + netProfit).toNumber();

  const plPayload = { financialYear, income: incomeLines, expenses: expenseLines, totalIncome, totalExpenses, netProfit };
  const bsPayload = { financialYear, assets: assetLines, liabilities: liabWithProfit, totalAssets, totalLiabilities, difference: round2(totalAssets - totalLiabilities).toNumber() };

  const [pl, bs] = await prisma.$transaction([
    prisma.financialStatement.upsert({
      where: { organizationId_financialYear_type: { organizationId, financialYear, type: "PROFIT_LOSS" } },
      create: { organizationId, financialYear, type: "PROFIT_LOSS", payload: plPayload as unknown as Prisma.InputJsonValue, netProfit: round2(netProfit), generatedById: params.generatedById },
      update: { payload: plPayload as unknown as Prisma.InputJsonValue, netProfit: round2(netProfit), generatedById: params.generatedById },
    }),
    prisma.financialStatement.upsert({
      where: { organizationId_financialYear_type: { organizationId, financialYear, type: "BALANCE_SHEET" } },
      create: { organizationId, financialYear, type: "BALANCE_SHEET", payload: bsPayload as unknown as Prisma.InputJsonValue, totalAssets: round2(totalAssets), totalLiabilities: round2(totalLiabilities), generatedById: params.generatedById },
      update: { payload: bsPayload as unknown as Prisma.InputJsonValue, totalAssets: round2(totalAssets), totalLiabilities: round2(totalLiabilities), generatedById: params.generatedById },
    }),
  ]);

  return { profitAndLoss: { ...pl, payload: plPayload }, balanceSheet: { ...bs, payload: bsPayload } };
}

export async function getFinancialStatements(organizationId: string, financialYear: string) {
  const statements = await prisma.financialStatement.findMany({ where: { organizationId, financialYear } });
  return {
    profitAndLoss: statements.find((s) => s.type === "PROFIT_LOSS") ?? null,
    balanceSheet: statements.find((s) => s.type === "BALANCE_SHEET") ?? null,
  };
}
