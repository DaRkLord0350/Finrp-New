import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { createAdjustmentJournal } from "@/lib/financial-statements/service";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const reportId = req.nextUrl.searchParams.get("reportId");
    if (!reportId) {
      return NextResponse.json({ error: "Missing required query param: reportId" }, { status: 400 });
    }

    const journals = await prisma.adjustmentJournal.findMany({
      where: { organizationId, financialStatementId: reportId },
      include: { entries: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(journals);
  } catch (err) {
    console.error("[financial-statements/adjustments GET]", err);
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
    if (!body?.reportId || !body?.description || !body?.entryDate || !Array.isArray(body?.entries)) {
      return NextResponse.json({ error: "Missing required fields: reportId, description, entryDate, entries" }, { status: 400 });
    }

    const journal = await createAdjustmentJournal({
      organizationId,
      reportId: body.reportId,
      description: body.description,
      entryDate: new Date(body.entryDate),
      source: body.source,
      entries: body.entries,
      createdById: userId,
    });
    return NextResponse.json(journal, { status: 201 });
  } catch (err) {
    console.error("[financial-statements/adjustments POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

