import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const customers = await prisma.customer.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { invoices: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error("[CUSTOMERS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, email, phone, company, address, notes } = body;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: { name, email, phone, company, address, notes, organizationId: orgId },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("[CUSTOMERS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
