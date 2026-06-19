"use client";

import { AccountingReportView } from "@/components/accounting/AccountingReportView";

export default function BalanceSheetPage() {
  return (
    <AccountingReportView
      slug="balance-sheet"
      title="Balance Sheet"
      description="Assets, liabilities and equity as of a date — including current-period net income."
      mode="asof"
    />
  );
}
