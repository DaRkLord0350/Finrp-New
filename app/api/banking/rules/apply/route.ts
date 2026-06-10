import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { bulkCategorize } from "@/lib/banking/categorization-engine";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const transactionIds = body.transactionIds as string[] | undefined;

    const result = await bulkCategorize(orgId, transactionIds);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "apply-rules" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
