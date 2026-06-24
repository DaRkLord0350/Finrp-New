// ============================================================
// POST /api/customers/[id]/resend-invite
//
// CA-portal action on a customer's profile page. Most clients here
// were added as a bare CRM Customer record (POST /api/firm/customers)
// which never creates a CustomerInvitation — so there's nothing to
// "resend" yet. This route covers both cases:
//   - No invitation ever existed → create + send the first one.
//   - PENDING/SENT/EXPIRED → refresh expiry and resend.
//   - ACCEPTED → reject, nothing to do.
//
// RBAC: CA must be actively assigned to the customer (ADMIN bypasses).
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import {
  createCustomerInvitation,
  resendCustomerInvitation,
  type InviteActor,
} from "@/lib/customer-invitations/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await params;

  const allowed = isAdmin(user) || (await isCustomerAssignedTo(user.id, customerId));
  if (!allowed) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!customer.email) {
    return NextResponse.json(
      { error: "This client has no email on file — add one before sending an invite" },
      { status: 400 }
    );
  }

  const actor: InviteActor = {
    id: user.id,
    organizationId: user.organizationId,
    firmId: user.firmId,
    name: user.name,
    email: user.email,
    userRole: user.userRole,
  };

  const latest = await prisma.customerInvitation.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });

  const result = !latest
    ? await createCustomerInvitation(actor, {
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        company: customer.company,
        customerId: customer.id,
      })
    : latest.status === "ACCEPTED"
      ? { ok: false as const, status: 409, error: "This client has already accepted their invitation" }
      : await resendCustomerInvitation(actor, latest.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ invitation: result.data });
}
