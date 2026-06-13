// ============================================================
// FinRP — Bank Consent Detail / Revoke
// GET    /api/banking/consents/[id] — consent detail + sync runs
// DELETE /api/banking/consents/[id] — revoke at provider + DB
// Revoke is an owner action: CAs need an explicit MANAGE_CONSENTS
// grant (see lib/banking/consent-guard.ts).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { revokeConsent } from "@/lib/banking/consent-service";
import { requireConsentManagementAccess } from "@/lib/banking/consent-guard";
import { BankingProviderError } from "@/lib/banking/providers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id } = await params;

  try {
    const consent = await prisma.bankConsent.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        bankAccount: {
          select: { id: true, accountName: true, bankName: true, maskedNumber: true },
        },
        syncHistory: {
          orderBy: { startedAt: "desc" },
          take: 20,
          select: {
            id: true,
            trigger: true,
            syncType: true,
            status: true,
            txnsSaved: true,
            txnsDuplicate: true,
            balancesSaved: true,
            error: true,
            startedAt: true,
            completedAt: true,
            durationMs: true,
          },
        },
      },
    });

    if (!consent) return NextResponse.json({ error: "Consent not found" }, { status: 404 });
    return NextResponse.json({ consent });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "get-consent" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireConsentManagementAccess();
  if (!access.ok) return access.response;

  const { id } = await params;

  try {
    await revokeConsent({
      consentDbId: id,
      organizationId: access.organizationId,
      userId: access.userId ?? undefined,
    });
    return NextResponse.json({ revoked: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Consent not found") {
      return NextResponse.json({ error: "Consent not found" }, { status: 404 });
    }
    if (err instanceof BankingProviderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    Sentry.captureException(err, { tags: { area: "banking", action: "revoke-consent" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
