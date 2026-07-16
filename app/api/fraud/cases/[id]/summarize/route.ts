import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { getCaseDetail } from "@/lib/fraud/case-service";
import { summarizeFraudCase } from "@/lib/fraud/ai/explain";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "fraud.read" });
    const { id } = await params;
    const fraudCase = await getCaseDetail(id, organizationId);
    const summary = await summarizeFraudCase({
      caseNumber: fraudCase.caseNumber,
      subjectName: fraudCase.subjectName,
      riskRating: fraudCase.riskRating,
      alerts: fraudCase.alerts.map((a) => ({ alertType: a.alertType, severity: a.severity, description: a.description })),
    });
    return NextResponse.json({ summary });
  } catch (err) {
    return mapFraudError(err, "FRAUD_CASE_SUMMARIZE");
  }
}
