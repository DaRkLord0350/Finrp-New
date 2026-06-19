// ============================================================
// Trial Balance — classic as-of report
// Each account's ending balance (opening + POSTED movement up to the
// period end) is shown in its Debit or Credit column. A balanced set of
// books has Σ debit balances == Σ credit balances.
// Uses Account + JournalEntry + JournalLine (all existing models).
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma, type AccountType } from "@prisma/client";
import { resolveDateRange } from "./filters";
import { normalBalanceForType } from "@/lib/services/accounting.service";
import type { ReportFilters, ReportResult } from "./types";

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export async function generateTrialBalance(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<TrialBalanceRow>> {
  const { endDate } = resolveDateRange(filters);

  const rows = await prisma.$queryRaw<{
    account_code: string;
    account_name: string;
    account_type: AccountType;
    opening: string;
    debit: string;
    credit: string;
  }[]>`
    SELECT
      a.code AS account_code,
      a.name AS account_name,
      a.type AS account_type,
      a."openingBalance"::text AS opening,
      COALESCE(SUM(CASE WHEN jl.type = 'DEBIT'  THEN jl.amount ELSE 0 END), 0)::text AS debit,
      COALESCE(SUM(CASE WHEN jl.type = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl."accountId" = a.id
    LEFT JOIN journal_entries je
      ON  je.id              = jl."journalEntryId"
      AND je."organizationId" = ${organizationId}
      AND je."deletedAt"     IS NULL
      AND je.status          = 'POSTED'
      AND je."entryDate"     <= ${endDate}
    WHERE a."organizationId" = ${organizationId}
      AND a."isActive"       = true
      AND a."deletedAt"      IS NULL
      ${filters.accountId ? Prisma.sql`AND a.id = ${filters.accountId}` : Prisma.empty}
    GROUP BY a.id, a.code, a.name, a.type, a."openingBalance"
    ORDER BY a.code
  `;

  const mapped: TrialBalanceRow[] = [];
  for (const r of rows) {
    const opening = Number(r.opening);
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    const normal = normalBalanceForType(r.account_type);
    const endingNormal = opening + (normal === "DEBIT" ? debit - credit : credit - debit);

    let debitCol = 0;
    let creditCol = 0;
    if (normal === "DEBIT") {
      if (endingNormal >= 0) debitCol = endingNormal;
      else creditCol = -endingNormal;
    } else {
      if (endingNormal >= 0) creditCol = endingNormal;
      else debitCol = -endingNormal;
    }

    if (Math.abs(debitCol) < 0.005 && Math.abs(creditCol) < 0.005) continue;

    mapped.push({
      accountCode: r.account_code,
      accountName: r.account_name,
      accountType: r.account_type,
      debit: Math.round(debitCol * 100) / 100,
      credit: Math.round(creditCol * 100) / 100,
    });
  }

  const totalDebits = mapped.reduce((s, r) => s + r.debit, 0);
  const totalCredits = mapped.reduce((s, r) => s + r.credit, 0);
  const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;
  const balanced = difference < 0.01;

  return {
    slug: "trial-balance",
    name: "Trial Balance",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalAccounts: mapped.length,
      totalDebits,
      totalCredits,
      difference,
      balanced: balanced ? 1 : 0,
    },
    columns: [
      { key: "accountCode", label: "Code", type: "text", sortable: true },
      { key: "accountName", label: "Account", type: "text", sortable: true },
      { key: "accountType", label: "Type", type: "badge" },
      { key: "debit", label: "Debit", type: "currency", align: "right", sortable: true },
      { key: "credit", label: "Credit", type: "currency", align: "right", sortable: true },
    ],
    rows: mapped,
    totals: { debit: totalDebits, credit: totalCredits, difference },
  };
}
