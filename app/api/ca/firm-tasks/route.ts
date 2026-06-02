import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole === "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CRITICAL: only return tasks assigned to this CA
  const tasks = await prisma.firmTask.findMany({
    where: { assignedCaId: user.id },
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json({ tasks });
}
