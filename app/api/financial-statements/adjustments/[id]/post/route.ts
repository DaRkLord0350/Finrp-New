import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { postAdjustmentJournal } from "@/lib/financial-statements/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { id } = await params;
    const journal = await postAdjustmentJournal(id, organizationId, userId);
    return NextResponse.json(journal);
  } catch (err) {
    console.error("[financial-statements/adjustments/:id/post POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
