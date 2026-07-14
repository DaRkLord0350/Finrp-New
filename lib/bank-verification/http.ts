// ============================================================
// lib/bank-verification/http.ts
// Central error → HTTP response mapping for Module 6.
// ============================================================

import { NextResponse } from "next/server";

export class BankVerificationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BankVerificationError";
    this.status = status;
  }
}

export function mapBankVerificationError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;
  if (err instanceof BankVerificationError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
