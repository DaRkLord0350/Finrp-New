import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapCreditError } from "@/lib/credit/http";
import { getReport } from "@/lib/credit/service";
import { getCreditHistory } from "@/lib/credit/comparison";
import { summarizeCreditReport } from "@/lib/credit/ai/summarize";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "credit.read" });
    const { id } = await params;
    const report = await getReport(id, organizationId);
    const { trend } = await getCreditHistory(organizationId, report.subjectType, report.subjectId);

    const totalOutstanding = report.tradelines.reduce((sum, t) => sum + Number(t.currentBalance ?? 0), 0);
    const summary = await summarizeCreditReport({
      bureau: report.provider,
      score: report.scores[0]?.score ?? null,
      scoreModel: report.scores[0]?.scoreModel ?? null,
      riskGrade: report.scores[0]?.riskGrade ?? null,
      tradelineCount: report.tradelines.length,
      activeTradelineCount: report.tradelines.filter((t) => t.status === "ACTIVE").length,
      overdueTradelineCount: report.tradelines.filter((t) => Number(t.overdueAmount ?? 0) > 0).length,
      totalOutstanding,
      recentEnquiryCount: report.enquiries.length,
      trend,
    });
    return NextResponse.json({ summary });
  } catch (err) {
    return mapCreditError(err, "CREDIT_REPORT_SUMMARIZE");
  }
}
