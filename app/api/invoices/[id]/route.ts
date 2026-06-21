import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";
import { createAuditLog } from "@/lib/audit";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { computeInvoiceTotals, type TotalsLineInput } from "@/lib/invoices/totals";

const VALID_STATUSES = Object.values(InvoiceStatus) as string[];

interface IncomingItem {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
  discount?: number;
  sku?: string | null;
  hsnSac?: string | null;
  taxPercent?: number;
}

// Validate the chosen TDS/TCS section against this org; falls back to the
// section's stored rate when no explicit override is supplied.
async function resolveTdsTcs(
  organizationId: string,
  body: Record<string, unknown>
): Promise<{ type: "TDS" | "TCS" | null; sectionId: string | null; rate: number }> {
  const type = body.tdsTcsType === "TDS" || body.tdsTcsType === "TCS" ? body.tdsTcsType : null;
  if (!type) return { type: null, sectionId: null, rate: 0 };
  let sectionId: string | null = null;
  let rate = body.tdsTcsRate !== undefined ? Number(body.tdsTcsRate) : NaN;
  if (typeof body.tdsTcsSectionId === "string" && body.tdsTcsSectionId) {
    const section = await prisma.tdsTcsSection.findFirst({
      where: { id: body.tdsTcsSectionId, organizationId, type },
      select: { id: true, rate: true },
    });
    if (section) {
      sectionId = section.id;
      if (!Number.isFinite(rate)) rate = Number(section.rate);
    }
  }
  return { type, sectionId, rate: Number.isFinite(rate) ? Math.max(0, rate) : 0 };
}

