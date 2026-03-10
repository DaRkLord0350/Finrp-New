import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("[INVOICES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { customerId, dueDate, taxRate = 0, notes, items } = body;

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

    const invoiceCount = await prisma.invoice.count({ where: { organizationId: orgId } });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(5, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        organizationId: orgId,
        dueDate: new Date(dueDate),
        taxRate,
        taxAmount,
        subtotal,
        total,
        notes,
        items: {
          create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
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
