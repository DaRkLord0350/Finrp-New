import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapMonitoringError } from "@/lib/monitoring/http";
import { getCaseDetail, assignCase, escalateCase, resolveCase } from "@/lib/monitoring/case-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "monitoring.read" });
    const { id } = await params;
    const kase = await getCaseDetail(id, organizationId);
    return NextResponse.json({ case: kase });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_CASE_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "monitoring.manage" });
    const { id } = await params;
    const body = await req.json();

    let kase;
    if (body.action === "assign") {
      if (!body.assignedToId) return NextResponse.json({ error: "assignedToId is required" }, { status: 400 });
      kase = await assignCase(id, organizationId, body.assignedToId, { userId });
    } else if (body.action === "escalate") {
      kase = await escalateCase(id, organizationId, body.notes, { userId });
    } else if (body.action === "resolve") {
      if (body.resolution !== "RESOLVED" && body.resolution !== "CLOSED") {
        return NextResponse.json({ error: "resolution must be 'RESOLVED' or 'CLOSED'" }, { status: 400 });
      }
      if (!body.resolutionNotes) return NextResponse.json({ error: "resolutionNotes is required" }, { status: 400 });
      kase = await resolveCase(id, organizationId, { resolution: body.resolution, resolutionNotes: body.resolutionNotes }, { userId, canManage: true });
    } else {
      return NextResponse.json({ error: "action must be 'assign', 'escalate', or 'resolve'" }, { status: 400 });
    }
    return NextResponse.json({ case: kase });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_CASE_PATCH");
  }
}
