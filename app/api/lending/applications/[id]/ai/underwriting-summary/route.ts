import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";
import { generateUnderwritingSummary } from "@/lib/lending/ai/explain";
import { recordUnderwritingDecision } from "@/lib/lending/underwriting";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const { persistAs } = await req.json().catch(() => ({ persistAs: undefined }));

    const app = await prisma.loanApplication.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { product: true, eligibilityChecks: true, collaterals: true },
    });
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const collateralValue = app.collaterals.reduce((sum, c) => sum + Number(c.estimatedValue), 0);
    const reasoning = await generateUnderwritingSummary({
      applicationNumber: app.applicationNumber,
      productName: app.product.name,
      requestedAmount: Number(app.requestedAmount),
      requestedTenureMonths: app.requestedTenureMonths,
      riskScore: app.riskScore ?? 0,
      riskCategory: app.riskCategory ?? "MEDIUM",
      eligibilityChecks: app.eligibilityChecks.map((c) => ({
        ruleName: c.ruleName,
        passed: c.passed,
        expectedValue: c.expectedValue,
        actualValue: c.actualValue,
        message: c.message ?? "",
      })),
      collateralValue: collateralValue || undefined,
    });

    if (persistAs) {
      const decision = await recordUnderwritingDecision(
        id,
        organizationId,
        { decision: persistAs, reasoning, aiGenerated: true },
        { userId, role }
      );
      return NextResponse.json({ reasoning, decision });
    }
    return NextResponse.json({ reasoning });
  } catch (err) {
    return mapLendingError(err, "LENDING_AI_UNDERWRITING_SUMMARY");
  }
}
