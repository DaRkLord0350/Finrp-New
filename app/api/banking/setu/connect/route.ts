import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { createConsent } from "@/lib/banking/integrations/setu-aa";
import { setuConsentSchema } from "@/lib/banking/validations";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = setuConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const defaultTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const result = await createConsent(orgId, {
      bankAccountId: parsed.data.bankAccountId,
      redirectUrl: parsed.data.redirectUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/banking/consent/callback`,
      dateRange: parsed.data.dateRange ?? {
        from: defaultFrom.toISOString(),
        to: defaultTo.toISOString(),
      },
      consentTypes: parsed.data.consentTypes ?? ["TRANSACTIONS", "SUMMARY"],
      fiTypes: parsed.data.fiTypes ?? ["DEPOSIT", "RECURRING_DEPOSIT"],
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-connect" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
