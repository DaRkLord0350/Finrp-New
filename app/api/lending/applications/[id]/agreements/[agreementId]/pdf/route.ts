export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { renderLoanAgreementPdfBuffer } from "@/lib/pdf/generateLoanAgreementPdf";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; agreementId: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { agreementId } = await params;
    const inline = new URL(req.url).searchParams.get("disposition") === "inline";

    const { buffer, pdfFileName } = await renderLoanAgreementPdfBuffer(agreementId, organizationId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdfFileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[LENDING_AGREEMENT_PDF]", error);
    const message = error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 500 });
  }
}
