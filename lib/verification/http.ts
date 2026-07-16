import { NextResponse } from "next/server";
import { LoanNotFoundError, LoanWorkflowError } from "@/lib/lending/workflow/service";
import { IfscFormatError, IfscLookupError, IfscNotFoundError } from "./ifsc/types";
import { IdentityDocumentNotConfiguredError, IdentityDocumentProviderError } from "./identity-document/types";

export function mapVerificationError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;

  if (err instanceof LoanNotFoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof LoanWorkflowError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof IfscFormatError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof IfscNotFoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof IfscLookupError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof IdentityDocumentNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
  if (err instanceof IdentityDocumentProviderError) {
    return NextResponse.json({ error: err.message, code: err.code, retryable: err.retryable }, { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 });
  }
  if (err instanceof Error) {
    console.warn(`[${tag}]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
