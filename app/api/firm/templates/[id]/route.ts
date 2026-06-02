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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const template = await prisma.complianceTemplate.findFirst({
    where: { id, organizationId: admin.organizationId },
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
      assignments: {
        where: { isActive: true },
        include: { customer: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.complianceTemplate.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, description, frequency, isActive, tasks } = body;

  const updated = await prisma.$transaction(async (tx) => {
    // If tasks provided, replace all
    if (Array.isArray(tasks)) {
      await tx.templateTask.deleteMany({ where: { templateId: id } });
      await tx.templateTask.createMany({
        data: tasks.map((t: { title: string; description?: string; daysBeforeDue: number; sortOrder: number }) => ({
          templateId: id,
          title: t.title,
          description: t.description || null,
          daysBeforeDue: t.daysBeforeDue,
          sortOrder: t.sortOrder ?? 0,
        })),
      });
    }

    return tx.complianceTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(frequency !== undefined && { frequency }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "UPDATE",
    entity: "compliance_template",
    entityId: id,
    description: `Updated compliance template: ${updated.name}`,
  });

  return NextResponse.json({ template: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.complianceTemplate.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.complianceTemplate.delete({ where: { id } });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "DELETE",
    entity: "compliance_template",
    entityId: id,
    description: `Deleted compliance template: ${existing.name}`,
  });

  return NextResponse.json({ ok: true });
}
