import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId },
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
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const customer = await prisma.customer.updateMany({
      where: { id, organizationId: orgId },
      data: body,
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("[CUSTOMER_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.customer.deleteMany({
      where: { id, organizationId: orgId },
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("[CUSTOMER_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

