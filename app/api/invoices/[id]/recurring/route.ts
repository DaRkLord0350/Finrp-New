// ============================================================
// GET   /api/invoices/[id]/recurring — schedules created from this invoice
// POST  /api/invoices/[id]/recurring — create a recurring schedule
// PATCH /api/invoices/[id]/recurring — { recurringId, isActive } pause/resume
// Schedule rows feed an out-of-band worker that generates the invoices.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { logInvoiceActivity } from "@/lib/invoices/activity";

const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const schedules = await prisma.recurringInvoice.findMany({
      where: { organizationId, templateData: { path: ["sourceInvoiceId"], equals: id } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("[RECURRING_GET]", error);
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
    const frequency = FREQUENCIES.includes(body.frequency) ? body.frequency : "MONTHLY";
    const startDate = typeof body.startDate === "string" && body.startDate ? new Date(body.startDate) : new Date(Date.now() + 30 * 86400000);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
    }

    let endDate: Date | null = null;
    if (typeof body.endDate === "string" && body.endDate) {
      endDate = new Date(body.endDate);
      if (Number.isNaN(endDate.getTime())) {
        return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
      }
      if (endDate < startDate) {
        return NextResponse.json({ error: "End date cannot be before the start date" }, { status: 400 });
      }
    }

    let customIntervalDays: number | null = null;
    if (frequency === "CUSTOM") {
      customIntervalDays = Number(body.customIntervalDays);
      if (!Number.isFinite(customIntervalDays) || customIntervalDays < 1) {
        return NextResponse.json({ error: "Custom frequency requires a positive interval in days" }, { status: 400 });
      }
    }

    const templateData = {
      sourceInvoiceId: id,
      sourceInvoiceNumber: source.invoiceNumber,
      customerId: source.customerId,
      currency: source.currency,
      paymentTerms: source.paymentTerms,
      salesperson: source.salesperson,
      subject: source.subject,
      taxRate: Number(source.taxRate),
      discountType: source.discountType,
      discountValue: Number(source.discountValue),
      discount: Number(source.discount),
      shipping: Number(source.shipping),
      adjustment: Number(source.adjustment),
      tdsTcsType: source.tdsTcsType,
      tdsTcsRate: Number(source.tdsTcsRate),
      tdsTcsSectionId: source.tdsTcsSectionId,
      notes: source.notes,
      terms: source.terms,
      items: source.items.map((it) => ({
        description: it.description,
        sku: it.sku,
        hsnSac: it.hsnSac,
        unit: it.unit,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount),
        taxPercent: Number(it.taxPercent),
      })),
    };

    const schedule = await prisma.recurringInvoice.create({
      data: {
        organizationId,
        customerId: source.customerId,
        frequency,
        customIntervalDays,
        nextRunDate: startDate,
        endDate,
        templateData: templateData as unknown as Prisma.InputJsonValue,
      },
    });

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "RECURRING",
      message: `Recurring schedule created (${frequency.toLowerCase()})`,
      metadata: { frequency },
      actorName,
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error("[RECURRING_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    try {
      await requirePermission("invoices.write");
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (typeof body.recurringId !== "string" || typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "recurringId and isActive are required" }, { status: 400 });
    }

    const updated = await prisma.recurringInvoice.updateMany({
      where: { id: body.recurringId, organizationId },
      data: { isActive: body.isActive },
    });
    if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RECURRING_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
