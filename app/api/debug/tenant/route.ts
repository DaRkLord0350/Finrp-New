// ============================================================
// GET /api/debug/tenant — DEV ONLY
// Returns the Clerk userId / orgId so you can confirm the
// tenant ID used by all API routes.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { userId, orgId } = await auth();
  const tenantId = orgId ?? userId;

  return NextResponse.json({
    userId,
    orgId,
    tenantId,
    hint: "Use this 'tenantId' as the SEED_ORG_ID when re-seeding the database.",
    reseedCommand: `$env:SEED_ORG_ID="${tenantId}"; npx tsx prisma/seed.ts`,
  });
}
