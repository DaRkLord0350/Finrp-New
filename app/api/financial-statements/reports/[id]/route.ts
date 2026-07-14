import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { getReport, updateReportStatus } from "@/lib/financial-statements/service";
import type { StatementStatus } from "@/lib/financial-statements/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { id } = await params;
    const report = await getReport(id, organizationId);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[financial-statements/reports/:id GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body?.status) {
      return NextResponse.json({ error: "Missing required field: status" }, { status: 400 });
    }

    const report = await updateReportStatus(id, organizationId, body.status as StatementStatus, userId);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[financial-statements/reports/:id PATCH]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
