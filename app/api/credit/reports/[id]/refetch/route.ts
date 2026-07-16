import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapCreditError } from "@/lib/credit/http";
import { getReport, pullCreditReport } from "@/lib/credit/service";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "credit.pull" });
    const { id } = await params;
    const previous = await getReport(id, organizationId);

    let subjectName = "Unknown";
    if (previous.subjectType === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { id: previous.subjectId }, select: { name: true } });
      subjectName = customer?.name ?? subjectName;
    } else if (previous.subjectType === "CO_APPLICANT") {
      const co = await prisma.loanCoApplicant.findUnique({ where: { id: previous.subjectId }, select: { name: true, pan: true } });
      subjectName = co?.name ?? subjectName;
    }

    const report = await pullCreditReport(
      organizationId,
      {
        subjectType: previous.subjectType,
        subjectId: previous.subjectId,
        subjectName,
        bureau: previous.provider,
        pullType: previous.pullType,
        applicationId: previous.applicationId ?? undefined,
      },
      { userId, role }
    );
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return mapCreditError(err, "CREDIT_REPORT_REFETCH");
  }
}
