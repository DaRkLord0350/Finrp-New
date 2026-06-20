import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { hasActionPermission } from "@/lib/auth/rbac";
import { createAuditLog } from "@/lib/audit";
import { sendEmail, buildInviteEmail } from "@/lib/notifications/email";
import { appUrl } from "@/lib/url";
import { assertWithinUserLimit, PlanLimitError } from "@/lib/billing/guards";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

export async function POST(req: Request) {
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
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "email and role required" }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const validRoles = ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user already exists in this org
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail, organizationId: tenantId },
    });
    if (existingUser) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    // Reuse a still-valid pending invite (acts as resend + duplicate guard)
    // instead of erroring, so a second click re-delivers the email.
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        organizationId: tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    const isResend = !!existingInvite;

    // Plan limit: a new seat (active members + pending invites) must fit the
    // org's team cap. Resends don't add a seat, so they're exempt.
    if (!isResend) {
      try {
        await assertWithinUserLimit(tenantId);
      } catch (e) {
        if (e instanceof PlanLimitError) {
          return NextResponse.json({ error: e.message, upgradeRequired: true }, { status: 402 });
        }
        throw e;
      }
    }

    const invitation = existingInvite
      ? await prisma.invitation.update({
          where: { id: existingInvite.id },
          // Re-open: refresh expiry and role, and re-arm the acceptance webhook
          // (which keys off status === "PENDING").
          data: { role, expiresAt, status: "PENDING", revokedAt: null },
        })
      : await prisma.invitation.create({
          data: {
            organizationId: tenantId,
            email: normalizedEmail,
            role,
            expiresAt,
            invitedBy: dbUser.id,
            status: "PENDING",
            // Platform-level portal role: a teammate invited from the business
            // dashboard must land in the SAME dashboard (CUSTOMER portal), not
            // the CA portal that the webhook would otherwise default to.
            userRole: "CUSTOMER",
          },
        });

    // ── Send the invitation email (Grant Access) ──────────────────────────
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
      select: { name: true, businessProfile: { select: { businessName: true } } },
    });
    const workspaceName = org?.businessProfile?.businessName ?? org?.name ?? "your workspace";
    const inviterName = dbUser.name ?? dbUser.email;
    const roleLabel = ROLE_LABELS[role] ?? role;
    const inviteUrl = appUrl(`/sign-up?email=${encodeURIComponent(normalizedEmail)}`);
    const subject = `You're invited to join ${workspaceName} on FinRP`;

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject,
      html: buildInviteEmail({ workspaceName, inviterName, roleLabel, inviteUrl }),
    });

    if (!emailResult.success) {
      // Don't leave a phantom "pending" row claiming an email went out.
      // (Keep a pre-existing invite from an earlier successful send.)
      if (!isResend) {
        await prisma.invitation.delete({ where: { id: invitation.id } }).catch(() => {});
      }
      console.error(
        `[SETTINGS_INVITATIONS_POST] Email send failed for ${normalizedEmail} (org ${tenantId}): ${emailResult.error}`
      );
      return NextResponse.json(
        { error: `Couldn't send the invitation email: ${emailResult.error ?? "unknown error"}` },
        { status: 502 }
      );
    }

    console.info(
      `[SETTINGS_INVITATIONS_POST] Invitation ${isResend ? "re-sent" : "sent"} to ${normalizedEmail} (org ${tenantId}, role ${role})`
    );

    await createAuditLog({
      organizationId: tenantId,
      userId: dbUser.id,
      action: "CREATE",
      entity: "invitation",
      entityId: invitation.id,
      description: `${isResend ? "Re-sent" : "Sent"} invitation to ${normalizedEmail} as ${role}`,
      newValue: { email: normalizedEmail, role },
    });

    return NextResponse.json({ ...invitation, resent: isResend }, { status: 201 });
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
    if (!dbUser || !hasActionPermission(dbUser.role, "users", "manage")) {
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
