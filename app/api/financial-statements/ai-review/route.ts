import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { getOrComputeSnapshot } from "@/lib/financial-statements/service";
import { generateAIReview } from "@/lib/financial-statements/ai-mapping";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.reportId) {
      return NextResponse.json({ error: "Missing required field: reportId" }, { status: 400 });
    }

    const [snapshot, report, org] = await Promise.all([
      getOrComputeSnapshot(body.reportId, organizationId),
      prisma.financialReport.findFirstOrThrow({
        where: { id: body.reportId, organizationId },
        select: { periodStart: true, periodEnd: true, statementType: true },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, businessProfile: { select: { industry: true } } },
      }),
    ]);

    const period = `${report.periodStart.toISOString().slice(0, 10)} to ${report.periodEnd.toISOString().slice(0, 10)}`;

    const review = await generateAIReview({
      reportData: snapshot as object,
      businessName: org.name,
      industry: org.businessProfile?.industry ?? "General",
      period,
    });

    return NextResponse.json({ review });
  } catch (err) {
    console.error("[financial-statements/ai-review POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

