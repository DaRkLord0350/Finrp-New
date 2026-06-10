import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncConsentStatus } from "@/lib/banking/integrations/setu-aa";

// Called by Setu redirect after user approves/rejects consent in AA app
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const consentHandle = searchParams.get("handle") ?? searchParams.get("consentHandle");
  const status = searchParams.get("status");

  if (!consentHandle) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/banking/connections?error=missing_handle`);
  }

  try {
    await syncConsentStatus(consentHandle);

    const consent = await prisma.bankConsent.findUnique({
      where: { consentHandle },
      select: { status: true, bankAccountId: true, organizationId: true },
    });

    if (consent?.status === "ACTIVE" && consent.bankAccountId) {
      // Trigger initial data fetch via queue
      await prisma.bankAccount.update({
        where: { id: consent.bankAccountId },
        data: { consentStatus: "ACTIVE", autoSyncEnabled: true },
      });
    }

    const redirectStatus = consent?.status === "ACTIVE" ? "connected" : "rejected";
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/banking/connections?status=${redirectStatus}`
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-callback" } });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/banking/connections?error=sync_failed`
    );
  }
}
