import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { hasActionPermission } from "@/lib/auth/rbac";
import { invalidateUserCache } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only roles that can manage users may read the team roster.
    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || !hasActionPermission(actor.role, "users", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [members, invitations] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          department: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invitation.findMany({
        where: {
          organizationId: tenantId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ members, invitations });
  } catch (error) {
    console.error("[SETTINGS_USERS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser || !hasActionPermission(dbUser.role, "users", "manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json({ error: "memberId and role required" }, { status: 400 });
    }

    const validRoles = ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // SECURITY: a user can never change their own role (privilege escalation).
    if (memberId === dbUser.id) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 403 }
      );
    }

    // Only an OWNER may grant the OWNER role (no self-promotion by ADMINs).
    if (role === "OWNER" && dbUser.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the Owner can assign the Owner role" },
        { status: 403 }
      );
    }

    // Validate target belongs to the SAME organization (tenant isolation).
    const target = await prisma.user.findFirst({
      where: { id: memberId, organizationId: tenantId },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Cannot change the role of an existing OWNER unless you are the OWNER.
    if (target.role === "OWNER" && dbUser.role !== "OWNER") {
      return NextResponse.json({ error: "Cannot change Owner role" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: memberId },
      data: { role },
    });

    // Bust the target's cached session so the new role takes effect on
    // their next request (sidebar, page guards, API permission checks).
    await invalidateUserCache(target.clerkId);

    await createAuditLog({
      organizationId: tenantId,
      userId: dbUser.id,
      action: "UPDATE",
      entity: "user.role",
      entityId: target.id,
      description: `Changed role of ${target.email} from ${target.role} to ${role}`,
      oldValue: { role: target.role },
      newValue: { role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_USERS_PATCH]", error);
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
    if (!dbUser || !hasActionPermission(dbUser.role, "users", "manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

    const target = await prisma.user.findFirst({
      where: { id: memberId, organizationId: tenantId },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove Owner" }, { status: 403 });
    }
    if (target.id === dbUser.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    // Bust the target's cached session so deactivation takes effect
    // immediately (requireTenant rejects inactive users with 403).
    await invalidateUserCache(target.clerkId);

    await createAuditLog({
      organizationId: tenantId,
      userId: dbUser.id,
      action: "DELETE",
      entity: "user",
      entityId: target.id,
      description: `Removed member ${target.email} (role ${target.role})`,
      oldValue: { email: target.email, role: target.role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_USERS_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
