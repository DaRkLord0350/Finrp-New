import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const task = await prisma.complianceTask.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    console.error("[COMPLIANCE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // If marking complete, set completedAt
    if (body.status === "COMPLETED" && !body.completedAt) {
      body.completedAt = new Date().toISOString();
    }

    const task = await prisma.complianceTask.updateMany({
      where: { id, organizationId: orgId },
      data: body,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("[COMPLIANCE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.complianceTask.deleteMany({
      where: { id, organizationId: orgId },
    });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("[COMPLIANCE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
