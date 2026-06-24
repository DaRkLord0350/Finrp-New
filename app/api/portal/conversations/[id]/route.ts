// ============================================================
// GET /api/portal/conversations/[id]
//   Fetch a conversation with its full message thread.
// ============================================================

import { NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { getConversation } from "@/lib/client-portal/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const firm = await requireFirmSide();
  const organizationId = firm
    ? firm.organizationId
    : (await requireCustomer())?.ctx.organizationId;
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await getConversation(organizationId, id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json({ conversation });
}
