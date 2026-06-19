"use client";

import { AccountingReportView } from "@/components/accounting/AccountingReportView";

export default function TrialBalancePage() {
  return (
    <AccountingReportView
      slug="trial-balance"
      title="Trial Balance"
      description="Ending debit and credit balances for every account as of the period end."
      mode="asof"
    />
  );
}
