import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { addCoApplicant } from "@/lib/lending/applications";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const body = await req.json();
    const coApplicant = await addCoApplicant(id, organizationId, body);
    return NextResponse.json({ coApplicant }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_CO_APPLICANT_POST");
  }
}
