import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { createReconcileSession } from "@/lib/banking/reconciliation-engine";
import { createReconcileSessionSchema } from "@/lib/banking/validations";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const bankAccountId = searchParams.get("bankAccountId");
  const status = searchParams.get("status");

  const sessions = await prisma.bankReconciliationSession.findMany({
    where: {
      organizationId: orgId,
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
      _count: { select: { matches: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = createReconcileSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    // Verify account ownership
    const account = await prisma.bankAccount.findFirst({
      where: { id: parsed.data.bankAccountId, organizationId: orgId },
    });
    if (!account) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

    const sessionId = await createReconcileSession(orgId, parsed.data.bankAccountId, {
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate as string),
      endDate: new Date(parsed.data.endDate as string),
      openingBalance: parsed.data.openingBalance,
      closingBalance: parsed.data.closingBalance,
    });

    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "create-reconcile-session" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
