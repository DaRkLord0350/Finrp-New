import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceSubmissionService } from "@/services/compliance/complianceSubmissionService";
import { UpdateComplianceSubmissionSchema } from "@/lib/validators/compliance";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const { id } = await params;
    const submission = await complianceSubmissionService.getById(id, organizationId);
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(submission);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_SUBMISSION_GET]", err);
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
    const parsed = UpdateComplianceSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await complianceSubmissionService.update(
      id,
      parsed.data,
      organizationId,
      user.id
    );

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[COMPLIANCE_SUBMISSION_PATCH]", err);
    return NextResponse.json({ error: msg }, { status: msg === "Submission not found" ? 404 : 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requirePermission("compliance.delete");
    const { id } = await params;
    await complianceSubmissionService.softDelete(id, organizationId, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[COMPLIANCE_SUBMISSION_DELETE]", err);
    return NextResponse.json({ error: msg }, { status: msg === "Submission not found" ? 404 : 500 });
  }
}
