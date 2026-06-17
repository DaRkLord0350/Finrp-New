// ============================================================
// POST /api/firms/customers/link
//   Body: { customerId, unlink?: boolean }
//   Links a customer (CRM record) to the admin's firm by setting
//   Customer.firmId (or clears it when unlink=true).
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customerId = body?.customerId as string | undefined;
  const unlink = body?.unlink === true;
  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: admin.organizationId },
    select: { id: true, name: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  await prisma.customer.update({
    where: { id: customerId },
    data: { firmId: unlink ? null : admin.firmId },
  });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    action: unlink ? "CUSTOMER_UNLINKED" : "CUSTOMER_LINKED",
    module: "CUSTOMER",
    metadata: { customerId, customerName: customer.name },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true, firmId: unlink ? null : admin.firmId });
}
