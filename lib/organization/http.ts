// ============================================================
// lib/organization/http.ts
// Central error → HTTP response mapping for Module 1 (Organization
// Master, Branches, Departments), mirrors lib/accounting/http.ts's
// mapAccountingError() convention.
// ============================================================

import { NextResponse } from "next/server";

export class OrganizationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrganizationError";
    this.status = status;
  }
}

export function mapOrganizationError(err: unknown, tag: string): NextResponse {
  if (err instanceof NextResponse) return err;
  if (err instanceof OrganizationError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  const prismaErr = err as { code?: string };
  if (prismaErr?.code === "P2025") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (prismaErr?.code === "P2002") {
    return NextResponse.json({ error: "A record with this value already exists" }, { status: 409 });
  }

  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
