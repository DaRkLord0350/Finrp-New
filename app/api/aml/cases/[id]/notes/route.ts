import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { addCaseNote } from "@/lib/aml/case-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "aml.review" });
    const { id } = await params;
    const { notes } = await req.json();
    if (!notes) return NextResponse.json({ error: "notes is required" }, { status: 400 });
    const amlCase = await addCaseNote(id, organizationId, notes, { userId });
    return NextResponse.json({ case: amlCase }, { status: 201 });
  } catch (err) {
    return mapAmlError(err, "AML_CASE_NOTE_POST");
  }
}
