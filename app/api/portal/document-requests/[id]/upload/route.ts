// ============================================================
// POST /api/portal/document-requests/[id]/upload
//   Customer uploads a document fulfilling a request.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/client-portal/auth";
import { uploadDocument } from "@/lib/client-portal/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await requireCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.fileName || !body?.fileUrl) {
    return NextResponse.json({ error: "fileName and fileUrl are required" }, { status: 400 });
  }

  const result = await uploadDocument({
    organizationId: customer.ctx.organizationId,
    customerId: customer.ctx.customerId,
    requestId: id,
    uploadedById: customer.actor.id,
    file: {
      fileName: String(body.fileName),
      fileUrl: String(body.fileUrl),
      mimeType: body.mimeType ?? null,
      fileSize: typeof body.fileSize === "number" ? body.fileSize : null,
    },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ upload: result.data }, { status: 201 });
}
