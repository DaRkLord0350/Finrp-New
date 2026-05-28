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
    const docs = await complianceDocumentService.getBySubmission(id, organizationId);
    return NextResponse.json(docs);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_DOCS_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const { id: submissionId } = await params;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const documentType = formData.get("documentType")?.toString();
    const description = formData.get("description")?.toString();

    const doc = await complianceDocumentService.upload({
      organizationId,
      submissionId,
      file,
      documentType,
      description,
      uploadedById: user.id,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[COMPLIANCE_DOCS_POST]", err);
    const status =
      msg.includes("not allowed") || msg.includes("exceeds") ? 422 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
