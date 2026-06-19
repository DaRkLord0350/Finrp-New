// ============================================================
// General Ledger — POSTED journal entries by account, with a per-account
// opening balance (as of the period start) and a running balance.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma, type AccountType } from "@prisma/client";
import { resolveDateRange } from "./filters";
import { normalBalanceForType } from "@/lib/services/accounting.service";
import type { ReportFilters, ReportResult } from "./types";

interface GeneralLedgerRow {
  entryDate: string;
  reference: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export async function generateGeneralLedger(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<GeneralLedgerRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  // Per-account opening balance (debit-positive) as of the period start:
  // opening direction normalized + posted movement strictly before startDate.
  const openingRows = await prisma.$queryRaw<{
    account_code: string;
    account_type: AccountType;
    opening: string;
    debit: string;
    credit: string;
  }[]>`
    SELECT
      a.code AS account_code,
      a.type AS account_type,
      a."openingBalance"::text AS opening,
      COALESCE(SUM(CASE WHEN jl.type = 'DEBIT'  THEN jl.amount ELSE 0 END), 0)::text AS debit,
      COALESCE(SUM(CASE WHEN jl.type = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl."accountId" = a.id
    LEFT JOIN journal_entries je
      ON  je.id = jl."journalEntryId"
      AND je."organizationId" = ${organizationId}
      AND je."deletedAt" IS NULL
      AND je.status = 'POSTED'
      AND je."entryDate" < ${startDate}
    WHERE a."organizationId" = ${organizationId}
      AND a."deletedAt" IS NULL
      ${filters.accountId ? Prisma.sql`AND a.id = ${filters.accountId}` : Prisma.empty}
    GROUP BY a.id, a.code, a.type, a."openingBalance"
  `;

  const openingByCode = new Map<string, number>();
  for (const r of openingRows) {
    const opening = Number(r.opening);
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    const normalSign = normalBalanceForType(r.account_type) === "DEBIT" ? 1 : -1;
    openingByCode.set(r.account_code, opening * normalSign + (debit - credit));
  }

  const lines = await prisma.$queryRaw<{
    entry_date: Date;
    reference: string | null;
    description: string | null;
    account_code: string;
    account_name: string;
    entry_type: string;
    amount: string;
  }[]>`
    SELECT
      je."entryDate"     AS entry_date,
      je.reference,
      COALESCE(jl.description, je.description) AS description,
      a.code             AS account_code,
      a.name             AS account_name,
      jl.type            AS entry_type,
      jl.amount::text    AS amount
    FROM journal_lines jl
    JOIN journal_entries je
      ON  je.id = jl."journalEntryId"
      AND je."organizationId" = ${organizationId}
      AND je."entryDate" BETWEEN ${startDate} AND ${endDate}
      AND je."deletedAt" IS NULL
      AND je.status = 'POSTED'
    JOIN accounts a ON a.id = jl."accountId"
    WHERE a."organizationId" = ${organizationId}
      ${filters.accountId ? Prisma.sql`AND a.id = ${filters.accountId}` : Prisma.empty}
    ORDER BY a.code, je."entryDate", je.id
  `;

  const rows: GeneralLedgerRow[] = [];
  let runningBalance = 0;
  let lastAccount = "";

  const startStr = new Date(startDate).toISOString().split("T")[0];

  for (const l of lines) {
    if (l.account_code !== lastAccount) {
      lastAccount = l.account_code;
      runningBalance = openingByCode.get(l.account_code) ?? 0;
      // Per-account opening balance row for context.
      rows.push({
        entryDate: startStr,
        reference: "",
        description: "Opening Balance",
        accountCode: l.account_code,
        accountName: l.account_name,
        debit: 0,
        credit: 0,
        runningBalance: Math.round(runningBalance * 100) / 100,
      });
    }
    const amount = Number(l.amount);
    const debit = l.entry_type === "DEBIT" ? amount : 0;
    const credit = l.entry_type === "CREDIT" ? amount : 0;
    runningBalance += debit - credit;

    rows.push({
      entryDate: new Date(l.entry_date).toISOString().split("T")[0],
      reference: l.reference ?? "",
      description: l.description ?? "",
      accountCode: l.account_code,
      accountName: l.account_name,
      debit,
      credit,
      runningBalance: Math.round(runningBalance * 100) / 100,
    });
  }

  const totalDebits = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredits = rows.reduce((s, r) => s + r.credit, 0);

  return {
    slug: "general-ledger",
    name: "General Ledger",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalEntries: lines.length,
      totalDebits,
      totalCredits,
    },
    columns: [
      { key: "entryDate", label: "Date", type: "date", sortable: true },
      { key: "reference", label: "Reference", type: "text" },
      { key: "accountCode", label: "Account Code", type: "text", sortable: true },
      { key: "accountName", label: "Account", type: "text", sortable: true },
      { key: "description", label: "Description", type: "text" },
      { key: "debit", label: "Debit", type: "currency", align: "right" },
      { key: "credit", label: "Credit", type: "currency", align: "right" },
      { key: "runningBalance", label: "Balance", type: "currency", align: "right" },
    ],
    rows,
    totals: { totalDebits, totalCredits },
  };
}
