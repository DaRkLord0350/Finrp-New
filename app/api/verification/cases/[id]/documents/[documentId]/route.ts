import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { setDocumentStatus } from "@/lib/verification/case-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "verification.review" });
    const { documentId } = await params;
    const { action } = await req.json();

    if (action !== "verify" && action !== "reject") {
      return NextResponse.json({ error: "action must be 'verify' or 'reject'" }, { status: 400 });
    }
    const document = await setDocumentStatus(documentId, organizationId, action === "verify" ? "VERIFIED" : "REJECTED", { userId });
    return NextResponse.json({ document });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_DOCUMENT_PATCH");
  }
}
