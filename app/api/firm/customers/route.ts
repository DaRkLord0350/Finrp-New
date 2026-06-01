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

export async function GET(req: NextRequest) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withCA = req.nextUrl.searchParams.get("withCA") === "true";

  const customers = await prisma.customer.findMany({
    where: { organizationId: admin.organizationId, deletedAt: null },
    include: {
      _count: {
        select: {
          firmTasks: true,
          customerAssignments: { where: { isActive: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!withCA) return NextResponse.json({ customers });

  const caUsers = await prisma.user.findMany({
    where: { organizationId: admin.organizationId, userRole: "CA" },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: { customerAssignments: { where: { isActive: true } } },
      },
    },
  });

  return NextResponse.json({ customers, caUsers });
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phone, company, customerType } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      customerType: customerType ?? "BUSINESS",
      organizationId: admin.organizationId,
      firmId: admin.firmId,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
