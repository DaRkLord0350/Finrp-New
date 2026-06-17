// ============================================================
// lib/firm/assignments.ts
//
// Shared logic for the Customer ↔ CA relationship engine
// (Phase 4). Reuses the existing CustomerAssignment model — one
// active assignment per customer, full history via isActive /
// unassignedAt rows — plus Notification + TeamActivityLog audit.
// ============================================================

import { prisma } from "@/lib/prisma";
import { logTeamActivity, type TeamAction } from "@/lib/team/activity";

export interface FirmAdmin {
  id: string;
  organizationId: string;
  firmId: string | null;
  name: string | null;
  email: string;
}

export function verifyCustomer(orgId: string, customerId: string) {
  return prisma.customer.findFirst({ where: { id: customerId, organizationId: orgId } });
}

export function verifyCa(orgId: string, caId: string) {
  return prisma.user.findFirst({
    where: { id: caId, organizationId: orgId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
  });
}

export async function createAssignment(opts: {
  admin: FirmAdmin;
  customerId: string;
  caId: string;
  notes?: string | null;
  action: Extract<TeamAction, "CA_ASSIGNED" | "CA_REASSIGNED">;
  ipAddress?: string | null;
}) {
  const { admin, customerId, caId } = opts;

  // One active assignment per customer — retire any current one first.
  await prisma.customerAssignment.updateMany({
    where: { customerId, isActive: true },
    data: { isActive: false, unassignedAt: new Date() },
  });

  const assignment = await prisma.customerAssignment.create({
    data: {
      customerId,
      caId,
      assignedById: admin.id,
      notes: opts.notes ?? null,
      isActive: true,
      assignedAt: new Date(),
    },
    include: {
      customer: { select: { name: true } },
      ca: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.notification
    .create({
      data: {
        organizationId: admin.organizationId,
        userId: caId,
        type: "ASSIGNMENT_CREATED",
        title: opts.action === "CA_REASSIGNED" ? "Customer reassigned to you" : "New customer assigned",
        message: `${assignment.customer.name} has been assigned to you.`,
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
    action: opts.action,
    module: "ASSIGNMENT",
    metadata: { customerId, customerName: assignment.customer.name, notes: opts.notes ?? null },
    ipAddress: opts.ipAddress ?? null,
  });

  return assignment;
}

export async function removeAssignment(opts: {
  admin: FirmAdmin;
  assignmentId: string;
  ipAddress?: string | null;
}) {
  const { admin, assignmentId } = opts;

  const assignment = await prisma.customerAssignment.findUnique({
    where: { id: assignmentId },
    include: { customer: { select: { id: true, name: true, organizationId: true } } },
  });
  if (!assignment || assignment.customer.organizationId !== admin.organizationId) {
    return null;
  }

  await prisma.customerAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false, unassignedAt: new Date() },
  });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetUserId: assignment.caId,
    action: "CA_UNASSIGNED",
    module: "ASSIGNMENT",
    metadata: { customerId: assignment.customer.id, customerName: assignment.customer.name },
    ipAddress: opts.ipAddress ?? null,
  });

  return assignment;
}
