export const runtime = "nodejs";

// ============================================================
// GET/POST /api/credit-notes/[id]/pdf
// Generates the credit-note PDF in memory and streams it back.
// Never touches the filesystem (read-only on serverless).
//
//   ?disposition=inline → inline (print) ; default → attachment (download)
// ============================================================

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/auth/tenant";
import { renderCreditNotePdfBuffer } from "@/lib/pdf/generateInvoicePdf";

async function handle(req: Request, id: string) {
  const organizationId = await getTenantId();
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inline = new URL(req.url).searchParams.get("disposition") === "inline";
  const { buffer, pdfFileName } = await renderCreditNotePdfBuffer(id, organizationId);

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
    console.error("[CREDIT_NOTE_PDF_GET]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed";
    const status = message === "Credit note not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await handle(req, id);
  } catch (error) {
    console.error("[CREDIT_NOTE_PDF_POST]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed";
    const status = message === "Credit note not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
