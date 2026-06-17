// ============================================================
// GET  /api/invoices/[id]/credit-note  — list credit notes for an invoice
// POST /api/invoices/[id]/credit-note  — issue a credit note from an invoice
// Credit notes live in their own table → never affect invoice reporting.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { generateNextInvoiceNumber } from "@/lib/generators/invoice-number";
import { logInvoiceActivity } from "@/lib/invoices/activity";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const creditNotes = await prisma.creditNote.findMany({
      where: { invoiceId: id, organizationId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ creditNotes });
  } catch (error) {
    console.error("[CREDIT_NOTE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
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

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    // Full credit by default — snapshot the invoice's line items.
    const items = source.items.map((it) => ({
      description: it.description,
      sku: it.sku,
      hsnSac: it.hsnSac,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      taxPercent: Number(it.taxPercent),
      amount: Number(it.amount),
    }));

    const creditNoteNumber = await generateNextInvoiceNumber(organizationId, "CN");

    const creditNote = await prisma.creditNote.create({
      data: {
        organizationId,
        invoiceId: id,
        customerId: source.customerId,
        creditNoteNumber,
        reason,
        currency: source.currency,
        subtotal: source.subtotal,
        taxAmount: source.taxAmount,
        total: source.total,
        notes: source.notes,
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "CREDIT_NOTE",
      message: `Credit note ${creditNoteNumber} issued`,
      metadata: { creditNoteNumber, total: Number(source.total) },
      actorName,
    });

    return NextResponse.json({ creditNote }, { status: 201 });
  } catch (error) {
    console.error("[CREDIT_NOTE_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
