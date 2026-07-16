import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { getApplicationDetail, updateApplicationTerms } from "@/lib/lending/applications";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const application = await getApplicationDetail(id, organizationId);
    return NextResponse.json({ application });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATION_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const body = await req.json();
    const application = await updateApplicationTerms(id, organizationId, body, { userId, role });
    return NextResponse.json({ application });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATION_PATCH");
  }
}
