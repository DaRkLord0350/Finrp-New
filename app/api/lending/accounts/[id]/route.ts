import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const account = await prisma.loanAccount.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        product: true,
        application: true,
        emiSchedules: { orderBy: { installmentNumber: "asc" } },
        repayments: { orderBy: { paymentDate: "desc" } },
        collectionCases: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!account) return NextResponse.json({ error: "Loan account not found" }, { status: 404 });
    return NextResponse.json({ account });
  } catch (err) {
    return mapLendingError(err, "LENDING_ACCOUNT_GET");
  }
}
