// ============================================================
// /api/firm/customers/[id]
//   PATCH  → edit a customer (name/email/phone/company/gstin/type/active)
//   DELETE → archive a customer (soft delete via deletedAt)
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import type { CustomerType, Prisma } from "@prisma/client";

const CUSTOMER_TYPES: CustomerType[] = ["INDIVIDUAL", "BUSINESS", "WHOLESALE", "RETAIL", "GOVERNMENT"];

async function ownedCustomer(orgId: string, id: string) {
  return prisma.customer.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownedCustomer(admin.organizationId, id)))
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: Prisma.CustomerUpdateInput = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = body.name.trim();
  }
  if ("email" in body) data.email = body.email?.trim() || null;
  if ("phone" in body) data.phone = body.phone?.trim() || null;
  if ("company" in body) data.company = body.company?.trim() || null;
  if ("gstin" in body) data.gstin = body.gstin?.trim() || null;
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if (body.customerType && CUSTOMER_TYPES.includes(body.customerType)) {
    data.customerType = body.customerType;
  }

  const customer = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json({ customer });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownedCustomer(admin.organizationId, id)))
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Archive = soft delete. Also deactivate any active CA assignments.
  await prisma.$transaction([
    prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } }),
    prisma.customerAssignment.updateMany({
      where: { customerId: id, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
