import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (req, { organizationId }) => {
    const customers = await prisma.customer.findMany({
      where: { organizationId },
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
  },
  "customers.read"
);

export const POST = withAuth(
  async (req, { organizationId }) => {
    const body = await req.json();
    const { name, email, phone, company, address, notes } = body;
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: { name, email, phone, company, address, notes, organizationId },
    });
    return NextResponse.json(customer, { status: 201 });
  },
  "customers.write"
);
