import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapMonitoringError } from "@/lib/monitoring/http";
import { addCaseNote } from "@/lib/monitoring/case-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "monitoring.manage" });
    const { id } = await params;
    const { notes } = await req.json();
    if (!notes) return NextResponse.json({ error: "notes is required" }, { status: 400 });
    const kase = await addCaseNote(id, organizationId, notes, { userId });
    return NextResponse.json({ case: kase }, { status: 201 });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_CASE_NOTE_POST");
  }
}
