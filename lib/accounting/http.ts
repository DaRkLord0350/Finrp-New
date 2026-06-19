// ============================================================
// Shared HTTP error mapping for accounting API routes.
// Maps domain errors to their intended status codes.
// ============================================================

import { NextResponse } from "next/server";
import { JournalError } from "@/lib/services/journal.service";
import { AccountingError } from "@/lib/services/accounting.service";
import { FiscalYearError } from "@/lib/services/fiscal-year.service";
import { BudgetError } from "@/lib/services/budget.service";
import { CurrencyError } from "@/lib/services/currency.service";
import { BulkUpdateError } from "@/lib/services/bulk-account-update.service";
import { PostingError } from "@/lib/accounting/posting";
import { PeriodLockedError } from "@/lib/accounting/period";

export function mapAccountingError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;
  if (err instanceof PeriodLockedError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof PostingError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof JournalError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof FiscalYearError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof BudgetError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof CurrencyError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof BulkUpdateError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof AccountingError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
