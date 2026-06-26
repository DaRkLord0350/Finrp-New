// ============================================================
// GET /api/debug/customer-invite/[customerId]
//
// Diagnostic snapshot of a customer's invitation/delivery state —
// the same data the Invite Status card on /ca/clients/[id] reads,
// exposed raw for support/debugging. Never silently succeeds: a
// missing invitation or send failure is reported explicitly.
//
// Access: a signed-in CA/Admin assigned to the customer, OR
// ?key=<DEBUG_EMAIL_SECRET> for probing without a session.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import { customerInviteUrl } from "@/lib/customer-invitations/constants";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;

  const debugSecret = process.env.DEBUG_EMAIL_SECRET?.trim();
  const key = req.nextUrl.searchParams.get("key");
  let authed = Boolean(debugSecret) && key === debugSecret;

  if (!authed) {
    const user = await requireCAApi();
    if (user && (isAdmin(user) || (await isCustomerAssignedTo(user.id, customerId)))) {
      authed = true;
    }
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const invitation = await prisma.customerInvitation.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    customer,
    invitation,
    status: invitation?.status ?? "NOT_INVITED",
    tokenExists: Boolean(invitation?.token),
    emailSentAt: invitation?.sentAt ?? null,
    emailMessageId: invitation?.emailMessageId ?? null,
    emailError: invitation?.emailError ?? null,
    acceptanceUrl: invitation ? customerInviteUrl(invitation.token, invitation.email) : null,
  });
}
