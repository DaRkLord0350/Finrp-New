// ============================================================
// /api/portal/conversations
//   GET  → list conversations (firm/CA scoped; customer: own)
//   POST → start a conversation with a customer (firm-side)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { assignedCustomerIds } from "@/lib/client-portal/context";
import { listConversations } from "@/lib/client-portal/queries";
import { createConversation } from "@/lib/client-portal/service";

export async function GET() {
  const firm = await requireFirmSide();
  if (firm) {
    const customerIds = firm.userRole === "CA" ? await assignedCustomerIds(firm.id) : undefined;
    const rows = await listConversations(firm.organizationId, { customerIds });
    return NextResponse.json({ conversations: rows });
  }

  const customer = await requireCustomer();
  if (customer) {
    const rows = await listConversations(customer.ctx.organizationId, {
      customerId: customer.ctx.customerId,
    });
    return NextResponse.json({ conversations: rows });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  const result = await createConversation(actor, actor.organizationId, {
    customerId: String(body.customerId),
    subject: body.subject ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ conversation: result.data }, { status: 201 });
}
