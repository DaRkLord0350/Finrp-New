// ============================================================
// FinRP — Bank Sync
// GET  /api/banking/sync — per-account sync status summary
// POST /api/banking/sync { bankAccountId, force? } — trigger a TBX
//   balance sync AND a statement sync together (the same "sync this
//   account" semantic the pre-TBX flow had, now fanning out to two
//   independent Inngest jobs instead of one combined Setu call).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { triggerBalanceSync, BalanceSyncError } from "@/lib/tbx/balance/balance.routes";
import { triggerStatementSync, StatementSyncError } from "@/lib/tbx/statements/statement.routes";

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

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const { bankAccountId, force } = body;
    if (!bankAccountId) return NextResponse.json({ error: "bankAccountId required" }, { status: 400 });

    const forced = Boolean(force);
    const [balance, statement] = await Promise.all([
      triggerBalanceSync(orgId, bankAccountId, forced),
      triggerStatementSync(orgId, bankAccountId, forced),
    ]);

    return NextResponse.json({ balance, statement, status: "queued" }, { status: 202 });
  } catch (err) {
    if (err instanceof BalanceSyncError || err instanceof StatementSyncError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[banking/sync]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
