// ============================================================
// /api/ca/customers/invite/[id]
//   DELETE → cancel (revoke) a pending/sent customer invitation
//
// RBAC: any firm member (CA or CA_FIRM_ADMIN), scoped to their org.
// ============================================================

import { NextResponse } from "next/server";
import { getFirmMemberApi } from "@/lib/auth/firm-admin";
import { cancelCustomerInvitation } from "@/lib/customer-invitations/service";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmMemberApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await cancelCustomerInvitation(
    {
      id: user.id,
      organizationId: user.organizationId,
      firmId: user.firmId,
      name: user.name,
      email: user.email,
      userRole: user.userRole,
    },
    id
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ invitation: result.data });
}
