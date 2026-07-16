import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapMonitoringError } from "@/lib/monitoring/http";
import { acknowledgeAlert, dismissAlert } from "@/lib/monitoring/case-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "monitoring.manage" });
    const { id } = await params;
    const body = await req.json();

    let alert;
    if (body.action === "acknowledge") {
      alert = await acknowledgeAlert(id, organizationId, { userId });
    } else if (body.action === "dismiss") {
      alert = await dismissAlert(id, organizationId, body.notes, { userId });
    } else {
      return NextResponse.json({ error: "action must be 'acknowledge' or 'dismiss'" }, { status: 400 });
    }
    return NextResponse.json({ alert });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_ALERT_PATCH");
  }
}
