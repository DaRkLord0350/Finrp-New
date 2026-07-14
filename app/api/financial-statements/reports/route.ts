import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { listReports, createReport } from "@/lib/financial-statements/service";
import type { StatementType } from "@/lib/financial-statements/types";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const type = req.nextUrl.searchParams.get("type") as StatementType | null;
    const reports = await listReports(organizationId, type ?? undefined);
    return NextResponse.json(reports);
  } catch (err) {
    console.error("[financial-statements/reports GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.statementType || !body?.fiscalYearId || !body?.periodStart || !body?.periodEnd) {
      return NextResponse.json({ error: "Missing required fields: statementType, fiscalYearId, periodStart, periodEnd" }, { status: 400 });
    }

    const report = await createReport({
      organizationId,
      statementType: body.statementType,
      fiscalYearId: body.fiscalYearId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      comparativeStart: body.comparativeStart ? new Date(body.comparativeStart) : undefined,
      comparativeEnd: body.comparativeEnd ? new Date(body.comparativeEnd) : undefined,
      category: body.category,
      createdById: userId,
    });
    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    console.error("[financial-statements/reports POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
