import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const invoice = await prisma.tredsInvoice.findFirst({
      where: { id, organizationId: tenantId },
      include: {
        bids: { orderBy: { createdAt: "desc" } },
        settlement: true,
        activityLogs: { orderBy: { createdAt: "desc" } },
        integration: { select: { provider: true, status: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...invoice,
      invoiceAmount: Number(invoice.invoiceAmount),
      financingRate: invoice.financingRate !== null ? Number(invoice.financingRate) : null,
      fundingAmount: invoice.fundingAmount !== null ? Number(invoice.fundingAmount) : null,
      bids: invoice.bids.map((b) => ({
        ...b,
        interestRate: Number(b.interestRate),
        bidAmount: Number(b.bidAmount),
      })),
      settlement: invoice.settlement
        ? { ...invoice.settlement, amount: Number(invoice.settlement.amount) }
        : null,
    });
  } catch (error) {
    console.error("[TREDS_INVOICE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.tredsInvoice.findFirst({
      where: { id, organizationId: tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.tredsInvoice.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        notes: body.notes ?? existing.notes,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[TREDS_INVOICE_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
