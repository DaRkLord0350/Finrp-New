import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapMonitoringError } from "@/lib/monitoring/http";
import { listAlerts } from "@/lib/monitoring/case-service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "monitoring.read" });
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") ?? undefined;
    const severity = sp.get("severity") ?? undefined;
    const alerts = await listAlerts(organizationId, { status, severity });
    return NextResponse.json({ alerts });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_ALERTS_GET");
  }
}
