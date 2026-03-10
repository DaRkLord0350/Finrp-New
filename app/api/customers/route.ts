import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = orgId ?? userId;

    const customers = await prisma.customer.findMany({
      where: { organizationId: tenantId },
      include: {
        _count: { select: { invoices: true } },
        invoices: { select: { total: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach totalRevenue from paid invoices
    const enriched = customers.map((c) => ({
      ...c,
      totalRevenue: c.invoices
        .filter((inv) => inv.status === "PAID")
        .reduce((s, inv) => s + Number(inv.total), 0),
      invoices: undefined, // don't expose full invoices list in this endpoint
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[CUSTOMERS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = orgId ?? userId;

    const body = await req.json();
    const { name, email, phone, company, address, notes } = body;
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: { name, email, phone, company, address, notes, organizationId: tenantId },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("[CUSTOMERS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
