import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { uploadDocument, getCaseDetail } from "@/lib/verification/case-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "verification.read" });
    const { id } = await params;
    const kase = await getCaseDetail(id, organizationId);
    return NextResponse.json({ documents: kase.documents });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_DOCUMENTS_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "verification.initiate" });
    const { id } = await params;
    const body = await req.json();
    if (!body.docType || !body.fileName || !body.fileUrl || !body.fileSize || !body.mimeType) {
      return NextResponse.json({ error: "docType, fileName, fileUrl, fileSize, and mimeType are required" }, { status: 400 });
    }
    const doc = await uploadDocument(id, organizationId, body, { userId });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_DOCUMENTS_POST");
  }
}
