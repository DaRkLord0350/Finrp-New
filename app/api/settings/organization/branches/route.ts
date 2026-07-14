import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { organizationService } from "@/lib/services/organization.service";
import { mapOrganizationError } from "@/lib/organization/http";
import { CreateOrgBranchSchema } from "@/lib/validators/organization";

export const GET = withTenant(
  async (_req, { organizationId }) => {
    try {
      const branches = await organizationService.listBranches(organizationId);
      return NextResponse.json({ branches });
    } catch (err) {
      return mapOrganizationError(err, "ORG_BRANCHES_GET");
    }
  },
  { permission: "organization.read" }
);

export const POST = withTenant(
  async (req, { organizationId, userId }) => {
    try {
      const body = await req.json().catch(() => null);
      const parsed = CreateOrgBranchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
      }
      const branch = await organizationService.createBranch(organizationId, { userId }, parsed.data);
      return NextResponse.json(branch, { status: 201 });
    } catch (err) {
      return mapOrganizationError(err, "ORG_BRANCHES_POST");
    }
  },
  { permission: "organization.write" }
);
