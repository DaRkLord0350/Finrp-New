import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";
import { explainRejection } from "@/lib/lending/ai/explain";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const app = await prisma.loanApplication.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { product: true, eligibilityChecks: true },
    });
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (app.status !== "REJECTED") {
      return NextResponse.json({ error: "Application is not rejected" }, { status: 400 });
    }

    const explanation = await explainRejection({
      applicationNumber: app.applicationNumber,
      productName: app.product.name,
      requestedAmount: Number(app.requestedAmount),
      rejectionReason: app.rejectionReason,
      failedChecks: app.eligibilityChecks.map((c) => ({
        ruleName: c.ruleName,
        passed: c.passed,
        expectedValue: c.expectedValue,
        actualValue: c.actualValue,
        message: c.message ?? "",
      })),
      riskScore: app.riskScore,
      riskCategory: app.riskCategory,
    });
    return NextResponse.json({ explanation });
  } catch (err) {
    return mapLendingError(err, "LENDING_AI_EXPLAIN_REJECTION");
  }
}
