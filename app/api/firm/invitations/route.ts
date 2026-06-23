// ============================================================
// /api/firm/invitations
//   GET → firm-wide invitation overview:
//         • CA / team invitations (active members + pending invites)
//         • customer onboarding invitations + funnel counts
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextResponse } from "next/server";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { getTeamRoster } from "@/lib/team/queries";
import { customerInvitationRepository as repo } from "@/lib/repositories/customer-invitation.repository";

export async function GET() {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [team, customerInvitations, funnel] = await Promise.all([
    getTeamRoster(admin.organizationId),
    repo.list(admin.organizationId),
    repo.funnel(admin.organizationId),
  ]);

  return NextResponse.json({
    team: {
      members: team.members,
      invites: team.invites,
    },
    customers: {
      invitations: customerInvitations,
      funnel,
    },
  });
}
