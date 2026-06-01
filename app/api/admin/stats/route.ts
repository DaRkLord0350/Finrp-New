import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalOrgs, totalUsers, totalFirms, totalCustomers, totalTasks] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.firm.count(),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.firmTask.count(),
  ]);

  return NextResponse.json({ totalOrgs, totalUsers, totalFirms, totalCustomers, totalTasks });
}
