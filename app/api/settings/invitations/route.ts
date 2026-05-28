import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser || !["OWNER", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "email and role required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const validRoles = ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user already exists in this org
    const existingUser = await prisma.user.findFirst({
      where: { email, organizationId: tenantId },
    });
    if (existingUser) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      return NextResponse.json({ error: "Invitation already sent" }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: tenantId,
        email: email.toLowerCase().trim(),
        role,
        expiresAt,
        invitedBy: dbUser.id,
      },
    });

    // TODO: Send invitation email via email provider

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error("[SETTINGS_INVITATIONS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser || !["OWNER", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("id");
    if (!invitationId) return NextResponse.json({ error: "id required" }, { status: 400 });

    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: tenantId },
    });
    if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

    await prisma.invitation.delete({ where: { id: invitationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_INVITATIONS_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
