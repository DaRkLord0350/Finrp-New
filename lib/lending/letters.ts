// ============================================================
// lib/lending/letters.ts
// Sanction Letter / Offer Letter generation. PDFs render on demand
// from the persisted data snapshot (see lib/pdf/generateInvoicePdf.ts's
// header comment: "PDFs are NEVER written to disk" — serverless file
// systems are read-only). fileUrl therefore stores FinRP's OWN
// streaming endpoint path, not an external object-storage URL;
// contentHash anchors integrity on the underlying data snapshot.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { LoanLetterType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";
import { toFixed2 } from "./core/money";

export interface LetterSnapshot {
  applicationNumber: string;
  customerName: string;
  productName: string;
  approvedAmount: string;
  approvedTenureMonths: number;
  interestRateOffered: string;
  emiAmount: string;
  processingFee: string;
  issuedAt: string;
}

function buildSnapshot(app: {
  applicationNumber: string;
  approvedAmount: unknown;
  approvedTenureMonths: number | null;
  interestRateOffered: unknown;
  emiAmount: unknown;
  customer: { name: string };
  product: { name: string; processingFeePercent: unknown; processingFeeFlat: unknown };
}): LetterSnapshot {
  const approvedAmount = app.approvedAmount as { toString(): string } | null;
  const processingFee =
    approvedAmount && app.product.processingFeePercent
      ? toFixed2(
          (Number(approvedAmount.toString()) * Number(app.product.processingFeePercent)) / 100 +
            Number(app.product.processingFeeFlat ?? 0)
        )
      : "0.00";

  return {
    applicationNumber: app.applicationNumber,
    customerName: app.customer.name,
    productName: app.product.name,
    approvedAmount: toFixed2(approvedAmount?.toString() ?? "0"),
    approvedTenureMonths: app.approvedTenureMonths ?? 0,
    interestRateOffered: (app.interestRateOffered as { toString(): string } | null)?.toString() ?? "0",
    emiAmount: toFixed2((app.emiAmount as { toString(): string } | null)?.toString() ?? "0"),
    processingFee,
    issuedAt: new Date().toISOString(),
  };
}

function pdfPathFor(applicationId: string, letterId: string) {
  return `/api/lending/applications/${applicationId}/letters/${letterId}/pdf`;
}

async function issueLetter(applicationId: string, organizationId: string, type: LoanLetterType, actor: { userId: string }) {
  const app = await prisma.loanApplication.findFirst({
    where: { id: applicationId, organizationId, deletedAt: null },
    include: { customer: true, product: true },
  });
  if (!app) throw new workflow.LoanNotFoundError();
  if (!["APPROVED", "SANCTIONED"].includes(app.status)) {
    throw new workflow.LoanWorkflowError(`Cannot issue a ${type} for an application with status ${app.status}`);
  }

  const previousVersion = await prisma.loanGeneratedLetter.count({ where: { applicationId: app.id, type } });
  const snapshot = buildSnapshot(app);
  const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

  const letter = await prisma.loanGeneratedLetter.create({
    data: {
      applicationId: app.id,
      organizationId,
      type,
      version: previousVersion + 1,
      fileUrl: "", // patched below once we have the letter id
      contentHash,
      status: "ISSUED",
      issuedAt: new Date(),
      issuedById: actor.userId,
    },
  });
  const updated = await prisma.loanGeneratedLetter.update({
    where: { id: letter.id },
    data: { fileUrl: pdfPathFor(app.id, letter.id) },
  });

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.letter",
    entityId: letter.id,
    description: `Issued ${type} v${letter.version} for loan application ${app.applicationNumber}`,
  });
  return { letter: updated, snapshot };
}

export async function issueSanctionLetter(applicationId: string, organizationId: string, actor: workflow.LoanActor) {
  const { letter } = await issueLetter(applicationId, organizationId, "SANCTION_LETTER", actor);
  await workflow.markSanctionIssued({ applicationId, organizationId, actor });
  return letter;
}

export async function issueOfferLetter(applicationId: string, organizationId: string, actor: { userId: string }) {
  const { letter } = await issueLetter(applicationId, organizationId, "OFFER_LETTER", actor);
  return letter;
}

export async function acceptOfferLetter(letterId: string, organizationId: string) {
  const letter = await prisma.loanGeneratedLetter.findFirst({ where: { id: letterId, organizationId, type: "OFFER_LETTER" } });
  if (!letter) throw new workflow.LoanNotFoundError("Offer letter not found");
  return prisma.loanGeneratedLetter.update({
    where: { id: letter.id },
    data: { status: "ACCEPTED", acceptedByCustomer: true, acceptedAt: new Date() },
  });
}

export async function getLetterSnapshot(letterId: string, organizationId: string): Promise<{ type: LoanLetterType; snapshot: LetterSnapshot; version: number }> {
  const letter = await prisma.loanGeneratedLetter.findFirst({
    where: { id: letterId, organizationId },
    include: { application: { include: { customer: true, product: true } } },
  });
  if (!letter) throw new workflow.LoanNotFoundError("Letter not found");
  return { type: letter.type, snapshot: buildSnapshot(letter.application), version: letter.version };
}

export async function listLetters(applicationId: string, organizationId: string) {
  return prisma.loanGeneratedLetter.findMany({ where: { applicationId, organizationId }, orderBy: { createdAt: "desc" } });
}
