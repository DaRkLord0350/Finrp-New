// ============================================================
// FinRP — Manual Setu Data Refresh
// POST /api/banking/setu/refresh { bankAccountId?, fromDate?, toDate? }
// Enqueues an incremental sync for the account (or the whole
// org's newest active consent). Any MANAGE_BANKING user may
// refresh — it's a read of bank data, not a consent mutation.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { enqueueBankSync } from "@/lib/banking/queue";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const { bankAccountId, fromDate, toDate } = body as Record<string, string | undefined>;

    if (bankAccountId) {
      const account = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const consent = await prisma.bankConsent.findFirst({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        deletedAt: null,
        ...(bankAccountId ? { OR: [{ bankAccountId }, { bankAccountId: null }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!consent) {
      return NextResponse.json({ error: "No active consent for this account" }, { status: 404 });
    }

    const jobId = await enqueueBankSync({
      organizationId: orgId,
      bankAccountId,
      consentDbId: consent.id,
      provider: "SETU_AA",
      trigger: "MANUAL",
      syncType: "INCREMENTAL",
      fromDate,
      toDate,
    });

    return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-refresh" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
