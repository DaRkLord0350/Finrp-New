// ============================================================
// POST /api/firm/assignments/bulk
//
// Bulk assign or reassign customers to a CA. Two modes:
//   • Provide `customerIds` to (re)assign a specific set.
//   • Provide `fromCaId` (no customerIds) to move EVERY customer
//     currently owned by that CA to `toCaId`.
//
// Each move deactivates the prior active assignment (stamping
// unassignedAt — the assignment history) and creates a fresh one,
// then writes a single activity-log entry + notifies the new owner.
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
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const toCaId = String(body.toCaId ?? "").trim();
  const fromCaId = body.fromCaId ? String(body.fromCaId).trim() : null;
  const explicitIds: string[] = Array.isArray(body.customerIds)
    ? body.customerIds.map(String)
    : [];

  if (!toCaId) return NextResponse.json({ error: "toCaId is required" }, { status: 400 });

  const toCa = await prisma.user.findFirst({
    where: { id: toCaId, organizationId: admin.organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
    select: { id: true, name: true, email: true },
  });
  if (!toCa) return NextResponse.json({ error: "Target CA not found" }, { status: 404 });

  const fromCa = fromCaId
    ? await prisma.user.findFirst({
        where: { id: fromCaId, organizationId: admin.organizationId },
        select: { id: true, name: true, email: true },
      })
    : null;
  if (fromCaId && !fromCa) return NextResponse.json({ error: "Source CA not found" }, { status: 404 });

  // Resolve the set of customer IDs to move.
  let customerIds: string[];
  if (explicitIds.length > 0) {
    const owned = await prisma.customer.findMany({
      where: { id: { in: explicitIds }, organizationId: admin.organizationId, deletedAt: null },
      select: { id: true },
    });
    customerIds = owned.map((c) => c.id);
  } else if (fromCaId) {
    const rows = await prisma.customerAssignment.findMany({
      where: { caId: fromCaId, isActive: true, customer: { organizationId: admin.organizationId, deletedAt: null } },
      select: { customerId: true },
    });
    customerIds = rows.map((r) => r.customerId);
  } else {
    return NextResponse.json({ error: "Provide customerIds or fromCaId" }, { status: 400 });
  }

  // Skip any already owned by the target CA.
  const already = await prisma.customerAssignment.findMany({
    where: { customerId: { in: customerIds }, caId: toCaId, isActive: true },
    select: { customerId: true },
  });
  const alreadySet = new Set(already.map((a) => a.customerId));
  const toMove = customerIds.filter((id) => !alreadySet.has(id));

  if (toMove.length === 0) {
    return NextResponse.json({ moved: 0, skipped: customerIds.length });
  }

  const isReassign = !!fromCaId || already.length > 0;

  await prisma.$transaction(async (tx) => {
    await tx.customerAssignment.updateMany({
      where: { customerId: { in: toMove }, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });
    await tx.customerAssignment.createMany({
      data: toMove.map((customerId) => ({
        customerId,
        caId: toCaId,
        assignedById: admin.id,
        isActive: true,
        reason: fromCa ? `Bulk reassigned from ${fromCa.name ?? fromCa.email}` : "Bulk assignment",
      })),
    });
  });

  await prisma.notification
    .create({
      data: {
        organizationId: admin.organizationId,
        userId: toCaId,
        type: "ASSIGNMENT_CREATED",
        title: "Customers Assigned",
        message: `${toMove.length} customer${toMove.length !== 1 ? "s" : ""} ${isReassign ? "reassigned" : "assigned"} to you.`,
        referenceType: "customer_assignment",
      },
    })
    .catch(() => {});

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetUserId: toCaId,
    action: isReassign ? "CA_REASSIGNED" : "CA_ASSIGNED",
    metadata: {
      count: toMove.length,
      toCa: toCa.name ?? toCa.email,
      fromCa: fromCa?.name ?? fromCa?.email ?? null,
      bulk: true,
    },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ moved: toMove.length, skipped: customerIds.length - toMove.length });
}
