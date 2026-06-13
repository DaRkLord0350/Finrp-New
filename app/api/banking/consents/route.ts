// ============================================================
// FinRP — Bank Consents API
// GET /api/banking/consents — list all AA consents for the org
// with linked-account info. Read access follows MANAGE_BANKING.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const consents = await prisma.bankConsent.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        consentId: true,
        provider: true,
        status: true,
        startDate: true,
        endDate: true,
        frequency: true,
        fiTypes: true,
        vua: true,
        approvedAt: true,
        revokedAt: true,
        rejectedAt: true,
        lastDataFetchAt: true,
        createdAt: true,
        bankAccount: {
          select: { id: true, accountName: true, bankName: true, maskedNumber: true },
        },
      },
    });

    return NextResponse.json({ consents });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "list-consents" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
