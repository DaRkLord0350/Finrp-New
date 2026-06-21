// ============================================================
// GET    /api/invoices/[id]/attachments/[attId]        — stream the file
//        (?download=1 forces a download; otherwise inline for preview)
// DELETE /api/invoices/[id]/attachments/[attId]        — remove the file
// ============================================================

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { invoiceAttachmentService } from "@/lib/invoices/attachments";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; attId: string }> }) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { attId } = await params;
    const file = await invoiceAttachmentService.download(attId, organizationId);
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const download = new URL(req.url).searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";
    const body = new Uint8Array(file.binaryData);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.fileSize),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[INVOICE_ATTACHMENT_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; attId: string }> }) {
  try {
    let organizationId: string;
    try {
      ({ organizationId } = await requirePermission("invoices.write"));
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const { attId } = await params;
    const ok = await invoiceAttachmentService.delete(attId, organizationId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVOICE_ATTACHMENT_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
