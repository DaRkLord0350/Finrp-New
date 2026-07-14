import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { createExportJob } from "@/lib/financial-statements/service";
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

    const exports = await prisma.statementExport.findMany({
      where: { organizationId, financialStatementId: reportId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(exports);
  } catch (err) {
    console.error("[financial-statements/exports GET]", err);
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
    if (!body?.reportId || !body?.format) {
      return NextResponse.json({ error: "Missing required fields: reportId, format" }, { status: 400 });
    }

    const exportJob = await createExportJob({
      organizationId,
      userId,
      reportId: body.reportId,
      format: body.format,
      includeSignaturePlaceholder: body.includeSignaturePlaceholder,
    });
    return NextResponse.json(exportJob, { status: 201 });
  } catch (err) {
    console.error("[financial-statements/exports POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

