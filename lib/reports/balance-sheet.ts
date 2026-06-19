// ============================================================
// Balance Sheet — as-of financial position from the ledger.
// Assets = Liabilities + Equity (incl. current-period net income).
// Each account's ending balance = opening + POSTED movement up to the date.
// ============================================================

import { prisma } from "@/lib/prisma";
import { type AccountType } from "@prisma/client";
import { resolveDateRange } from "./filters";
import { normalBalanceForType } from "@/lib/services/accounting.service";
import type { ReportFilters, ReportResult } from "./types";

interface BalanceSheetRow {
  section: string;
  label: string;
  amount: number;
}

const ASSET_TYPES: AccountType[] = ["ASSET", "BANK", "CASH", "STOCK"];
const LIABILITY_TYPES: AccountType[] = ["LIABILITY", "TAX"];

export async function generateBalanceSheet(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<BalanceSheetRow>> {
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
      ON  je.id = jl."journalEntryId"
      AND je."organizationId" = ${organizationId}
      AND je."deletedAt" IS NULL
      AND je.status = 'POSTED'
      AND je."entryDate" <= ${endDate}
    WHERE a."organizationId" = ${organizationId}
      AND a."deletedAt" IS NULL
    GROUP BY a.id, a.code, a.name, a.type, a."openingBalance"
    ORDER BY a.code
  `;

  const assetRows: BalanceSheetRow[] = [];
  const liabilityRows: BalanceSheetRow[] = [];
  const equityRows: BalanceSheetRow[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquityAccounts = 0;
  let income = 0;
  let expense = 0;

  for (const r of rows) {
    const opening = Number(r.opening);
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    const normal = normalBalanceForType(r.account_type);
    const ending = opening + (normal === "DEBIT" ? debit - credit : credit - debit);
    const rounded = Math.round(ending * 100) / 100;

    if (ASSET_TYPES.includes(r.account_type)) {
      if (Math.abs(rounded) >= 0.005) assetRows.push({ section: "Assets", label: `${r.account_code} — ${r.account_name}`, amount: rounded });
      totalAssets += ending;
    } else if (LIABILITY_TYPES.includes(r.account_type)) {
      if (Math.abs(rounded) >= 0.005) liabilityRows.push({ section: "Liabilities", label: `${r.account_code} — ${r.account_name}`, amount: rounded });
      totalLiabilities += ending;
    } else if (r.account_type === "EQUITY") {
      if (Math.abs(rounded) >= 0.005) equityRows.push({ section: "Equity", label: `${r.account_code} — ${r.account_name}`, amount: rounded });
      totalEquityAccounts += ending;
    } else if (r.account_type === "INCOME") {
      income += ending;
    } else {
      // EXPENSE + COGS
      expense += ending;
    }
  }

  const netIncome = Math.round((income - expense) * 100) / 100;
  // Current-period earnings live in P&L accounts until year-end close — surface
  // them as an equity line so the statement balances before closing entries.
  equityRows.push({ section: "Equity", label: "Net Income (Current Period)", amount: netIncome });

  const totalEquity = Math.round((totalEquityAccounts + netIncome) * 100) / 100;
  const totalAssetsR = Math.round(totalAssets * 100) / 100;
  const totalLiabilitiesR = Math.round(totalLiabilities * 100) / 100;
  const difference = Math.round((totalAssetsR - (totalLiabilitiesR + totalEquity)) * 100) / 100;

  return {
    slug: "balance-sheet",
    name: "Balance Sheet",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalAssets: totalAssetsR,
      totalLiabilities: totalLiabilitiesR,
      totalEquity,
      netIncome,
      difference,
      balanced: Math.abs(difference) < 0.01 ? 1 : 0,
    },
    columns: [
      { key: "section", label: "Section", type: "badge" },
      { key: "label", label: "Account", type: "text" },
      { key: "amount", label: "Amount", type: "currency", align: "right" },
    ],
    rows: [...assetRows, ...liabilityRows, ...equityRows],
    totals: {
      totalAssets: totalAssetsR,
      totalLiabilities: totalLiabilitiesR,
      totalEquity,
      difference,
    },
    charts: [
      {
        type: "bar",
        title: "Assets vs Liabilities + Equity",
        data: [
          { name: "Assets", value: totalAssetsR },
          { name: "Liabilities", value: totalLiabilitiesR },
          { name: "Equity", value: totalEquity },
        ],
        xKey: "name",
        yKeys: ["value"],
      },
    ],
  };
}
