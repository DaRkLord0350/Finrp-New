// ============================================================
// FinRP — Bank Sync Trigger / Status
// POST /api/banking/sync { bankAccountId, force? } — enqueue sync
// GET  /api/banking/sync — per-account sync status summary
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
    const body = await req.json();
    const { bankAccountId, force } = body;

    if (!bankAccountId) {
      return NextResponse.json({ error: "bankAccountId required" }, { status: 400 });
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: orgId, deletedAt: null },
      include: {
        connection: { select: { provider: true, id: true } },
        consents: { where: { status: "ACTIVE", deletedAt: null }, take: 1, select: { id: true } },
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

    const activeConsent = account.consents[0];
    const provider = account.connection?.provider ?? (activeConsent ? "SETU_AA" : null);

    if (!provider) {
      return NextResponse.json(
        { error: "No connection or consent configured for this account" },
        { status: 422 }
      );
    }

    const jobId = await enqueueBankSync(
      {
        organizationId: orgId,
        bankAccountId,
        consentDbId: activeConsent?.id,
        connectionId: account.connection?.id,
        provider,
        trigger: "MANUAL",
        syncType: "INCREMENTAL",
      },
      force ? { dedupeKey: `${bankAccountId}:force:${Date.now()}` } : undefined
    );

    return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "trigger-sync" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
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
