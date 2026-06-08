// ============================================================
// Trial Balance — All accounts with debit/credit totals
// Uses Account + JournalEntry + JournalLine (all existing models)
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface TrialBalanceRow {
  accountCode:  string;
  accountName:  string;
  accountType:  string;
  totalDebits:  number;
  totalCredits: number;
  balance:      number;
  balanceType:  "DR" | "CR";
}

export async function generateTrialBalance(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<TrialBalanceRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const rows = await prisma.$queryRaw<{
    account_id:    string;
    account_code:  string;
    account_name:  string;
    account_type:  string;
    total_debits:  string;
    total_credits: string;
    account_balance: string;
  }[]>`
    SELECT
      a.id                                                         AS account_id,
      a.code                                                       AS account_code,
      a.name                                                       AS account_name,
      a.type                                                       AS account_type,
      COALESCE(SUM(CASE WHEN jl.type = 'DEBIT'  THEN jl.amount ELSE 0 END), 0)::text AS total_debits,
      COALESCE(SUM(CASE WHEN jl.type = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credits,
      a.balance::text                                              AS account_balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl."accountId" = a.id
    LEFT JOIN journal_entries je
      ON  je.id              = jl."journalEntryId"
      AND je."organizationId" = ${organizationId}
      AND je."entryDate"     BETWEEN ${startDate} AND ${endDate}
      AND je."deletedAt"     IS NULL
    WHERE a."organizationId" = ${organizationId}
      AND a."isActive"       = true
      AND a."deletedAt"      IS NULL
      ${filters.accountId ? Prisma.sql`AND a.id = ${filters.accountId}` : Prisma.empty}
    GROUP BY a.id, a.code, a.name, a.type, a.balance
    ORDER BY a.code
  `;

  const mapped: TrialBalanceRow[] = rows.map((r) => {
    const debits  = Number(r.total_debits);
    const credits = Number(r.total_credits);
    const balance = debits - credits;
    return {
      accountCode:  r.account_code,
      accountName:  r.account_name,
      accountType:  r.account_type,
      totalDebits:  debits,
      totalCredits: credits,
      balance:      Math.abs(balance),
      balanceType:  balance >= 0 ? "DR" : "CR",
    };
  });

  const totalDebits  = mapped.reduce((s, r) => s + r.totalDebits, 0);
  const totalCredits = mapped.reduce((s, r) => s + r.totalCredits, 0);
  const difference   = Math.abs(totalDebits - totalCredits);
  const balanced     = difference < 0.01;

  return {
    slug:        "trial-balance",
    name:        "Trial Balance",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalAccounts:  mapped.length,
      totalDebits,
      totalCredits,
      difference,
      balanced: balanced ? 1 : 0,
    },
    columns: [
      { key: "accountCode",  label: "Code",       type: "text",    sortable: true },
      { key: "accountName",  label: "Account",    type: "text",    sortable: true },
      { key: "accountType",  label: "Type",       type: "badge" },
      { key: "totalDebits",  label: "Debits",     type: "currency",align: "right", sortable: true },
      { key: "totalCredits", label: "Credits",    type: "currency",align: "right", sortable: true },
      { key: "balance",      label: "Balance",    type: "currency",align: "right", sortable: true },
      { key: "balanceType",  label: "DR/CR",      type: "badge" },
    ],
    rows: mapped,
    totals: { totalDebits, totalCredits, difference },
  };
}