// Snapshot the current invoice, replace its line items, and recompute totals
// inside one transaction. Returns the updated invoice or a typed error.
async function editInvoiceWithItems(args: {
  id: string;
  organizationId: string;
  body: Record<string, unknown>;
  items: IncomingItem[];
  actorId: string | null;
}): Promise<{ invoice: unknown; total: number } | { error: string; status: number }> {
  const { id, organizationId, body, items, actorId } = args;

  const valid = items.filter(
    (i) => typeof i.description === "string" && i.description.trim() && Number(i.unitPrice) > 0
  );
  if (valid.length === 0) {
    return { error: "Add at least one line item with a description and price.", status: 400 };
  }

  const current = await prisma.invoice.findFirst({
    where: { id, organizationId },
    include: { items: true },
  });
  if (!current) return { error: "Not found", status: 404 };

  // Optional customer change — must belong to the same org.
  let customerId = current.customerId;
  if (typeof body.customerId === "string" && body.customerId && body.customerId !== current.customerId) {
    const cust = await prisma.customer.findFirst({
      where: { id: body.customerId, organizationId },
      select: { id: true },
    });
    if (!cust) return { error: "Customer not found", status: 404 };
    customerId = body.customerId;
  }

  const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : Number(current.taxRate);
  const shipping = body.shipping !== undefined ? Number(body.shipping) : Number(current.shipping);
  const adjustment = body.adjustment !== undefined ? Number(body.adjustment) : Number(current.adjustment);
  const discountType: "FIXED" | "PERCENT" =
    body.discountType === "PERCENT"
      ? "PERCENT"
      : body.discountType === "FIXED"
        ? "FIXED"
        : current.discountType === "PERCENT"
          ? "PERCENT"
          : "FIXED";
  const discountValue =
    body.discountValue !== undefined
      ? Number(body.discountValue)
      : body.discount !== undefined
        ? Number(body.discount)
        : Number(current.discountValue);

  // TDS/TCS: explicit body wins; otherwise preserve the invoice's current selection.
  const tdsTcs =
    body.tdsTcsType !== undefined
      ? await resolveTdsTcs(organizationId, body)
      : {
          type: (current.tdsTcsType as "TDS" | "TCS" | null) ?? null,
          sectionId: current.tdsTcsSectionId,
          rate: Number(current.tdsTcsRate),
        };

  const lines: TotalsLineInput[] = valid.map((i) => ({
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    discount: Number(i.discount ?? 0),
    taxPercent: Number(i.taxPercent ?? 0),
  }));

  const totals = computeInvoiceTotals({
    items: lines,
    invoiceTaxRate: taxRate,
    discountType,
    discountValue,
    shipping,
    adjustment,
    tdsTcsType: tdsTcs.type,
    tdsTcsRate: tdsTcs.rate,
    roundOff: body.roundOff !== undefined ? Number(body.roundOff) : undefined,
    autoRound: body.autoRound !== false,
  });
  const total = totals.grandTotal;
  const paidAmount = Number(current.paidAmount);
  const balanceDue = Math.max(0, total - paidAmount);

  const snapshot = {
    invoiceNumber: current.invoiceNumber,
    status: current.status,
    customerId: current.customerId,
    issueDate: current.issueDate.toISOString(),
    dueDate: current.dueDate.toISOString(),
    subtotal: Number(current.subtotal),
    discount: Number(current.discount),
    discountType: current.discountType,
    discountValue: Number(current.discountValue),
    shipping: Number(current.shipping),
    adjustment: Number(current.adjustment),
    roundOff: Number(current.roundOff),
    taxRate: Number(current.taxRate),
    taxAmount: Number(current.taxAmount),
    tdsTcsType: current.tdsTcsType,
    tdsTcsRate: Number(current.tdsTcsRate),
    tdsTcsAmount: Number(current.tdsTcsAmount),
    total: Number(current.total),
    paidAmount: Number(current.paidAmount),
    balanceDue: Number(current.balanceDue),
    notes: current.notes,
    terms: current.terms,
    items: current.items.map((it) => ({
      description: it.description,
      sku: it.sku,
      hsnSac: it.hsnSac,
      unit: it.unit,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discount: Number(it.discount),
      taxPercent: Number(it.taxPercent),
      amount: Number(it.amount),
    })),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const last = await tx.invoiceVersion.findFirst({
      where: { invoiceId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.invoiceVersion.create({
      data: {
        invoiceId: id,
        organizationId,
        version: (last?.version ?? 0) + 1,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        changedById: actorId,
        changeSummary: "Invoice edited",
      },
    });

    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

    return tx.invoice.update({
      where: { id },
      data: {
        customerId,
        dueDate: typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : undefined,
        issueDate: typeof body.issueDate === "string" && body.issueDate ? new Date(body.issueDate) : undefined,
        paymentTerms: typeof body.paymentTerms === "string" ? body.paymentTerms : undefined,
        salesperson: typeof body.salesperson === "string" ? body.salesperson : undefined,
        orderNumber: typeof body.orderNumber === "string" ? body.orderNumber : undefined,
        referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber : undefined,
        subject: typeof body.subject === "string" ? body.subject : undefined,
        taxRate: totals.effectiveTaxRate,
        discountType,
        discountValue,
        discount: totals.invoiceDiscount,
        shipping: totals.shipping,
        adjustment: totals.adjustment,
        roundOff: totals.roundOff,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        tdsTcsType: tdsTcs.type,
        tdsTcsSectionId: tdsTcs.sectionId,
        tdsTcsRate: totals.tdsTcsRate,
        tdsTcsAmount: totals.tdsTcsAmount,
        total,
        balanceDue,
        notes: typeof body.notes === "string" ? body.notes : current.notes,
        terms: typeof body.terms === "string" ? body.terms : current.terms,
        internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : current.internalNotes,
        customFields:
          body.customFields !== undefined
            ? (body.customFields as Prisma.InputJsonValue)
            : undefined,
        currency: typeof body.currency === "string" && body.currency ? body.currency : current.currency,
        items: {
          create: valid.map((i) => {
            const amount = Number(i.quantity) * Number(i.unitPrice);
            const lineDiscount = Number(i.discount ?? 0);
            return {
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              unit: i.unit ?? null,
              discount: lineDiscount,
              amount,
              sku: i.sku ?? null,
              hsnSac: i.hsnSac ?? null,
              taxPercent: i.taxPercent ?? 0,
              taxAmount: (amount - lineDiscount) * ((i.taxPercent ?? 0) / 100),
            };
          }),
        },
      },
      include: { customer: true, items: true, payments: true },
    });
  });

  return { invoice: updated, total };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { customer: true, items: true, payments: true },
    });

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[INVOICE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: editing an invoice (incl. its status) requires write access.
    // requirePermission throws a NextResponse (401/403) which we surface as-is.
    let actor: { id: string; name: string | null } | null = null;
    try {
      const { user } = await requirePermission("invoices.write");
      actor = { id: user.id, name: user.name };
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { items: bodyItems, ...invoiceData } = body;

    // Guard the status field: only accept values from the InvoiceStatus enum.
    if (invoiceData.status !== undefined && !VALID_STATUSES.includes(invoiceData.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Full edit: line items provided → snapshot, recompute, replace ──────
    if (Array.isArray(bodyItems)) {
      const result = await editInvoiceWithItems({
        id,
        organizationId,
        body,
        items: bodyItems as IncomingItem[],
        actorId: actor?.id ?? null,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logInvoiceActivity({
        invoiceId: id,
        organizationId,
        type: "UPDATED",
        message: "Invoice edited",
        metadata: { total: result.total },
        actorId: actor?.id,
        actorName: actor?.name,
      });
      return NextResponse.json(result.invoice);
    }

    // ── Scalar / status-only update (backward compatible) ─────────────────
    const invoice = await prisma.invoice.updateMany({
      where: { id, organizationId },
      data: invoiceData,
    });

    if (invoice.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Timeline entry (fire-and-forget) — status change vs. generic edit.
    if (invoiceData.status !== undefined) {
      await logInvoiceActivity({
        invoiceId: id,
        organizationId,
        type: "STATUS_CHANGED",
        message: `Status changed to ${getInvoiceStatusMeta(invoiceData.status).label}`,
        metadata: { status: invoiceData.status },
        actorId: actor?.id,
        actorName: actor?.name,
      });
    } else {
      await logInvoiceActivity({
        invoiceId: id,
        organizationId,
        type: "UPDATED",
        message: "Invoice details updated",
        actorId: actor?.id,
        actorName: actor?.name,
      });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[INVOICE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: deleting an invoice requires the delete action (OWNER/ADMIN).
    let actorId: string | undefined;
    try {
      const { user } = await requirePermission("invoices.delete");
      actorId = user.id;
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Snapshot for the audit trail before deletion.
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: { id: true, invoiceNumber: true, total: true, status: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.invoice.deleteMany({ where: { id, organizationId } });

    await createAuditLog({
      organizationId,
      userId: actorId,
      action: "DELETE",
      entity: "invoice",
      entityId: invoice.id,
      description: `Deleted invoice ${invoice.invoiceNumber}`,
      oldValue: {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total.toString(),
        status: invoice.status,
      },
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("[INVOICE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
