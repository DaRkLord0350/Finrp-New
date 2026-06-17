import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { InvoiceStatus } from "@prisma/client";

const VALID_STATUSES = Object.values(InvoiceStatus) as string[];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { items: _items, ...invoiceData } = body;

    // Guard the status field: only accept values from the InvoiceStatus enum.
    if (invoiceData.status !== undefined && !VALID_STATUSES.includes(invoiceData.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.updateMany({
      where: { id, organizationId },
      data: invoiceData,
    });

    if (invoice.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("[INVOICE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.invoice.deleteMany({
      where: { id, organizationId },
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("[INVOICE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
