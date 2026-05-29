import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceDocumentService } from "@/services/compliance/complianceDocumentService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const { id } = await params;

    const doc = await complianceDocumentService.downloadById(id, organizationId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`
    );
    headers.set("Content-Length", String(doc.fileSize));
    headers.set("X-File-Checksum", doc.checksum);
    headers.set("Cache-Control", "private, no-store");

    return new Response(doc.binaryData, { headers });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_DOC_DOWNLOAD]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const { id } = await params;

    await complianceDocumentService.delete(id, organizationId, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[COMPLIANCE_DOC_DELETE]", err);
    return NextResponse.json({ error: msg }, { status: msg === "Document not found" ? 404 : 500 });
  }
}
