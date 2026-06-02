import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getFirmAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "CA_FIRM_ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.customerAssignment.findMany({
    where: {
      customer: { organizationId: admin.organizationId },
      isActive: true,
    },
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
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerId, caId } = await req.json();
  if (!customerId || !caId) {
    return NextResponse.json({ error: "customerId and caId are required" }, { status: 400 });
  }

  // Verify customer belongs to this org
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: admin.organizationId },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Verify CA belongs to this org
  const ca = await prisma.user.findFirst({
    where: { id: caId, organizationId: admin.organizationId, userRole: "CA" },
  });
  if (!ca) return NextResponse.json({ error: "CA user not found" }, { status: 404 });

  // Deactivate old assignments and stamp unassignedAt
  await prisma.customerAssignment.updateMany({
    where: { customerId, isActive: true },
    data: { isActive: false, unassignedAt: new Date() },
  });

  const assignment = await prisma.customerAssignment.create({
    data: {
      customerId,
      caId,
      assignedById: admin.id,
      isActive: true,
      assignedAt: new Date(),
    },
  });

  // Create notification for CA
  await prisma.notification.create({
    data: {
      organizationId: admin.organizationId,
      userId: caId,
      type: "ASSIGNMENT_CREATED",
      title: "New Customer Assigned",
      message: `${customer.name} has been assigned to you.`,
      referenceId: assignment.id,
      referenceType: "customer_assignment",
    },
  }).catch(() => {}); // non-blocking

  return NextResponse.json({ assignment }, { status: 201 });
}
