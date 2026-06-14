// ============================================================
// FinRP — Bank Sync History API
// GET /api/banking/sync-history?bankAccountId=&status=&limit=
// Paginated sync-run audit trail for the Sync History UI.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import type { Prisma, SyncRunStatus } from "@prisma/client";

const VALID_STATUSES: SyncRunStatus[] = ["QUEUED", "RUNNING", "SUCCESS", "PARTIAL", "FAILED"];

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get("bankAccountId") ?? undefined;
    const statusParam = searchParams.get("status")?.toUpperCase();
    const status = VALID_STATUSES.includes(statusParam as SyncRunStatus)
      ? (statusParam as SyncRunStatus)
      : undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const cursor = searchParams.get("cursor") ?? undefined;

    const where: Prisma.BankSyncHistoryWhereInput = {
      organizationId: orgId,
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(status ? { status } : {}),
    };

    const runs = await prisma.bankSyncHistory.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        bankAccountId: true,
        provider: true,
        trigger: true,
        syncType: true,
        status: true,
        txnsFetched: true,
        txnsSaved: true,
        txnsDuplicate: true,
        balancesSaved: true,
        attempt: true,
        error: true,
        errorCode: true,
        fromDate: true,
        toDate: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        bankAccount: { select: { accountName: true, bankName: true, maskedNumber: true } },
      },
    });

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, limit) : runs;

    return NextResponse.json({
      runs: items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "sync-history" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
