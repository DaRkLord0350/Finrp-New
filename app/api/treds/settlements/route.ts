import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const orgInvoiceIds = (
      await prisma.tredsInvoice.findMany({
        where: { organizationId: tenantId },
        select: { id: true },
      })
    ).map((i) => i.id);

    if (orgInvoiceIds.length === 0) {
      return NextResponse.json({ settlements: [], total: 0 });
    }

    const where: Record<string, unknown> = {
      tredsInvoiceId: { in: orgInvoiceIds },
    };
    if (status) where.status = status;

    const settlements = await prisma.tredsSettlement.findMany({
      where,
      include: {
        tredsInvoice: {
          select: { id: true, invoiceNumber: true, buyerName: true, invoiceAmount: true, financierName: true },
        },
      },
      orderBy: { settlementDate: "desc" },
    });

    return NextResponse.json({
      settlements: settlements.map((s) => ({
        ...s,
        amount: Number(s.amount),
        tredsInvoice: {
          ...s.tredsInvoice,
          invoiceAmount: Number(s.tredsInvoice.invoiceAmount),
        },
      })),
      total: settlements.length,
    });
  } catch (error) {
    console.error("[TREDS_SETTLEMENTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
