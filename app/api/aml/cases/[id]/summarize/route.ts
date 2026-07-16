import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { getCaseDetail } from "@/lib/aml/case-service";
import { summarizeAmlCase } from "@/lib/aml/ai/summarize";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "aml.read" });
    const { id } = await params;
    const amlCase = await getCaseDetail(id, organizationId);
    const summary = await summarizeAmlCase({
      caseNumber: amlCase.caseNumber,
      subjectName: amlCase.subjectName,
      riskRating: amlCase.riskRating,
      alerts: amlCase.alerts.map((a) => ({ alertType: a.alertType, severity: a.severity, description: a.description })),
    });
    return NextResponse.json({ summary });
  } catch (err) {
    return mapAmlError(err, "AML_CASE_SUMMARIZE");
  }
}
