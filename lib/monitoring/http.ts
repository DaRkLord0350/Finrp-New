import { NextResponse } from "next/server";
import { LoanNotFoundError, LoanWorkflowError } from "@/lib/lending/workflow/service";

export function mapMonitoringError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;

  if (err instanceof LoanNotFoundError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof LoanWorkflowError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Error) {
    console.warn(`[${tag}]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
