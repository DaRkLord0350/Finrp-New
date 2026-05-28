import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth/middleware";
import { complianceCategoryService } from "@/services/compliance/complianceCategoryService";
import { ComplianceCategorySchema } from "@/lib/validators/compliance";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const categories = await complianceCategoryService.getAllIncludingInactive(organizationId);
    return NextResponse.json(categories);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_CATEGORIES_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const body = await req.json();
    const parsed = ComplianceCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const category = await complianceCategoryService.create(parsed.data, organizationId, user.id);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "CREATE",
      entity: "compliance_category",
      entityId: category.id,
      description: `Created compliance category "${category.name}"`,
      newValue: { name: category.name, code: category.code },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_CATEGORIES_POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { organizationId } = await requirePermission("compliance.write");
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "seed") {
      const { user } = await requireAuth();
      const categories = await complianceCategoryService.seedDefaults(organizationId, user.id);
      return NextResponse.json({ seeded: categories.length });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_CATEGORIES_PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
