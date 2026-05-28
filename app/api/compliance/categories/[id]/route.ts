import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceCategoryService } from "@/services/compliance/complianceCategoryService";
import { UpdateComplianceCategorySchema } from "@/lib/validators/compliance";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const { id } = await params;
    const category = await complianceCategoryService.getById(id, organizationId);
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(category);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_CATEGORY_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateComplianceCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await complianceCategoryService.update(id, parsed.data, organizationId, user.id);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "UPDATE",
      entity: "compliance_category",
      entityId: id,
      description: "Updated compliance category",
      newValue: parsed.data,
    });

    const updated = await complianceCategoryService.getById(id, organizationId);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_CATEGORY_PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requirePermission("compliance.delete");
    const { id } = await params;

    await complianceCategoryService.delete(id, organizationId);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "DELETE",
      entity: "compliance_category",
      entityId: id,
      description: "Deleted compliance category",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const msg = err instanceof Error ? err.message : "Internal server error";
    const status = msg.startsWith("Cannot delete") ? 409 : 500;
    console.error("[COMPLIANCE_CATEGORY_DELETE]", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
