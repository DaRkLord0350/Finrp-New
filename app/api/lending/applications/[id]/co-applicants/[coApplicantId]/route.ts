import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { removeCoApplicant } from "@/lib/lending/applications";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; coApplicantId: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.write" });
    const { id, coApplicantId } = await params;
    await removeCoApplicant(coApplicantId, id, organizationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapLendingError(err, "LENDING_CO_APPLICANT_DELETE");
  }
}
