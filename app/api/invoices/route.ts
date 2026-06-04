import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { generateNextInvoiceNumber } from "@/lib/generators/invoice-number";

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
  sku?: string;
  taxPercent?: number;
  itemId?: string;
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { customerId, dueDate, taxRate = 0, notes, items, discount = 0, shipping = 0 } = body;

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

    const subtotal = (items as IncomingItem[]).reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxAmount = subtotal * (Number(taxRate) / 100);
    const total = subtotal + taxAmount + Number(shipping) - Number(discount);
    const balanceDue = total;

    // Atomic collision-safe invoice number (Task 6)
    const invoiceNumber = await generateNextInvoiceNumber(tenantId);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        organizationId: tenantId,
        dueDate: new Date(dueDate),
        taxRate: Number(taxRate),
        taxAmount,
        subtotal,
        discount: Number(discount),
        shipping: Number(shipping),
        total,
        balanceDue,
        notes,
        items: {
          create: (items as IncomingItem[]).map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            sku: item.sku ?? null,
            taxPercent: item.taxPercent ?? 0,
            taxAmount: item.quantity * item.unitPrice * ((item.taxPercent ?? 0) / 100),
          })),
        },
      },
      include: { customer: true, items: true },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("[INVOICES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
