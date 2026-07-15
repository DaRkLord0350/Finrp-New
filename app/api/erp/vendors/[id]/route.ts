// ============================================================
// /api/erp/vendors/[id] — single Vendor: fetch + update
// GET includes recent purchases (bills) so the detail page can
// render a payment history without a second round trip.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "erp.read" });
    const { id } = await params;

    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        purchases: {
          where: { deletedAt: null },
          orderBy: { purchaseDate: "desc" },
          take: 25,
          select: {
            id: true,
            purchaseNumber: true,
            totalAmount: true,
            status: true,
            paymentStatus: true,
            purchaseDate: true,
          },
        },
      },
    });

    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    return NextResponse.json(vendor);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[GET /api/erp/vendors/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "erp.write" });
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.vendor.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name: body.name,
        contactPerson: body.contactPerson,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        country: body.country,
        gstin: body.gstin,
        bankName: body.bankName,
        bankAccount: body.bankAccount,
        bankIFSC: body.bankIFSC,
        paymentTermsDays: body.paymentTermsDays,
        category: body.category,
        notes: body.notes,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(vendor);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[PUT /api/erp/vendors/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
