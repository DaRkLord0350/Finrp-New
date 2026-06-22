// ============================================================
// lib/tax/http.ts
//
// Shared error → HTTP mapper for tax API routes that use
// requireTenant() directly (dynamic [id] routes that need params).
// ============================================================

import { NextResponse } from "next/server";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/require-tenant";
import { FeatureLockedError, PlanLimitError } from "@/lib/billing/guards";
import { FilingStateError } from "@/lib/tax/filing/service";
import { FilingProviderError } from "@/lib/tax/filing/provider";

export function mapTaxError(err: unknown, ctx = "TAX"): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  if (err instanceof FilingStateError) return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof FilingProviderError) {
    return NextResponse.json({ error: err.message, code: err.code, retryable: err.retryable }, { status: 502 });
  }
  if (err instanceof FeatureLockedError) {
    return NextResponse.json({ error: err.message, feature: err.feature, upgradeRequired: true }, { status: 402 });
  }
  if (err instanceof PlanLimitError) {
    return NextResponse.json({ error: err.message, upgradeRequired: true }, { status: 402 });
  }
  console.error(`[${ctx}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
