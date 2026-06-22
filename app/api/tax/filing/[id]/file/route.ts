// ============================================================
// /api/tax/filing/[id]/file
// POST — push an APPROVED filing to the GSP/government provider.
// Requires tax.file. Only APPROVED submissions can be filed.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { submitToProvider } from "@/lib/tax/filing/service";
import { mapTaxError } from "@/lib/tax/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "tax.file" });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const submission = await submitToProvider({
      submissionId: id,
      organizationId,
      signature: typeof body?.signature === "string" ? body.signature : undefined,
      signatureType: body?.signatureType === "DSC" ? "DSC" : "EVC",
      actor: { userId, role },
    });
    return NextResponse.json({ submission });
  } catch (err) {
    return mapTaxError(err, "FILING_FILE");
  }
}
