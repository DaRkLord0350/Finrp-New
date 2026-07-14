import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { validateReport } from "@/lib/financial-statements/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { id } = await params;
    const result = await validateReport(id, organizationId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[financial-statements/reports/:id/validate GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
