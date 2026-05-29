import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        avatarUrl: true,
        role: true,
        lastLoginAt: true,
        notificationPreference: true,
        createdAt: true,
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error("[SETTINGS_PROFILE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, phone, designation, department, avatarUrl } = body;

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(designation !== undefined && { designation: designation?.trim() || null }),
        ...(department !== undefined && { department: department?.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        avatarUrl: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: tenantId,
        userId: updated.id,
        action: "SETTINGS_CHANGE",
        entity: "user",
        entityId: updated.id,
        description: "Updated profile settings",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[SETTINGS_PROFILE_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
