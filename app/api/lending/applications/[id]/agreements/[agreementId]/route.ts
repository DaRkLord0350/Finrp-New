import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { getAgreement, sendForSignature, syncSignatoryStatuses } from "@/lib/lending/agreements";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; agreementId: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { agreementId } = await params;
    const agreement = await getAgreement(agreementId, organizationId);
    return NextResponse.json({ agreement });
  } catch (err) {
    return mapLendingError(err, "LENDING_AGREEMENT_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; agreementId: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.sanction" });
    const { agreementId } = await params;
    const { action } = await req.json();

    const agreement =
      action === "send"
        ? await sendForSignature(agreementId, organizationId, { userId })
        : action === "sync"
          ? await syncSignatoryStatuses(agreementId, organizationId, { userId, role })
          : null;
    if (!agreement) return NextResponse.json({ error: "action must be 'send' or 'sync'" }, { status: 400 });
    return NextResponse.json({ agreement });
  } catch (err) {
    return mapLendingError(err, "LENDING_AGREEMENT_PATCH");
  }
}
