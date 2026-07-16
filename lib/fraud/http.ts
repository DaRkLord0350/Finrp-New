import { NextResponse } from "next/server";
import { LoanNotFoundError, LoanWorkflowError } from "@/lib/lending/workflow/service";
import { IpIntelligenceProviderError, IpIntelligenceNotConfiguredError } from "./ip-intelligence/types";
import { BiometricProviderError, BiometricNotConfiguredError } from "./biometric/types";

export function mapFraudError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;

  if (err instanceof LoanNotFoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof LoanWorkflowError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof IpIntelligenceNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
  if (err instanceof BiometricNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
  if (err instanceof IpIntelligenceProviderError || err instanceof BiometricProviderError) {
    return NextResponse.json({ error: err.message, code: err.code, retryable: err.retryable }, { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 });
  }
  if (err instanceof Error) {
    console.warn(`[${tag}]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
