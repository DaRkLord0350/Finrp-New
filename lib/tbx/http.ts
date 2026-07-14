// ============================================================
// lib/tbx/http.ts
// Central error → HTTP response mapping for the TBX module,
// mirrors lib/accounting/http.ts's mapAccountingError() convention:
// every TBX-module route calls mapTbxError(err, tag) in its catch.
// ============================================================

import { NextResponse } from "next/server";
import { TbxProviderError, TbxNotConfiguredError } from "./types";

export class TbxServiceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TbxServiceError";
    this.status = status;
  }
}

export function mapTbxError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;

  if (err instanceof TbxNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof TbxProviderError) {
    return NextResponse.json(
      { error: err.message, code: err.code, retryable: err.retryable },
      { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  if (err instanceof TbxServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
