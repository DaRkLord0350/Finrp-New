export const runtime = "nodejs";

// ============================================================
// GET/POST /api/invoices/[id]/pdf
// Generates the invoice PDF entirely in memory and streams it back
// to the client. Nothing is ever written to disk (serverless file
// systems such as Vercel's /var/task are read-only).
//
//   ?disposition=inline   → Content-Disposition: inline   (for Print)
//   (default)             → Content-Disposition: attachment (for Download)
//
// On failure, responds with JSON { error } instead of crashing.
// ============================================================

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/auth/tenant";
import { renderInvoicePdfBuffer } from "@/lib/pdf/generateInvoicePdf";
import { logInvoiceActivity } from "@/lib/invoices/activity";

async function handle(req: Request, id: string) {
  const organizationId = await getTenantId();
  if (!organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inline = new URL(req.url).searchParams.get("disposition") === "inline";

  const { buffer, pdfFileName } = await renderInvoicePdfBuffer(id, organizationId);

  // Record the download in the activity timeline (skip for inline/print
  // previews to avoid spamming the timeline on every print dialog).
  if (!inline) {
    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "PDF_GENERATED",
      message: "Invoice PDF downloaded",
      metadata: { pdfFileName },
    }).catch(() => {});
  }

  const disposition = inline ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${pdfFileName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await handle(req, id);
  } catch (error) {
    console.error("[INVOICE_PDF_GET]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed";
    const status = message === "Invoice not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST kept as an alias so older callers keep working; behaves like GET.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await handle(req, id);
  } catch (error) {
    console.error("[INVOICE_PDF_POST]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed";
    const status = message === "Invoice not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
