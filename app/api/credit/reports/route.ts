import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapCreditError } from "@/lib/credit/http";
import { pullCreditReport, listReports } from "@/lib/credit/service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "credit.read" });
    const applicationId = new URL(req.url).searchParams.get("applicationId") ?? undefined;
    const reports = await listReports(organizationId, { applicationId });
    return NextResponse.json({ reports });
  } catch (err) {
    return mapCreditError(err, "CREDIT_REPORTS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "credit.pull" });
    const body = await req.json();
    const report = await pullCreditReport(organizationId, body, { userId, role });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return mapCreditError(err, "CREDIT_REPORTS_POST");
  }
}
