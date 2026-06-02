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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Verify customer belongs to this org
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: admin.organizationId },
    select: { id: true, name: true, email: true, company: true, createdAt: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const assignments = await prisma.customerAssignment.findMany({
    where: { customerId: id },
    include: {
      ca: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const tasks = await prisma.firmTask.findMany({
    where: { customerId: id, organizationId: admin.organizationId },
    include: { assignedCa: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ customer, assignments, tasks });
}
