import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { syncTransactions, syncBalances } from "@/lib/banking/integrations/plaid-client";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const { connectionId } = body;

    // Verify ownership
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, organizationId: orgId },
    });
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const [txnResult] = await Promise.all([
      syncTransactions(connectionId, orgId),
      syncBalances(connectionId, orgId),
    ]);

    return NextResponse.json(txnResult);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "plaid-sync" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
