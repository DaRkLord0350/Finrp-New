import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapMonitoringError } from "@/lib/monitoring/http";
import { listRules, upsertRule } from "@/lib/monitoring/case-service";

export async function GET() {
  try {
    const { organizationId } = await requireTenant({ permission: "monitoring.read" });
    const rules = await listRules(organizationId);
    return NextResponse.json({ rules });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_RULES_GET");
  }
}

export async function PUT(req: Request) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "monitoring.manage" });
    const body = await req.json();
    if (!body.ruleType || !body.name || !body.config) {
      return NextResponse.json({ error: "ruleType, name, and config are required" }, { status: 400 });
    }
    const rule = await upsertRule(organizationId, body, { userId });
    return NextResponse.json({ rule });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_RULES_PUT");
  }
}
