import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { organizationService } from "@/lib/services/organization.service";
import { mapOrganizationError } from "@/lib/organization/http";
import { UpdateOrgDepartmentSchema } from "@/lib/validators/organization";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("organization.write");
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateOrgDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const department = await organizationService.updateDepartment(organizationId, { userId: user.id }, id, parsed.data);
    return NextResponse.json(department);
  } catch (err) {
    return mapOrganizationError(err, "ORG_DEPARTMENT_PATCH");
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("organization.write");
    const { id } = await params;

    await organizationService.deleteDepartment(organizationId, { userId: user.id }, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapOrganizationError(err, "ORG_DEPARTMENT_DELETE");
  }
}
