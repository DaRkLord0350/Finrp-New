import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { organizationService } from "@/lib/services/organization.service";
import { mapOrganizationError } from "@/lib/organization/http";
import { CreateOrgDepartmentSchema } from "@/lib/validators/organization";

export const GET = withTenant(
  async (_req, { organizationId }) => {
    try {
      const departments = await organizationService.listDepartments(organizationId);
      return NextResponse.json({ departments });
    } catch (err) {
      return mapOrganizationError(err, "ORG_DEPARTMENTS_GET");
    }
  },
  { permission: "organization.read" }
);

export const POST = withTenant(
  async (req, { organizationId, userId }) => {
    try {
      const body = await req.json().catch(() => null);
      const parsed = CreateOrgDepartmentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
      }
      const department = await organizationService.createDepartment(organizationId, { userId }, parsed.data);
      return NextResponse.json(department, { status: 201 });
    } catch (err) {
      return mapOrganizationError(err, "ORG_DEPARTMENTS_POST");
    }
  },
  { permission: "organization.write" }
);
