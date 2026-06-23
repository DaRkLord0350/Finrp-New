// ============================================================
// POST /api/portal/conversations/[id]/messages
//   Send a message (with optional file attachments) in a
//   conversation. Open to both the firm side and the customer.
//   body: { content, subject?, attachments?: [{fileName,fileUrl,...}] }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { sendMessage } from "@/lib/client-portal/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.content) return NextResponse.json({ error: "content is required" }, { status: 400 });

  const attachments = Array.isArray(body.attachments) ? body.attachments : undefined;

  const firm = await requireFirmSide();
  if (firm) {
    const result = await sendMessage(firm, firm.organizationId, {
      conversationId: id,
      content: String(body.content),
      subject: body.subject ?? null,
      attachments,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ message: result.data }, { status: 201 });
  }

  const customer = await requireCustomer();
  if (customer) {
    const result = await sendMessage(customer.actor, customer.ctx.organizationId, {
      conversationId: id,
      content: String(body.content),
      subject: body.subject ?? null,
      attachments,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ message: result.data }, { status: 201 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
