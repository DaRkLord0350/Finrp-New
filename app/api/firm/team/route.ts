// ============================================================
// /api/firm/team
//   GET  → full roster (members + pending invites + activity)
//   POST → add a team member (creates a pending Invitation; the
//          Clerk webhook provisions the User into this firm's org
//          when they sign up with the invited email)
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { getTeamRoster } from "@/lib/team/queries";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import {
  firmRoleToUserRole,
  firmRoleToOrgRole,
  FIRM_MEMBER_ROLES,
  FIRM_PERMISSIONS,
  SPECIALIZATIONS,
  FIRM_ROLE_LABELS,
  EMAIL_REGEX,
} from "@/lib/team/constants";
import { notifyTeamInvite } from "@/lib/notifications";
import { trackedInviteUrl } from "@/lib/firm/onboarding";
import type { FirmMemberRole, Specialization, FirmPermission } from "@prisma/client";

export async function GET() {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roster = await getTeamRoster(admin.organizationId);
  return NextResponse.json(roster);
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const firmRole = body.firmRole as FirmMemberRole | undefined;
  const specialization = (body.specialization ?? null) as Specialization | null;
  const joiningDate = body.joiningDate ? new Date(body.joiningDate) : null;
  const sendInvite = body.sendInvite !== false; // default true
  const firmPermissions: FirmPermission[] = Array.isArray(body.firmPermissions)
    ? (body.firmPermissions as string[]).filter((p): p is FirmPermission =>
        (FIRM_PERMISSIONS as string[]).includes(p)
      )
    : [];
  const managerId = body.managerId ? String(body.managerId).trim() : null;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email || !EMAIL_REGEX.test(email))
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  if (!firmRole || !FIRM_MEMBER_ROLES.includes(firmRole))
    return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
  if (specialization && !SPECIALIZATIONS.includes(specialization))
    return NextResponse.json({ error: "Invalid specialization" }, { status: 400 });
  if (joiningDate && isNaN(joiningDate.getTime()))
    return NextResponse.json({ error: "Invalid joining date" }, { status: 400 });

  // Optional reporting manager must be a member of the same firm org.
  if (managerId) {
    const mgr = await prisma.user.findFirst({
      where: { id: managerId, organizationId: admin.organizationId },
      select: { id: true },
    });
    if (!mgr)
      return NextResponse.json({ error: "Assigned manager must be a member of your firm" }, { status: 400 });
  }

  // Duplicate detection — existing user or pending invite in this firm.
  const existingUser = await prisma.user.findFirst({
    where: { organizationId: admin.organizationId, email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser)
    return NextResponse.json({ error: "A team member with this email already exists" }, { status: 409 });

  const existingInvite = await prisma.invitation.findFirst({
    where: {
      organizationId: admin.organizationId,
      email: { equals: email, mode: "insensitive" },
      status: { in: ["PENDING", "SENT"] },
    },
    select: { id: true },
  });
  if (existingInvite)
    return NextResponse.json({ error: "A pending invite already exists for this email" }, { status: 409 });

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Seat is created PENDING; it flips to SENT only after a confirmed
  // email dispatch below (so the UI never shows "Sent" for an email
  // that never left the server).
  const invite = await prisma.invitation.create({
    data: {
      organizationId: admin.organizationId,
      email,
      role: firmRoleToOrgRole(firmRole),
      userRole: firmRoleToUserRole(firmRole),
      firmRole,
      specialization,
      name,
      phone,
      joiningDate,
      firmPermissions,
      managerId,
      firmId: admin.firmId,
      invitedBy: admin.id,
      status: "PENDING",
      expiresAt,
    },
  });

  console.log("[INVITE] Created team invitation", {
    invitationId: invite.id,
    email,
    organizationId: admin.organizationId,
    sendInvite,
  });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetEmail: email,
    action: "MEMBER_INVITED",
    metadata: { name, firmRole, specialization: specialization ?? null, sent: sendInvite },
    ipAddress: clientIpFrom(req),
  });

  let emailSent = false;
  let emailError: string | null = null;
  let messageId: string | undefined;

  if (sendInvite) {
    const org = await prisma.organization.findUnique({
      where: { id: admin.organizationId },
      select: { name: true, businessProfile: { select: { businessName: true } } },
    });
    const firmName = org?.businessProfile?.businessName ?? org?.name ?? "your firm";

    // Await the send (Vercel serverless freezes the function after the
    // response returns — fire-and-forget email work would be killed).
    const result = await notifyTeamInvite({
      organizationId: admin.organizationId,
      recipientEmail: email,
      recipientName: name,
      firmName,
      inviterName: admin.name ?? admin.email,
      role: FIRM_ROLE_LABELS[firmRole],
      inviteUrl: trackedInviteUrl(invite.token),
    });

    emailSent = result.success;
    emailError = result.success ? null : result.error ?? "Email failed to send";
    messageId = result.id;

    await prisma.invitation.update({
      where: { id: invite.id },
      data: result.success
        ? { status: "SENT", emailSentAt: new Date(), emailMessageId: result.id ?? null, emailError: null }
        : { emailError: emailError },
    });
  }

  return NextResponse.json(
    {
      invite: { id: invite.id, status: emailSent ? "SENT" : "PENDING" },
      emailSent,
      emailError,
      messageId,
    },
    { status: 201 }
  );
}
