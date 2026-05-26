// ============================================================
// /api/erp/purchases — Purchases CRUD
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { organizationId },
      orderBy: { purchaseDate: "desc" },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error("[GET /api/erp/purchases]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.read");

export const POST = withAuth(async (req: Request, { organizationId }) => {
  try {
    const body = await req.json();

    const count = await prisma.purchase.count({ where: { organizationId } });
    const purchaseNumber = `PO-${String(count + 1).padStart(5, "0")}`;

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber,
        vendorName: body.vendorName,
        organizationId,
        totalAmount: body.totalAmount,
        status: body.status || "RECEIVED",
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
        notes: body.notes,
      },
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("[POST /api/erp/purchases]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.write");
