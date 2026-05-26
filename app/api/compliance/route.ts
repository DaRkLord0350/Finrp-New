import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (req, { organizationId }) => {
    const tasks = await prisma.complianceTask.findMany({
      where: { organizationId },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(tasks);
  },
  "compliance.read"
);

export const POST = withAuth(
  async (req, { organizationId }) => {
    const body = await req.json();
    const { title, description, category = "OTHER", dueDate } = body;

    if (!title || !dueDate) {
      return NextResponse.json({ error: "Title and dueDate are required" }, { status: 400 });
    }

    const task = await prisma.complianceTask.create({
      data: {
        title,
        description,
        category,
        dueDate: new Date(dueDate),
        organizationId,
      },
    });

    return NextResponse.json(task, { status: 201 });
  },
  "compliance.write"
);
