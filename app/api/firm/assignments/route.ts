// ============================================================
// /api/firm/assignments
//   GET  → active assignments for the firm
//   POST → assign (or reassign) a single customer to a CA
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";

export async function GET() {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.customerAssignment.findMany({
    where: { customer: { organizationId: admin.organizationId }, isActive: true },
    include: {
      customer: { select: { id: true, name: true, email: true, company: true } },
      ca: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerId, caId } = await req.json().catch(() => ({}));
  if (!customerId || !caId) {
    return NextResponse.json({ error: "customerId and caId are required" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: admin.organizationId },
    select: { id: true, name: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const ca = await prisma.user.findFirst({
    where: { id: caId, organizationId: admin.organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
    select: { id: true, name: true, email: true },
  });
  if (!ca) return NextResponse.json({ error: "CA user not found" }, { status: 404 });

  // Was this customer already assigned (→ reassignment)?
  const prior = await prisma.customerAssignment.findFirst({
    where: { customerId, isActive: true },
    include: { ca: { select: { id: true, name: true } } },
  });

  if (prior?.caId === caId) {
    return NextResponse.json({ error: "Customer is already assigned to this CA" }, { status: 409 });
  }

  const assignment = await prisma.$transaction(async (tx) => {
    await tx.customerAssignment.updateMany({
      where: { customerId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });
    return tx.customerAssignment.create({
      data: { customerId, caId, assignedById: admin.id, isActive: true, assignedAt: new Date() },
    });
  });

  await prisma.notification
    .create({
      data: {
        organizationId: admin.organizationId,
        userId: caId,
        type: "ASSIGNMENT_CREATED",
        title: "New Customer Assigned",
        message: `${customer.name} has been assigned to you.`,
        referenceId: assignment.id,
        referenceType: "customer_assignment",
      },
    })
    .catch(() => {});

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetUserId: caId,
    action: prior ? "CA_REASSIGNED" : "CA_ASSIGNED",
    metadata: {
      customerId,
      customerName: customer.name,
      toCa: ca.name ?? ca.email,
      fromCa: prior?.ca?.name ?? null,
    },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
