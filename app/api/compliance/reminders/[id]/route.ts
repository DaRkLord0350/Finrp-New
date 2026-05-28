import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceReminderService } from "@/services/compliance/complianceReminderService";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requirePermission("compliance.write");
    const { id } = await params;
    const { action } = await req.json();

    if (action === "dismiss") {
      await complianceReminderService.dismiss(id, organizationId);
    } else if (action === "trigger") {
      await complianceReminderService.markTriggered(id, organizationId);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_REMINDER_PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requirePermission("compliance.write");
    const { id } = await params;
    await complianceReminderService.delete(id, organizationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_REMINDER_DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
