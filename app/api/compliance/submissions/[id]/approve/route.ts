import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceApprovalService } from "@/services/compliance/complianceApprovalService";
import { ApproveComplianceSchema } from "@/lib/validators/compliance";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const { id } = await params;
    const body = await req.json();

    const parsed = ApproveComplianceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const approval = await complianceApprovalService.approve(
      id,
      parsed.data,
      organizationId,
      user.id
    );

    return NextResponse.json(approval, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[COMPLIANCE_APPROVE_POST]", err);
    const status =
      msg === "Submission not found" ? 404 : msg.includes("not allowed") ? 422 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
