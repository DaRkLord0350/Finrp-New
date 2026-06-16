import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logTaskActivity } from "@/lib/firm/tasks";

async function getFirmUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || !["CA_FIRM_ADMIN", "CA"].includes(user.userRole ?? "")) return null;
  return user;
}

export async function GET() {
  const user = await getFirmUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where =
    user.userRole === "CA_FIRM_ADMIN"
      ? { organizationId: user.organizationId }
      : { assignedCaId: user.id };

  const tasks = await prisma.firmTask.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      assignedCa: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await getFirmUser();
  if (!user || user.userRole !== "CA_FIRM_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, customerId, assignedCaId, dueDate, priority } = await req.json();
  if (!title?.trim() || !customerId || !assignedCaId || !dueDate) {
    return NextResponse.json({ error: "title, customerId, assignedCaId, dueDate are required" }, { status: 400 });
  }

  // Verify customer belongs to this org
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Verify CA belongs to this org
  const ca = await prisma.user.findFirst({
    where: { id: assignedCaId, organizationId: user.organizationId },
  });
  if (!ca) return NextResponse.json({ error: "CA not found" }, { status: 404 });

  const task = await prisma.firmTask.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      customerId,
      assignedCaId,
      dueDate: new Date(dueDate),
      priority: priority ?? "MEDIUM",
      createdById: user.id,
      organizationId: user.organizationId,
    },
  });

  // Notify assigned CA
  await prisma.notification.create({
    data: {
      organizationId: user.organizationId,
      userId: assignedCaId,
      type: "TASK_ASSIGNED",
      title: "New Task Assigned",
      message: `Task "${title}" has been assigned to you for ${customer.name}.`,
      referenceId: task.id,
      referenceType: "firm_task",
    },
  }).catch(() => {});

  await logTaskActivity({
    taskId: task.id,
    actorId: user.id,
    actorName: user.name ?? user.email,
    action: "CREATED",
    toStatus: task.status,
    metadata: { customerName: customer.name },
  });

  return NextResponse.json({ task }, { status: 201 });
}
