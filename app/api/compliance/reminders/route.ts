import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceReminderService } from "@/services/compliance/complianceReminderService";
import { ComplianceReminderSchema } from "@/lib/validators/compliance";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter");

    let reminders;
    if (filter === "pending") {
      reminders = await complianceReminderService.getPending(organizationId);
    } else if (filter === "upcoming") {
      const days = parseInt(url.searchParams.get("days") ?? "14", 10);
      reminders = await complianceReminderService.getUpcoming(organizationId, days);
    } else {
      reminders = await complianceReminderService.getAll(organizationId);
    }

    return NextResponse.json(reminders);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_REMINDERS_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { organizationId } = await requirePermission("compliance.write");
    const body = await req.json();
    const parsed = ComplianceReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reminder = await complianceReminderService.create(parsed.data, organizationId);
    return NextResponse.json(reminder, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_REMINDERS_POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
