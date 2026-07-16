import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { addCaseNote } from "@/lib/verification/case-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "verification.initiate" });
    const { id } = await params;
    const { notes } = await req.json();
    if (!notes) return NextResponse.json({ error: "notes is required" }, { status: 400 });
    const kase = await addCaseNote(id, organizationId, notes, { userId });
    return NextResponse.json({ case: kase }, { status: 201 });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CASE_NOTE_POST");
  }
}
