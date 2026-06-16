// ============================================================
// GET /api/customers/[id]/assignments
//   Full assignment history (active + past) for a customer, with
//   CA and assigned-by details.
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: admin.organizationId },
    select: { id: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const assignments = await prisma.customerAssignment.findMany({
    where: { customerId: id },
    include: {
      ca: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json({ assignments });
}
