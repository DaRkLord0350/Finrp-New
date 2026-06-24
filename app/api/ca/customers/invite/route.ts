// ============================================================
// /api/ca/customers/invite
//   GET  → list customer invitations (CA sees own; firm admin sees all)
//   POST → invite a customer to onboard (creates + emails an invite)
//
// RBAC: any firm member (CA or CA_FIRM_ADMIN), scoped to their org.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getFirmMemberApi } from "@/lib/auth/firm-admin";
import { customerInvitationRepository as repo } from "@/lib/repositories/customer-invitation.repository";
import {
  createCustomerInvitation,
  type InviteActor,
} from "@/lib/customer-invitations/service";

function toActor(user: {
  id: string;
  organizationId: string;
  firmId: string | null;
  name: string | null;
  email: string;
  userRole: string | null;
}): InviteActor {
  return {
    id: user.id,
    organizationId: user.organizationId,
    firmId: user.firmId,
    name: user.name,
    email: user.email,
    userRole: user.userRole,
  };
}

export async function GET() {
  const user = await getFirmMemberApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Firm admins see every invite in the org; a CA sees only theirs.
  const caId = user.userRole === "CA_FIRM_ADMIN" ? undefined : user.id;
  const [invitations, funnel] = await Promise.all([
    repo.list(user.organizationId, { caId }),
    repo.funnel(user.organizationId),
  ]);

  return NextResponse.json({ invitations, funnel });
}

export async function POST(req: NextRequest) {
  const user = await getFirmMemberApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const result = await createCustomerInvitation(toActor(user), {
    email: body.email,
    name: body.name,
    phone: body.phone,
    company: body.company,
    message: body.message,
    assignedCaId: body.assignedCaId,
    customerId: body.customerId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ invitation: result.data }, { status: 201 });
}
