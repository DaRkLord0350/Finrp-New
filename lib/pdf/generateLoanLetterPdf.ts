// ============================================================
// lib/pdf/generateLoanLetterPdf.ts
// In-memory PDF generation for Sanction/Offer letters — never written
// to disk, mirrors lib/pdf/generateInvoicePdf.ts's contract exactly.
// ============================================================

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { LoanLetterPDF } from "@/components/pdf/LoanLetterPDF";
import { getLetterSnapshot } from "@/lib/lending/letters";
import { pdfFileNameFor } from "./generateInvoicePdf";

export async function renderLoanLetterPdfBuffer(
  letterId: string,
  organizationId: string
): Promise<{ buffer: Buffer; pdfFileName: string }> {
  const { type, snapshot, version } = await getLetterSnapshot(letterId, organizationId);
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });

  const doc = React.createElement(LoanLetterPDF, {
    data: {
      letterTitle: type === "SANCTION_LETTER" ? "Sanction Letter" : "Offer Letter",
      lenderName: org?.name ?? "Lender",
      applicationNumber: snapshot.applicationNumber,
      customerName: snapshot.customerName,
      productName: snapshot.productName,
      approvedAmount: snapshot.approvedAmount,
      approvedTenureMonths: snapshot.approvedTenureMonths,
      interestRateOffered: snapshot.interestRateOffered,
      emiAmount: snapshot.emiAmount,
      processingFee: snapshot.processingFee,
      issuedAt: new Date(snapshot.issuedAt).toLocaleDateString("en-IN"),
      version,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  return { buffer, pdfFileName: pdfFileNameFor(`${snapshot.applicationNumber}-${type.toLowerCase()}`) };
}
