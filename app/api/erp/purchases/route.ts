// ============================================================
// /api/erp/purchases — Purchases CRUD
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;

    const purchases = await prisma.purchase.findMany({
      where: { organizationId: tenantId },
      orderBy: { purchaseDate: "desc" },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error("[GET /api/erp/purchases]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;
    const body = await req.json();

    const count = await prisma.purchase.count({ where: { organizationId: tenantId } });
    const purchaseNumber = `PO-${String(count + 1).padStart(5, "0")}`;

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber,
        vendorName: body.vendorName,
        organizationId: tenantId,
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
}
