// ============================================================
// FinRP — Connect Bank via Setu AA
// POST /api/banking/setu/connect
// Creates a Setu consent and returns the hosted approval URL.
// Owner action: CAs in a client workspace need MANAGE_CONSENTS.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { initiateConsent } from "@/lib/banking/consent-service";
import { requireConsentManagementAccess } from "@/lib/banking/consent-guard";
import { setuConsentSchema } from "@/lib/banking/validations";
import { SetuConfigError } from "@/lib/banking/setu/config";
import { BankingProviderError } from "@/lib/banking/providers";

export async function POST(req: NextRequest) {
  const access = await requireConsentManagementAccess();
  if (!access.ok) return access.response;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = setuConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const result = await initiateConsent({
      organizationId: access.organizationId,
      createdById: access.userId ?? undefined,
      bankAccountId: parsed.data.bankAccountId,
      vua: parsed.data.vua ?? parsed.data.phoneNumber,
      dataRange: parsed.data.dateRange
        ? { from: new Date(parsed.data.dateRange.from), to: new Date(parsed.data.dateRange.to) }
        : undefined,
      redirectUrl: parsed.data.redirectUrl,
    });

    return NextResponse.json(
      {
        consentDbId: result.consentDbId,
        consentId: result.consentId,
        redirectUrl: result.redirectUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof SetuConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof BankingProviderError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status === 429 ? 429 : 502 }
      );
    }
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-connect" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
