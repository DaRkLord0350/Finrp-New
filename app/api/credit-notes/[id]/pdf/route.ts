export const runtime = "nodejs";

// POST /api/credit-notes/[id]/pdf — generate and store a credit-note PDF
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/auth/tenant";
import { generateCreditNotePdf } from "@/lib/pdf/generateInvoicePdf";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { pdfUrl, pdfFileName } = await generateCreditNotePdf(id, organizationId);
    return NextResponse.json({ pdfUrl, pdfFileName });
  } catch (error) {
    console.error("[CREDIT_NOTE_PDF]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
