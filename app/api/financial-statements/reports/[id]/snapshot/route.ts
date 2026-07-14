import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { getOrComputeSnapshot } from "@/lib/financial-statements/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { id } = await params;
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
    const snapshot = await getOrComputeSnapshot(id, organizationId, forceRefresh);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("[financial-statements/reports/:id/snapshot GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
