import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { manualMatch, unmatch, completeSession } from "@/lib/banking/reconciliation-engine";
import { manualMatchSchema } from "@/lib/banking/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id: sessionId } = await params;

  const session = await prisma.bankReconciliationSession.findFirst({
    where: { id: sessionId, organizationId: orgId },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const matchStatus = searchParams.get("status");

  const matches = await prisma.reconciliationMatch.findMany({
    where: {
      sessionId,
      ...(matchStatus ? { status: matchStatus as never } : {}),
    },
    include: {
      bankTransaction: {
        select: {
          transactionDate: true, narration: true, credit: true, debit: true, referenceNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ matches, session });
}

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
    const body = await req.json();

    // Special action: complete session
    if (body.action === "complete") {
      await completeSession(sessionId, orgId);
      return NextResponse.json({ success: true });
    }

    // Special action: unmatch
    if (body.action === "unmatch" && body.bankTransactionId) {
      await unmatch(sessionId, orgId, body.bankTransactionId);
      return NextResponse.json({ success: true });
    }

    // Manual match
    const parsed = manualMatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const matchId = await manualMatch(
      sessionId,
      orgId,
      parsed.data.bankTransactionId,
      parsed.data.entityType,
      parsed.data.entityId,
      parsed.data.entityRef,
      parsed.data.notes
    );

    return NextResponse.json({ matchId }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "manual-match" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
