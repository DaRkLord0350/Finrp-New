import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";

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

  const templates = await prisma.complianceTemplate.findMany({
    where: { organizationId: admin.organizationId },
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
      _count: { select: { assignments: { where: { isActive: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, frequency, tasks = [] } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!frequency) return NextResponse.json({ error: "frequency is required" }, { status: 400 });

  const template = await prisma.complianceTemplate.create({
    data: {
      organizationId: admin.organizationId,
      firmId: admin.firmId,
      name: name.trim(),
      description: description?.trim() || null,
      frequency,
      tasks: {
        create: tasks.map((t: { title: string; description?: string; daysBeforeDue: number; sortOrder: number }) => ({
          title: t.title,
          description: t.description || null,
          daysBeforeDue: t.daysBeforeDue,
          sortOrder: t.sortOrder ?? 0,
        })),
      },
    },
    include: { tasks: true },
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "CREATE",
    entity: "compliance_template",
    entityId: template.id,
    description: `Created compliance template: ${name}`,
  });

  return NextResponse.json({ template }, { status: 201 });
}
