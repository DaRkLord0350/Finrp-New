import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (req, { organizationId }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: { select: { name: true, email: true } }, items: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  },
  "invoices.read"
);

export const POST = withAuth(
  async (req, { organizationId }) => {
    const body = await req.json();
    const { customerId, dueDate, taxRate = 0, notes, status = "DRAFT", items } = body;

    if (!customerId || !dueDate || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const invoice = await prisma.$transaction(async (tx) => {
      // Atomically read + increment the invoice counter from Settings
      const settings = await tx.settings.findUnique({
        where: { organizationId },
        select: { invoicePrefix: true, invoiceStartNumber: true },
      });

      const prefix = settings?.invoicePrefix ?? "INV";
      const nextNumber = settings?.invoiceStartNumber ?? 1;

      await tx.settings.upsert({
        where: { organizationId },
        update: { invoiceStartNumber: nextNumber + 1 },
        create: {
          organizationId,
          invoiceStartNumber: nextNumber + 1,
        },
      });

      const invoiceNumber = `${prefix}-${String(nextNumber).padStart(5, "0")}`;

      return tx.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          organizationId,
          status,
          dueDate: new Date(dueDate),
          taxRate,
          taxAmount,
          subtotal,
          total,
          balanceDue: total,
          notes,
          items: {
            create: items.map(
              (item: { description: string; quantity: number; unitPrice: number }) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
              })
            ),
          },
        },
        include: { customer: true, items: true },
      });
    });

    return NextResponse.json(invoice, { status: 201 });
  },
  "invoices.write"
);
