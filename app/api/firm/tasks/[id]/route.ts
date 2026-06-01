import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getFirmUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || !["CA_FIRM_ADMIN", "CA"].includes(user.userRole)) return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body;

  const task = await prisma.firmTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // CA can only update their own tasks
  if (user.userRole === "CA" && task.assignedCaId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Firm admin can update any task in their org
  if (user.userRole === "CA_FIRM_ADMIN" && task.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.firmTask.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(status === "COMPLETED" && { completedAt: new Date() }),
    },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmUser();
  if (!user || user.userRole !== "CA_FIRM_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.firmTask.findUnique({ where: { id } });
  if (!task || task.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.firmTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
