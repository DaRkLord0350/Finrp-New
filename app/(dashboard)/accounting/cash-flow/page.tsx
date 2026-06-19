"use client";

import { AccountingReportView } from "@/components/accounting/AccountingReportView";

export default function CashFlowPage() {
  return (
    <AccountingReportView
      slug="cash-flow"
      title="Cash Flow Statement"
      description="Operating, investing and financing cash movements for the period."
      mode="range"
    />
  );
}
