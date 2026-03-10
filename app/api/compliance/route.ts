import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tasks = await prisma.complianceTask.findMany({
      where: { organizationId: orgId },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("[COMPLIANCE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        organizationId: orgId,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("[COMPLIANCE_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
