import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { addCaseNote } from "@/lib/fraud/case-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "fraud.review" });
    const { id } = await params;
    const { notes } = await req.json();
    if (!notes) return NextResponse.json({ error: "notes is required" }, { status: 400 });
    const fraudCase = await addCaseNote(id, organizationId, notes, { userId });
    return NextResponse.json({ case: fraudCase }, { status: 201 });
  } catch (err) {
    return mapFraudError(err, "FRAUD_CASE_NOTE_POST");
  }
}
