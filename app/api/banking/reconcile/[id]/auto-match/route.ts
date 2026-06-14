import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { autoMatch } from "@/lib/banking/reconciliation-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id: sessionId } = await params;

  try {
    const session = await prisma.bankReconciliationSession.findFirst({
      where: { id: sessionId, organizationId: orgId },
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (session.status === "COMPLETED") {
      return NextResponse.json({ error: "Session already completed" }, { status: 409 });
    }

    const result = await autoMatch(sessionId, orgId);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "auto-match" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
