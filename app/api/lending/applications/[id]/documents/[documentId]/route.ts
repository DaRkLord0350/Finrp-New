import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { verifyDocument, rejectDocument, deleteDocument } from "@/lib/lending/documents";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.write" });
    const { documentId } = await params;
    const { action, reason } = await req.json();

    const document =
      action === "verify"
        ? await verifyDocument(documentId, organizationId, { userId })
        : action === "reject"
          ? await rejectDocument(documentId, organizationId, reason ?? "Rejected", { userId })
          : null;
    if (!document) return NextResponse.json({ error: "Unknown action — expected 'verify' or 'reject'" }, { status: 400 });
    return NextResponse.json({ document });
  } catch (err) {
    return mapLendingError(err, "LENDING_DOCUMENT_PATCH");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.write" });
    const { documentId } = await params;
    await deleteDocument(documentId, organizationId, { userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapLendingError(err, "LENDING_DOCUMENT_DELETE");
  }
}
