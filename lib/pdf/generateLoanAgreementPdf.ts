// ============================================================
// lib/pdf/generateLoanAgreementPdf.ts
// In-memory PDF generation for the Loan Agreement — never written to
// disk, mirrors lib/pdf/generateInvoicePdf.ts's contract exactly.
// ============================================================

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { LoanAgreementPDF } from "@/components/pdf/LoanAgreementPDF";
import { getAgreement } from "@/lib/lending/agreements";
import { pdfFileNameFor } from "./generateInvoicePdf";

export async function renderLoanAgreementPdfBuffer(
  agreementId: string,
  organizationId: string
): Promise<{ buffer: Buffer; pdfFileName: string }> {
  const agreement = await getAgreement(agreementId, organizationId);
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });

  const doc = React.createElement(LoanAgreementPDF, {
    data: {
      lenderName: org?.name ?? "Lender",
      applicationNumber: agreement.application.applicationNumber,
      customerName: agreement.application.customer.name,
      productName: agreement.application.product.name,
      approvedAmount: agreement.application.approvedAmount?.toString() ?? "0",
      approvedTenureMonths: agreement.application.approvedTenureMonths ?? 0,
      interestRateOffered: agreement.application.interestRateOffered?.toString() ?? "0",
      version: agreement.version,
      signatories: agreement.signatories.map((s) => ({ role: s.role, name: s.name, status: s.status })),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  return { buffer, pdfFileName: pdfFileNameFor(`${agreement.application.applicationNumber}-agreement`) };
}
