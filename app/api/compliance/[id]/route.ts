import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const PATCH = withAuth(async (
  req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing compliance task ID" }, { status: 400 });
    }

    const body = await req.json();
    const { status, title, description, dueDate, category } = body;

    const task = await prisma.complianceTask.update({
      where: { id, organizationId },
      data: {
        ...(status && { status }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(category && { category }),
        ...(status === "COMPLETED" && { completedAt: new Date() }),
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("[COMPLIANCE_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "compliance.write");

export const DELETE = withAuth(async (
  _req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing compliance task ID" }, { status: 400 });
    }

    await prisma.complianceTask.delete({ where: { id, organizationId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COMPLIANCE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "compliance.write");
