// ============================================================
// /api/erp/vendors — Vendor CRUD
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";

export async function GET() {
  try {
    const { organizationId } = await requireTenant({ permission: "erp.read" });

    const vendors = await prisma.vendor.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(vendors);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[GET /api/erp/vendors]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "erp.write" });
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        name: body.name,
        vendorCode: body.vendorCode || undefined,
        contactPerson: body.contactPerson || undefined,
        email: body.email || undefined,
        phone: body.phone || undefined,
        address: body.address || undefined,
        city: body.city || undefined,
        state: body.state || undefined,
        country: body.country || undefined,
        gstin: body.gstin || undefined,
        bankName: body.bankName || undefined,
        bankAccount: body.bankAccount || undefined,
        bankIFSC: body.bankIFSC || undefined,
        paymentTermsDays: body.paymentTermsDays ?? 30,
        category: body.category || undefined,
        notes: body.notes || undefined,
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[POST /api/erp/vendors]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
