// ============================================================
// Shared HTTP error mapping for accounting API routes.
// Maps domain errors to their intended status codes.
// ============================================================

import { NextResponse } from "next/server";
import { JournalError } from "@/lib/services/journal.service";
import { AccountingError } from "@/lib/services/accounting.service";
import { PeriodLockedError } from "@/lib/accounting/period";

export function mapAccountingError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;
  if (err instanceof PeriodLockedError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof JournalError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof AccountingError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
