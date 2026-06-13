// ============================================================
// FinRP — Setu Consent Callback
// GET /api/banking/setu/callback?id={consentId}&status=...
// Setu redirects the customer here after approve/reject on the
// hosted consent page. Refreshes the consent from the provider
// (never trusts query params for status) and kicks off the
// initial data sync on approval. The webhook does the same work
// idempotently — whichever lands first wins.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { refreshConsentStatus } from "@/lib/banking/consent-service";
import { enqueueBankSync } from "@/lib/banking/queue";
import { createBankingLogger } from "@/lib/banking/logger";

const log = createBankingLogger("setu.callback");

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(req.url);
  const consentId =
    searchParams.get("id") ?? searchParams.get("consentId") ?? searchParams.get("handle");

  if (!consentId) {
    return NextResponse.redirect(`${appUrl}/banking/consent?error=missing_consent_id`);
  }

  try {
    const consent = await refreshConsentStatus(consentId);

    if (!consent) {
      log.warn("callback for unknown consent", { consentId });
      return NextResponse.redirect(`${appUrl}/banking/consent?error=unknown_consent`);
    }

    if (consent.status === "ACTIVE") {
      await enqueueBankSync({
        organizationId: consent.organizationId,
        consentDbId: consent.id,
        bankAccountId: consent.bankAccountId ?? undefined,
        provider: "SETU_AA",
        trigger: "INITIAL",
        syncType: "FULL",
      }).catch((err) => {
        // Sync will be retried by webhook/scheduler — don't fail the redirect.
        log.error("initial sync enqueue failed", { consentId, error: String(err) });
      });
      return NextResponse.redirect(`${appUrl}/banking/consent?status=connected`);
    }

    const status = consent.status === "REJECTED" ? "rejected" : consent.status.toLowerCase();
    return NextResponse.redirect(`${appUrl}/banking/consent?status=${status}`);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-callback" } });
    log.error("callback failed", { consentId, error: String(err) });
    return NextResponse.redirect(`${appUrl}/banking/consent?error=sync_failed`);
  }
}
