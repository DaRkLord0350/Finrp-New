"use client";

import { AccountingReportView } from "@/components/accounting/AccountingReportView";

export default function ProfitLossPage() {
  return (
    <AccountingReportView
      slug="profit-loss"
      title="Profit & Loss"
      description="Income versus expenses for the selected period."
      mode="range"
    />
  );
}
