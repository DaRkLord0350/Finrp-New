import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { submitApplication } from "@/lib/lending/applications";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const { profile } = await req.json();
    const application = await submitApplication(id, organizationId, profile ?? {}, { userId, role });
    return NextResponse.json({ application });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATION_SUBMIT");
  }
}
