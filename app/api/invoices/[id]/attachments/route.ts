// ============================================================
// GET  /api/invoices/[id]/attachments       — list attachment metadata
// POST /api/invoices/[id]/attachments        — upload (multipart/form-data, field "file")
// ============================================================

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { invoiceAttachmentService } from "@/lib/invoices/attachments";
import { logInvoiceActivity } from "@/lib/invoices/activity";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const attachments = await invoiceAttachmentService.list(id, organizationId);
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[INVOICE_ATTACHMENTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let user: { id: string; name: string | null };
    let organizationId: string;
    try {
      ({ user, organizationId } = await requirePermission("invoices.write"));
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const attachment = await invoiceAttachmentService.upload({
      invoiceId: id,
      organizationId,
      file,
      uploadedById: user.id,
    });

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "UPDATED",
      message: `Attachment "${attachment.fileName}" added`,
      metadata: { fileName: attachment.fileName, fileSize: attachment.fileSize },
      actorId: user.id,
      actorName: user.name,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[INVOICE_ATTACHMENTS_POST]", error);
    const status = msg.includes("not allowed") || msg.includes("exceeds") ? 422 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
