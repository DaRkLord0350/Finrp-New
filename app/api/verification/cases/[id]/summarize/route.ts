import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { getCaseDetail } from "@/lib/verification/case-service";
import { summarizeVerificationCase } from "@/lib/verification/ai/summarize";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "verification.read" });
    const { id } = await params;
    const kase = await getCaseDetail(id, organizationId);
    const summary = await summarizeVerificationCase({
      caseNumber: kase.caseNumber,
      subjectName: kase.subjectName,
      checks: kase.checks.map((c) => ({ checkType: c.checkType, status: c.status, failureReason: c.failureReason })),
    });
    return NextResponse.json({ summary });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CASE_SUMMARIZE");
  }
}
