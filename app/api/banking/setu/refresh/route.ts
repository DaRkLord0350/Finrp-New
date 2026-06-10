import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { fetchAndStoreTransactions } from "@/lib/banking/integrations/setu-aa";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const { bankAccountId, fromDate, toDate } = body;
    if (!bankAccountId) return NextResponse.json({ error: "bankAccountId required" }, { status: 400 });

    // Verify ownership
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: orgId },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Get active consent
    const consent = await prisma.bankConsent.findFirst({
      where: { organizationId: orgId, bankAccountId, status: "ACTIVE", provider: "SETU" },
      orderBy: { createdAt: "desc" },
    });

    if (!consent?.consentHandle) {
      return NextResponse.json({ error: "No active consent for this account" }, { status: 404 });
    }

    const result = await fetchAndStoreTransactions(
      orgId,
      consent.consentHandle,
      bankAccountId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );

    return NextResponse.json({ ...result, consentHandle: consent.consentHandle });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-refresh" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
