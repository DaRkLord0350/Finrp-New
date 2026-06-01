import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");

    // Verify all invoices belong to this org before fetching bids
    const orgInvoiceIds = (
      await prisma.tredsInvoice.findMany({
        where: { organizationId: tenantId, ...(invoiceId ? { id: invoiceId } : {}) },
        select: { id: true },
      })
    ).map((i) => i.id);

    if (orgInvoiceIds.length === 0) {
      return NextResponse.json({ bids: [], total: 0 });
    }

    const bids = await prisma.tredsBid.findMany({
      where: { tredsInvoiceId: { in: orgInvoiceIds } },
      include: {
        tredsInvoice: {
          select: { id: true, invoiceNumber: true, buyerName: true, invoiceAmount: true, status: true, dueDate: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      bids: bids.map((b) => ({
        ...b,
        interestRate: Number(b.interestRate),
        bidAmount: Number(b.bidAmount),
        tredsInvoice: {
          ...b.tredsInvoice,
          invoiceAmount: Number(b.tredsInvoice.invoiceAmount),
        },
      })),
      total: bids.length,
    });
  } catch (error) {
    console.error("[TREDS_BIDS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
