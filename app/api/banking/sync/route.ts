import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { BANK_SYNC_QUEUE } from "@/lib/banking/workers/bank-sync.worker";
import type { BankSyncJobData } from "@/lib/banking/types";

let syncQueue: Queue<BankSyncJobData> | null = null;

function getBankSyncQueue(): Queue<BankSyncJobData> {
  if (!syncQueue) {
    syncQueue = new Queue<BankSyncJobData>(BANK_SYNC_QUEUE, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return syncQueue;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const { bankAccountId, force } = body;

    if (!bankAccountId) {
      return NextResponse.json({ error: "bankAccountId required" }, { status: 400 });
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: orgId },
      include: {
        connection: { select: { provider: true, id: true } },
        consents: { where: { status: "ACTIVE" }, take: 1 },
      },
    });

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Rate limit: don't re-sync within 5 minutes unless forced
    if (!force && account.lastSyncAt) {
      const minsSinceSync = (Date.now() - account.lastSyncAt.getTime()) / 60_000;
      if (minsSinceSync < 5) {
        return NextResponse.json({
          message: "Synced recently",
          lastSyncAt: account.lastSyncAt,
          nextAvailableAt: new Date(account.lastSyncAt.getTime() + 5 * 60_000),
        });
      }
    }

    const provider = account.connection?.provider ?? (account.consents.length > 0 ? "SETU_AA" : null);

    if (!provider) {
      return NextResponse.json({ error: "No connection or consent configured for this account" }, { status: 422 });
    }

    const jobId = `bank-sync-${bankAccountId}-${Date.now()}`;
    const q = getBankSyncQueue();

    await q.add("bank-sync", {
      bankSyncJobId: jobId,
      organizationId: orgId,
      bankAccountId,
      connectionId: account.connection?.id,
      provider,
      isIncremental: true,
    }, { jobId });

    return NextResponse.json({ jobId, status: "queued" });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "trigger-sync" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const accounts = await prisma.bankAccount.findMany({
    where: { organizationId: orgId, isActive: true, deletedAt: null },
    select: {
      id: true,
      accountName: true,
      bankName: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncError: true,
      nextSyncAt: true,
      autoSyncEnabled: true,
    },
  });

  return NextResponse.json({ accounts });
}
