// ============================================================
// /api/erp/sales — Sales CRUD
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const sales = await prisma.sale.findMany({
      where: { organizationId },
      include: {
        customer: { select: { name: true, company: true } },
        items: true,
      },
      orderBy: { saleDate: "desc" },
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error("[GET /api/erp/sales]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.read");

export const POST = withAuth(async (req: Request, { organizationId }) => {
  try {
    const body = await req.json();

    const count = await prisma.sale.count({ where: { organizationId } });
    const saleNumber = `SL-${String(count + 1).padStart(5, "0")}`;

    const totalAmount = body.items?.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    ) ?? body.totalAmount ?? 0;

    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        customerId: body.customerId || null,
        organizationId,
        totalAmount,
        status: body.status || "COMPLETED",
        saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
        notes: body.notes,
        items: body.items
          ? {
              create: body.items.map(
                (item: { description: string; quantity: number; unitPrice: number; itemId?: string }) => ({
                  itemId: item.itemId || null,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  amount: item.quantity * item.unitPrice,
                })
              ),
            }
          : undefined,
      },
      include: { customer: true, items: true },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("[POST /api/erp/sales]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.write");
