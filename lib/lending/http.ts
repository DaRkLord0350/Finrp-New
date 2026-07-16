// ============================================================
// lib/lending/http.ts
// Central error -> HTTP response mapping for the Lending module.
// Mirrors lib/tbx/http.ts's mapTbxError() convention: every lending
// route calls mapLendingError(err, tag) in its catch, INSIDE the
// handler passed to withTenant (which only knows how to map its own
// auth/billing/KYC error types, not domain errors).
// ============================================================

import { NextResponse } from "next/server";
import { LoanWorkflowError, LoanNotFoundError } from "./workflow/service";
import { LoanPaymentProviderError, LoanPaymentNotConfiguredError } from "./payments/types";

export function mapLendingError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;

  if (err instanceof LoanNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof LoanWorkflowError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof LoanPaymentNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof LoanPaymentProviderError) {
    return NextResponse.json(
      { error: err.message, code: err.code, retryable: err.retryable },
      { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  if (err instanceof Error) {
    // Plain validation Errors thrown by service functions (e.g. amount-range
    // checks in lib/lending/products.ts) are user-facing messages, not
    // server faults — surface as 400 rather than a generic 500.
    console.warn(`[${tag}]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
