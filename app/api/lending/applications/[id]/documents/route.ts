import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listDocuments, uploadDocument } from "@/lib/lending/documents";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const documents = await listDocuments(id, organizationId);
    return NextResponse.json({ documents });
  } catch (err) {
    return mapLendingError(err, "LENDING_DOCUMENTS_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const body = await req.json();
    const document = await uploadDocument(id, organizationId, body, { userId });
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_DOCUMENTS_POST");
  }
}
