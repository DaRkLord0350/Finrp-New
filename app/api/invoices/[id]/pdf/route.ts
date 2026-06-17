export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/auth/tenant";
import { generateInvoicePdf } from "@/lib/pdf/generateInvoicePdf";
import { logInvoiceActivity } from "@/lib/invoices/activity";

// POST /api/invoices/[id]/pdf — generate and store PDF for an invoice
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { pdfUrl, pdfFileName } = await generateInvoicePdf(id, organizationId);

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "PDF_GENERATED",
      message: "Invoice PDF generated",
      metadata: { pdfFileName },
    });

    return NextResponse.json({ pdfUrl, pdfFileName });
  } catch (error) {
    console.error("[INVOICE_PDF]", error);
    const message =
      error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/invoices/[id]/pdf — re-generate (or return existing) PDF URL
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { pdfUrl, pdfFileName } = await generateInvoicePdf(id, organizationId);

    return NextResponse.json({ pdfUrl, pdfFileName });
  } catch (error) {
    console.error("[INVOICE_PDF_GET]", error);
    const message =
      error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
