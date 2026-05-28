import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceTypeService } from "@/services/compliance/complianceTypeService";
import { ComplianceTypeSchema } from "@/lib/validators/compliance";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId");

    const types = categoryId
      ? await complianceTypeService.getAllByCategory(categoryId, organizationId)
      : await complianceTypeService.getAll(organizationId);

    return NextResponse.json(types);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_TYPES_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const body = await req.json();
    const parsed = ComplianceTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const type = await complianceTypeService.create(parsed.data, organizationId, user.id);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "CREATE",
      entity: "compliance_type",
      entityId: type.id,
      description: `Created compliance type "${type.name}"`,
    });

    return NextResponse.json(type, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_TYPES_POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
