// ============================================================
// General Ledger — All journal entries by account
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface GeneralLedgerRow {
  entryDate:      string;
  reference:      string;
  description:    string;
  accountCode:    string;
  accountName:    string;
  debit:          number;
  credit:         number;
  runningBalance: number;
}

export async function generateGeneralLedger(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<GeneralLedgerRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const lines = await prisma.$queryRaw<{
    entry_date:   Date;
    reference:    string | null;
    description:  string | null;
    account_code: string;
    account_name: string;
    entry_type:   string;
    amount:       string;
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
      ON  je.id              = jl."journalEntryId"
      AND je."organizationId" = ${organizationId}
      AND je."entryDate"     BETWEEN ${startDate} AND ${endDate}
      AND je."deletedAt"     IS NULL
    JOIN accounts a ON a.id = jl."accountId"
    WHERE a."organizationId" = ${organizationId}
      ${filters.accountId ? Prisma.sql`AND a.id = ${filters.accountId}` : Prisma.empty}
    ORDER BY a.code, je."entryDate", je.id
  `;

  // Compute running balance per account
  let runningBalance = 0;
  let lastAccount    = "";

  const rows: GeneralLedgerRow[] = lines.map((l) => {
    const accountKey = l.account_code;
    if (accountKey !== lastAccount) {
      runningBalance = 0;
      lastAccount    = accountKey;
    }
    const amount = Number(l.amount);
    const debit  = l.entry_type === "DEBIT"  ? amount : 0;
    const credit = l.entry_type === "CREDIT" ? amount : 0;
    runningBalance += debit - credit;

    return {
      entryDate:      new Date(l.entry_date).toISOString().split("T")[0],
      reference:      l.reference ?? "",
      description:    l.description ?? "",
      accountCode:    l.account_code,
      accountName:    l.account_name,
      debit,
      credit,
      runningBalance,
    };
  });

  const totalDebits  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredits = rows.reduce((s, r) => s + r.credit, 0);

  return {
    slug:        "general-ledger",
    name:        "General Ledger",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalEntries: rows.length,
      totalDebits,
      totalCredits,
    },
    columns: [
      { key: "entryDate",     label: "Date",         type: "date",    sortable: true },
      { key: "reference",     label: "Reference",    type: "text" },
      { key: "accountCode",   label: "Account Code", type: "text",    sortable: true },
      { key: "accountName",   label: "Account",      type: "text",    sortable: true },
      { key: "description",   label: "Description",  type: "text" },
      { key: "debit",         label: "Debit",        type: "currency",align: "right" },
      { key: "credit",        label: "Credit",       type: "currency",align: "right" },
      { key: "runningBalance",label: "Balance",      type: "currency",align: "right" },
    ],
    rows,
    totals: { totalDebits, totalCredits },
  };
}
