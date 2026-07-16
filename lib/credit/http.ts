// ============================================================
// lib/credit/http.ts
// Central error -> HTTP response mapping for the Credit Bureau
// module. Mirrors lib/lending/http.ts / lib/tbx/http.ts.
// ============================================================

import { NextResponse } from "next/server";
import { LoanNotFoundError } from "@/lib/lending/workflow/service";
import { CreditProviderError, CreditNotConfiguredError } from "./types";
import { CreditConfigError } from "./config";

export function mapCreditError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;

  if (err instanceof LoanNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof CreditConfigError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof CreditNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof CreditProviderError) {
    return NextResponse.json(
      { error: err.message, code: err.code, retryable: err.retryable },
      { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  if (err instanceof Error) {
    console.warn(`[${tag}]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
