// ============================================================
// GET /api/track/invite?t=<token>
//
// Invite-link open tracking. Stamps `emailOpenedAt` on the matching
// invitation (team Invitation or CustomerInvitation) the first time
// the recipient engages the link, then 302-redirects to the sign-up
// page. Tracking is best-effort — a failure never blocks the redirect.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/customer-invitations/constants";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t")?.trim();
  const base = appBaseUrl();

  if (!token) {
    return NextResponse.redirect(`${base}/sign-up`);
  }

  let signUpUrl = `${base}/sign-up`;

  try {
    const teamInvite = await prisma.invitation.findUnique({
      where: { token },
      select: { id: true, email: true, emailOpenedAt: true },
    });

    if (teamInvite) {
      if (!teamInvite.emailOpenedAt) {
        await prisma.invitation.update({
          where: { id: teamInvite.id },
          data: { emailOpenedAt: new Date() },
        });
      }
      signUpUrl = `${base}/sign-up?email=${encodeURIComponent(teamInvite.email)}`;
    } else {
      const custInvite = await prisma.customerInvitation.findUnique({
        where: { token },
        select: { id: true, email: true, emailOpenedAt: true },
      });
      if (custInvite) {
        if (!custInvite.emailOpenedAt) {
          await prisma.customerInvitation.update({
            where: { id: custInvite.id },
            data: { emailOpenedAt: new Date() },
          });
        }
        signUpUrl = `${base}/sign-up?email=${encodeURIComponent(custInvite.email)}&invite=${encodeURIComponent(token)}`;
      }
    }
  } catch (err) {
    console.error("[track/invite] failed:", err);
  }

  return NextResponse.redirect(signUpUrl);
}
