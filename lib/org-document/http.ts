// ============================================================
// lib/org-document/http.ts
// Central error → HTTP response mapping for Module 3 (Document Vault).
// ============================================================

import { NextResponse } from "next/server";

export class OrgDocumentError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgDocumentError";
    this.status = status;
  }
}

export function mapOrgDocumentError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;
  if (err instanceof OrgDocumentError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
