import { NextResponse } from "next/server";
import { Prisma, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { generateNextInvoiceNumber } from "@/lib/generators/invoice-number";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import { computeInvoiceTotals, type TotalsLineInput } from "@/lib/invoices/totals";
import { assertWithinInvoiceLimit, PlanLimitError } from "@/lib/billing/guards";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status       = searchParams.get("status");
    const customerId   = searchParams.get("customerId");
    const includeItems = searchParams.get("items") === "true";
    // Pagination
    const take   = Math.min(parseInt(searchParams.get("take") ?? "100", 10), 200);
    const cursor = searchParams.get("cursor") ?? undefined;

    const where: Record<string, unknown> = { organizationId: tenantId };
    if (status)     where.status     = status;
    if (customerId) where.customerId = customerId;

    const baseOpts = {
      where,
      take: take + 1,
      orderBy: { createdAt: "desc" } as const,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 as const } : {}),
    };

    // Only include line items when explicitly requested (detail view)
    const invoices = includeItems
      ? await prisma.invoice.findMany({
          ...baseOpts,
          include: { customer: { select: { name: true, email: true } }, items: true },
        })
      : await prisma.invoice.findMany({
          ...baseOpts,
          select: {
            id: true, invoiceNumber: true, customerId: true, organizationId: true,
            status: true, issueDate: true, dueDate: true, subtotal: true,
            taxRate: true, taxAmount: true, total: true, notes: true,
            createdAt: true, updatedAt: true,
            customer: { select: { name: true, email: true } },
          },
        });

    const hasMore   = invoices.length > take;
    const data      = hasMore ? invoices.slice(0, take) : invoices;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ invoices: data, nextCursor, hasMore });
  } catch (error) {
    console.error("[INVOICES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface IncomingItem {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
  discount?: number;
  sku?: string;
  hsnSac?: string;
  taxPercent?: number;
  itemId?: string;
}

// Resolve + validate the chosen TDS/TCS section against this org. Returns the
// section's rate when no explicit override is supplied.
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

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { customerId, dueDate, taxRate = 0, notes, items } = body;

    if (!customerId || !dueDate || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify customer belongs to this org
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: tenantId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Plan limit: block creating beyond the org's invoice cap (402).
    await assertWithinInvoiceLimit(tenantId);

    // Validate status (defaults to DRAFT; SENT keeps the prior "Send Invoice" behaviour).
    const requestedStatus =
      typeof body.status === "string" && (Object.values(InvoiceStatus) as string[]).includes(body.status)
        ? (body.status as InvoiceStatus)
        : InvoiceStatus.DRAFT;

    const tdsTcs = await resolveTdsTcs(tenantId, body);

    // Backward-compat: legacy callers send a flat `discount` amount.
    const discountType = body.discountType === "PERCENT" ? "PERCENT" : "FIXED";
    const discountValue =
      body.discountValue !== undefined ? Number(body.discountValue) : Number(body.discount ?? 0);

    const lines: TotalsLineInput[] = (items as IncomingItem[]).map((i) => ({
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount ?? 0),
      taxPercent: Number(i.taxPercent ?? 0),
    }));

    const totals = computeInvoiceTotals({
      items: lines,
      invoiceTaxRate: Number(taxRate),
      discountType,
      discountValue,
      shipping: Number(body.shipping ?? 0),
      adjustment: Number(body.adjustment ?? 0),
      tdsTcsType: tdsTcs.type,
      tdsTcsRate: tdsTcs.rate,
      roundOff: body.roundOff !== undefined ? Number(body.roundOff) : undefined,
      autoRound: body.autoRound !== false,
    });

    // Invoice number: auto-generated, but a non-blank override is honoured (spec: editable #).
    const invoiceNumber =
      typeof body.invoiceNumber === "string" && body.invoiceNumber.trim()
        ? body.invoiceNumber.trim()
        : await generateNextInvoiceNumber(tenantId);

    const issueDate =
      typeof body.issueDate === "string" && body.issueDate ? new Date(body.issueDate) : undefined;

    let invoice;
    try {
      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          organizationId: tenantId,
          status: requestedStatus,
          ...(issueDate ? { issueDate } : {}),
          dueDate: new Date(dueDate),
          ...(requestedStatus === InvoiceStatus.SENT ? { sentAt: new Date() } : {}),
          // Header metadata
          paymentTerms: body.paymentTerms ?? null,
          salesperson: body.salesperson ?? null,
          orderNumber: body.orderNumber ?? null,
          referenceNumber: body.referenceNumber ?? null,
          subject: body.subject ?? null,
          currency: typeof body.currency === "string" && body.currency ? body.currency : undefined,
          // Amounts (from the shared totals engine)
          subtotal: totals.subtotal,
          discountType,
          discountValue,
          discount: totals.invoiceDiscount,
          shipping: totals.shipping,
          adjustment: totals.adjustment,
          roundOff: totals.roundOff,
          taxRate: totals.effectiveTaxRate,
          taxAmount: totals.taxAmount,
          tdsTcsType: tdsTcs.type,
          tdsTcsSectionId: tdsTcs.sectionId,
          tdsTcsRate: totals.tdsTcsRate,
          tdsTcsAmount: totals.tdsTcsAmount,
          total: totals.grandTotal,
          balanceDue: totals.grandTotal,
          notes,
          terms: typeof body.terms === "string" ? body.terms : undefined,
          internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : undefined,
          customFields:
            body.customFields !== undefined ? (body.customFields as Prisma.InputJsonValue) : undefined,
          items: {
            create: (items as IncomingItem[]).map((item) => {
              const amount = Number(item.quantity) * Number(item.unitPrice);
              const lineDiscount = Number(item.discount ?? 0);
              return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unit: item.unit ?? null,
                discount: lineDiscount,
                amount,
                sku: item.sku ?? null,
                hsnSac: item.hsnSac ?? null,
                taxPercent: item.taxPercent ?? 0,
                taxAmount: (amount - lineDiscount) * ((item.taxPercent ?? 0) / 100),
              };
            }),
          },
        },
        include: { customer: true, items: true },
      });
    } catch (e) {
      // Unique [organizationId, invoiceNumber] collision on a manual override.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "That invoice number is already in use." }, { status: 409 });
      }
      throw e;
    }

    await logInvoiceActivity({
      invoiceId: invoice.id,
      organizationId: tenantId,
      type: "CREATED",
      message: `Invoice ${invoice.invoiceNumber} created`,
      metadata: { total: Number(invoice.total), customer: invoice.customer.name },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ error: error.message, upgradeRequired: true }, { status: 402 });
    }
    console.error("[INVOICES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
