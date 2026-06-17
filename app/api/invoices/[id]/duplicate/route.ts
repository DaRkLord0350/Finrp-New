// ============================================================
// POST /api/invoices/[id]/duplicate — clone an invoice as a new DRAFT
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { generateNextInvoiceNumber } from "@/lib/generators/invoice-number";
import { logInvoiceActivity } from "@/lib/invoices/activity";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let actorName: string | null = null;
    try {
      const { user } = await requirePermission("invoices.write");
      actorName = user.name;
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const source = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });
    if (!source) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const invoiceNumber = await generateNextInvoiceNumber(organizationId);
    const dueDate = new Date(Date.now() + 30 * 86400000);

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber,
        organizationId,
        customerId: source.customerId,
        status: "DRAFT",
        dueDate,
        currency: source.currency,
        taxRate: source.taxRate,
        taxAmount: source.taxAmount,
        subtotal: source.subtotal,
        discount: source.discount,
        shipping: source.shipping,
        total: source.total,
        paidAmount: 0,
        balanceDue: source.total,
        notes: source.notes,
        terms: source.terms,
        items: {
          create: source.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
            sku: it.sku,
            taxPercent: it.taxPercent,
            taxAmount: it.taxAmount,
            discount: it.discount,
          })),
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    await logInvoiceActivity({
      invoiceId: created.id,
      organizationId,
      type: "CREATED",
      message: `Duplicated from ${source.invoiceNumber}`,
      metadata: { sourceInvoice: source.invoiceNumber },
      actorName,
    });

    return NextResponse.json({ invoice: created }, { status: 201 });
  } catch (error) {
    console.error("[INVOICE_DUPLICATE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
