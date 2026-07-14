// ============================================================
// lib/related-party/http.ts
// Central error → HTTP response mapping for Modules 4+5, mirrors
// lib/accounting/http.ts's mapAccountingError() convention.
// ============================================================

import { NextResponse } from "next/server";

export class RelatedPartyError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RelatedPartyError";
    this.status = status;
  }
}

export function mapRelatedPartyError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;
  if (err instanceof RelatedPartyError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  const prismaErr = err as { code?: string };
  if (prismaErr?.code === "P2025") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
