// ============================================================
// /api/firm/team/invite/[id]
//   POST   → resend (extends expiry, re-sends the invite email)
//   DELETE → revoke (marks the invite REVOKED)
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import { notifyTeamInvite } from "@/lib/notifications";
import { FIRM_ROLE_LABELS } from "@/lib/team/constants";
import type { FirmMemberRole } from "@prisma/client";

function inviteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.finrp.in";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inv = await prisma.invitation.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!inv) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (inv.status === "ACCEPTED")
    return NextResponse.json({ error: "Invite already accepted" }, { status: 400 });

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.invitation.update({
    where: { id },
    // Re-dispatching the email — mark SENT and refresh expiry.
    data: { status: "SENT", expiresAt, revokedAt: null },
  });

  const org = await prisma.organization.findUnique({
    where: { id: admin.organizationId },
    select: { name: true, businessProfile: { select: { businessName: true } } },
  });
  const firmName = org?.businessProfile?.businessName ?? org?.name ?? "your firm";
  notifyTeamInvite({
    organizationId: admin.organizationId,
    recipientEmail: inv.email,
    recipientName: inv.name ?? inv.email,
    firmName,
    inviterName: admin.name ?? admin.email,
    role: inv.firmRole ? FIRM_ROLE_LABELS[inv.firmRole as FirmMemberRole] : "Team Member",
    inviteUrl: `${inviteBaseUrl()}/sign-up?email=${encodeURIComponent(inv.email)}`,
  }).catch(() => {});

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetEmail: inv.email,
    action: "INVITE_RESENT",
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inv = await prisma.invitation.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!inv) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await prisma.invitation.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetEmail: inv.email,
    action: "INVITE_REVOKED",
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true });
}
