import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listApplications, createApplication, type ListApplicationsFilters } from "@/lib/lending/applications";
import type { LoanApplicationStage, LoanApplicationStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const sp = new URL(req.url).searchParams;
    const filters: ListApplicationsFilters = {
      status: (sp.get("status") as LoanApplicationStatus) || undefined,
      stage: (sp.get("stage") as LoanApplicationStage) || undefined,
      productId: sp.get("productId") || undefined,
      customerId: sp.get("customerId") || undefined,
      assignedUnderwriterId: sp.get("assignedUnderwriterId") || undefined,
      search: sp.get("search") || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
    };
    const result = await listApplications(organizationId, filters);
    return NextResponse.json(result);
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATIONS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const body = await req.json();
    const application = await createApplication(organizationId, body, { userId, role });
    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATIONS_POST");
  }
}
