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
      return NextResponse.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { customer: true, items: true, payments: true },
    });

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[INVOICE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "invoices.read");

export const PUT = withAuth(async (
  req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    const body = await req.json();
    const { items, ...invoiceData } = body;

    const invoice = await prisma.invoice.updateMany({
      where: { id, organizationId },
      data: invoiceData,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[INVOICE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "invoices.write");

export const DELETE = withAuth(async (
  _req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    await prisma.invoice.deleteMany({
      where: { id, organizationId },
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("[INVOICE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "invoices.write");
