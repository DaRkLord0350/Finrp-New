// ============================================================
// POST /api/portal/conversations/[id]/read
//   Mark all messages addressed to the current user as read.
// ============================================================

import { NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { markConversationRead } from "@/lib/client-portal/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const firm = await requireFirmSide();
  if (firm) {
    const r = await markConversationRead(firm.organizationId, id, firm.id);
    return NextResponse.json(r.ok ? { read: r.data.count } : { error: "Failed" });
  }

  const customer = await requireCustomer();
  if (customer) {
    const r = await markConversationRead(customer.ctx.organizationId, id, customer.actor.id);
    return NextResponse.json(r.ok ? { read: r.data.count } : { error: "Failed" });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
