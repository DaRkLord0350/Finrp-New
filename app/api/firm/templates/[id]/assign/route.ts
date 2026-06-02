import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { addDays, addMonths, addQuarters } from "date-fns";

async function getFirmAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "CA_FIRM_ADMIN") return null;
  return user;
}

function getOccurrenceDates(frequency: string, count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  for (let i = 1; i <= count; i++) {
    switch (frequency) {
      case "MONTHLY":
        dates.push(addMonths(now, i));
        break;
      case "QUARTERLY":
        dates.push(addQuarters(now, i));
        break;
      case "HALF_YEARLY":
        dates.push(addMonths(now, i * 6));
        break;
      case "YEARLY":
        dates.push(addMonths(now, i * 12));
        break;
      default:
        dates.push(addMonths(now, i));
    }
  }
  return dates;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { customerId, assignedCaId } = await req.json();
  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  // Verify template belongs to this org
  const template = await prisma.complianceTemplate.findFirst({
    where: { id, organizationId: admin.organizationId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Verify customer
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: admin.organizationId },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Resolve CA for this customer (use provided or find from active assignment)
  let caId = assignedCaId;
  if (!caId) {
    const assignment = await prisma.customerAssignment.findFirst({
      where: { customerId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    caId = assignment?.caId;
  }
  if (!caId) return NextResponse.json({ error: "No CA assigned to this customer. Please assign a CA first." }, { status: 400 });

  // Calculate occurrence count based on frequency
  const occurrenceCount: Record<string, number> = {
    MONTHLY: 12,
    QUARTERLY: 4,
    HALF_YEARLY: 2,
    YEARLY: 1,
    CUSTOM: 1,
  };
  const count = occurrenceCount[template.frequency] ?? 1;
  const occurrenceDates = getOccurrenceDates(template.frequency, count);

  const result = await prisma.$transaction(async (tx) => {
    // Create or update template assignment
    const ta = await tx.templateAssignment.upsert({
      where: { templateId_customerId: { templateId: id, customerId } },
      create: { templateId: id, customerId, assignedById: admin.id, isActive: true },
      update: { isActive: true, assignedById: admin.id },
    });

    // Generate FirmTasks for each occurrence × each template task
    const tasksToCreate = [];
    for (const occurrenceDate of occurrenceDates) {
      for (const templateTask of template.tasks) {
        const dueDate = addDays(occurrenceDate, -templateTask.daysBeforeDue);
        tasksToCreate.push({
          title: `${templateTask.title} — ${template.name}`,
          description: templateTask.description,
          customerId,
          assignedCaId: caId,
          dueDate,
          organizationId: admin.organizationId,
          createdById: admin.id,
          templateId: id,
          templateTaskId: templateTask.id,
        });
      }
    }

    await tx.firmTask.createMany({ data: tasksToCreate });
    return { ta, tasksCreated: tasksToCreate.length };
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "CREATE",
    entity: "template_assignment",
    entityId: customerId,
    description: `Assigned template "${template.name}" to customer ${customer.name}. Generated ${result.tasksCreated} tasks.`,
  });

  return NextResponse.json({
    ok: true,
    tasksCreated: result.tasksCreated,
    message: `Template assigned. ${result.tasksCreated} tasks generated.`,
  }, { status: 201 });
}
