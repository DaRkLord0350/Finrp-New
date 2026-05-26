import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (
  _req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing customer ID" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (error) {
    console.error("[CUSTOMER_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "customers.read");

export const PUT = withAuth(async (
  req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing customer ID" }, { status: 400 });
    }

    const body = await req.json();
    const customer = await prisma.customer.updateMany({
      where: { id, organizationId },
      data: body,
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("[CUSTOMER_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "customers.write");

export const DELETE = withAuth(async (
  _req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing customer ID" }, { status: 400 });
    }

    await prisma.customer.deleteMany({
      where: { id, organizationId },
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("[CUSTOMER_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "customers.write");