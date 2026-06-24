// ============================================================
// POST /api/firm/team/import
//   • multipart/form-data (field "file") → VALIDATE: parse + check
//     the workbook and return { valid, errors } for preview.
//   • application/json { rows: ParsedRow[] } → COMMIT: create the
//     invitations in a single transaction (transaction-safe) and
//     fire invite emails. Re-validates server-side and skips any
//     row that became a duplicate / is invalid.
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { FirmMemberRole, Specialization } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { getExistingFirmEmails } from "@/lib/team/queries";
import { parseTeamWorkbook } from "@/lib/team/import";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import { notifyTeamInvite } from "@/lib/notifications";
import {
  firmRoleToUserRole,
  firmRoleToOrgRole,
  FIRM_MEMBER_ROLES,
  SPECIALIZATIONS,
  FIRM_ROLE_LABELS,
  EMAIL_REGEX,
} from "@/lib/team/constants";

function inviteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.finrp.in";
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";

  // ── Step 1: VALIDATE an uploaded workbook ──────────────────
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (file.size > 2 * 1024 * 1024)
      return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });

    const buf = await file.arrayBuffer();
    const existingEmails = await getExistingFirmEmails(admin.organizationId);

    let result;
    try {
      result = parseTeamWorkbook(buf, { existingEmails });
    } catch {
      return NextResponse.json(
        { error: "Could not read the file. Use the .xlsx template." },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  }

  // ── Step 2: COMMIT validated rows ──────────────────────────
  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows) return NextResponse.json({ error: "No rows to import" }, { status: 400 });

  const existingEmails = await getExistingFirmEmails(admin.organizationId);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const seen = new Set<string>();
  const creates: Prisma.InvitationCreateManyInput[] = [];
  const emailJobs: { email: string; name: string; role: string }[] = [];
  let skipped = 0;

  for (const r of rows) {
    const name = String(r?.name ?? "").trim();
    const email = String(r?.email ?? "").trim();
    const phone = r?.phone ? String(r.phone).trim() : null;
    const firmRole = r?.firmRole as FirmMemberRole;
    const specialization = (r?.specialization ?? null) as Specialization | null;
    const key = email.toLowerCase();

    const validRole = !!firmRole && FIRM_MEMBER_ROLES.includes(firmRole);
    const validSpec = !specialization || SPECIALIZATIONS.includes(specialization);
    if (
      !name ||
      !email ||
      !EMAIL_REGEX.test(email) ||
      !validRole ||
      !validSpec ||
      existingEmails.has(key) ||
      seen.has(key)
    ) {
      skipped++;
      continue;
    }

    seen.add(key);
    creates.push({
      organizationId: admin.organizationId,
      email,
      role: firmRoleToOrgRole(firmRole),
      userRole: firmRoleToUserRole(firmRole),
      firmRole,
      specialization,
      name,
      phone,
      firmId: admin.firmId,
      invitedBy: admin.id,
      status: "PENDING",
      expiresAt,
    });
    emailJobs.push({ email, name, role: FIRM_ROLE_LABELS[firmRole] });
  }

  if (creates.length === 0)
    return NextResponse.json({ created: 0, skipped });

  // Transaction-safe bulk insert.
  await prisma.$transaction([
    prisma.invitation.createMany({ data: creates }),
  ]);

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    action: "MEMBERS_IMPORTED",
    metadata: { created: creates.length, skipped },
    ipAddress: clientIpFrom(req),
  });

  // Send invite emails. Await them (serverless kills fire-and-forget
  // work after the response) and flip each successfully-emailed invite
  // to SENT; failures stay PENDING and can be resent individually.
  const org = await prisma.organization.findUnique({
    where: { id: admin.organizationId },
    select: { name: true, businessProfile: { select: { businessName: true } } },
  });
  const firmName = org?.businessProfile?.businessName ?? org?.name ?? "your firm";
  const sendResults = await Promise.allSettled(
    emailJobs.map((j) =>
      notifyTeamInvite({
        organizationId: admin.organizationId,
        recipientEmail: j.email,
        recipientName: j.name,
        firmName,
        inviterName: admin.name ?? admin.email,
        role: j.role,
        inviteUrl: `${inviteBaseUrl()}/sign-up?email=${encodeURIComponent(j.email)}`,
      })
    )
  );

  const sentEmails = emailJobs
    .filter((_, i) => {
      const r = sendResults[i];
      return r.status === "fulfilled" && r.value.success;
    })
    .map((j) => j.email.toLowerCase());
  let emailsSent = 0;
  if (sentEmails.length) {
    const upd = await prisma.invitation.updateMany({
      where: {
        organizationId: admin.organizationId,
        email: { in: sentEmails, mode: "insensitive" },
        status: "PENDING",
      },
      data: { status: "SENT", emailSentAt: new Date(), emailError: null },
    });
    emailsSent = upd.count;
  }

  return NextResponse.json({ created: creates.length, skipped, emailsSent });
}
