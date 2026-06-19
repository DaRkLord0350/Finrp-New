"use client";

import { AccountingReportView } from "@/components/accounting/AccountingReportView";

export default function GeneralLedgerPage() {
  return (
    <AccountingReportView
      slug="general-ledger"
      title="General Ledger"
      description="Every posted journal line by account, with opening and running balances."
      mode="range"
      supportsAccount
    />
  );
}
