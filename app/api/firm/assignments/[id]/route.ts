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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const assignment = await prisma.customerAssignment.findUnique({
    where: { id },
    include: { customer: { select: { organizationId: true } } },
  });

  if (!assignment || assignment.customer.organizationId !== admin.organizationId) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  await prisma.customerAssignment.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
