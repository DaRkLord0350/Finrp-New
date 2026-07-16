// ============================================================
// lib/lending/agreements.ts
// Digital Loan Agreement + eSign, built on the EXISTING SignatureRequest
// / SignatureEvent models (components/... eSign pages already write to
// these) rather than a new bespoke signing model. One SignatureRequest
// per required signatory (borrower, co-applicants, guarantors, lender
// authorized signatory) — SignatureRequest is single-signer-per-row,
// which maps naturally onto multi-party signing.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { LoanSignatoryRole, SignatureStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";

function agreementPdfPathFor(applicationId: string, agreementId: string) {
  return `/api/lending/applications/${applicationId}/agreements/${agreementId}/pdf`;
}

export async function createAgreement(applicationId: string, organizationId: string, actor: { userId: string }) {
  const app = await prisma.loanApplication.findFirst({
    where: { id: applicationId, organizationId, deletedAt: null },
    include: { customer: true, coApplicants: true },
  });
  if (!app) throw new workflow.LoanNotFoundError();
  if (app.stage !== "AGREEMENT") {
    throw new workflow.LoanWorkflowError(`Cannot draft an agreement for an application at stage ${app.stage}`);
  }

  const previousVersion = await prisma.loanAgreement.count({ where: { applicationId: app.id } });
  const snapshot = {
    applicationNumber: app.applicationNumber,
    approvedAmount: app.approvedAmount?.toString(),
    approvedTenureMonths: app.approvedTenureMonths,
    interestRateOffered: app.interestRateOffered?.toString(),
  };
  const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

  const agreement = await prisma.loanAgreement.create({
    data: {
      applicationId: app.id,
      organizationId,
      version: previousVersion + 1,
      fileUrl: "",
      contentHash,
      status: "DRAFT",
    },
  });
  await prisma.loanAgreement.update({ where: { id: agreement.id }, data: { fileUrl: agreementPdfPathFor(app.id, agreement.id) } });

  const signatories: { role: LoanSignatoryRole; name: string; email: string; phone?: string; order: number }[] = [
    { role: "BORROWER", name: app.customer.name, email: app.customer.email ?? "", phone: app.customer.phone ?? undefined, order: 1 },
    ...app.coApplicants.map((c, i) => ({
      role: (c.role === "GUARANTOR" ? "GUARANTOR" : "CO_APPLICANT") as LoanSignatoryRole,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? undefined,
      order: i + 2,
    })),
  ];

  await prisma.loanAgreementSignatory.createMany({
    data: signatories.map((s) => ({
      agreementId: agreement.id,
      role: s.role,
      name: s.name,
      email: s.email,
      phone: s.phone,
      order: s.order,
      status: "PENDING" as const,
    })),
  });

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.agreement",
    entityId: agreement.id,
    description: `Drafted loan agreement v${agreement.version} for loan application ${app.applicationNumber}`,
  });

  return prisma.loanAgreement.findUniqueOrThrow({ where: { id: agreement.id }, include: { signatories: true } });
}

export async function sendForSignature(agreementId: string, organizationId: string, actor: { userId: string }) {
  const agreement = await prisma.loanAgreement.findFirst({
    where: { id: agreementId, organizationId },
    include: { signatories: true },
  });
  if (!agreement) throw new workflow.LoanNotFoundError("Agreement not found");
  if (agreement.status !== "DRAFT") {
    throw new workflow.LoanWorkflowError(`Cannot send an agreement with status ${agreement.status}`);
  }

  for (const signatory of agreement.signatories) {
    if (!signatory.email) continue; // no email on file — left PENDING, sent manually later
    const sigRequest = await prisma.signatureRequest.create({
      data: {
        organizationId,
        title: `Loan Agreement — ${signatory.role}`,
        documentUrl: agreement.fileUrl,
        signerEmail: signatory.email,
        signerName: signatory.name,
        status: "SENT",
        sentAt: new Date(),
        createdById: actor.userId,
      },
    });
    await prisma.loanAgreementSignatory.update({
      where: { id: signatory.id },
      data: { signatureRequestId: sigRequest.id, status: "SENT" },
    });
  }

  const updated = await prisma.loanAgreement.update({
    where: { id: agreement.id },
    data: { status: "SENT_FOR_SIGNATURE", sentAt: new Date() },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.agreement",
    entityId: agreement.id,
    description: "Sent loan agreement for signature",
  });
  return updated;
}

const SIGNATURE_STATUS_MAP: Record<SignatureStatus, "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED"> = {
  PENDING: "PENDING",
  SENT: "SENT",
  VIEWED: "VIEWED",
  SIGNED: "SIGNED",
  REJECTED: "DECLINED",
  EXPIRED: "DECLINED",
  CANCELLED: "DECLINED",
};

/**
 * Pull-based sync: reads each signatory's linked SignatureRequest and
 * mirrors its status. Once every signatory is SIGNED, the agreement is
 * fully executed and the workflow advances AGREEMENT → DISBURSEMENT.
 * Called on-demand (agreement detail view) and by the polling Inngest
 * job in inngest/functions/lending.ts.
 */
export async function syncSignatoryStatuses(agreementId: string, organizationId: string, actor: workflow.LoanActor) {
  const agreement = await prisma.loanAgreement.findFirst({
    where: { id: agreementId, organizationId },
    include: { signatories: { include: { signatureRequest: true } } },
  });
  if (!agreement) throw new workflow.LoanNotFoundError("Agreement not found");
  if (agreement.status !== "SENT_FOR_SIGNATURE" && agreement.status !== "PARTIALLY_SIGNED") return agreement;

  await Promise.all(
    agreement.signatories
      .filter((s) => s.signatureRequest && SIGNATURE_STATUS_MAP[s.signatureRequest.status] !== s.status)
      .map((s) =>
        prisma.loanAgreementSignatory.update({
          where: { id: s.id },
          data: {
            status: SIGNATURE_STATUS_MAP[s.signatureRequest!.status],
            signedAt: s.signatureRequest!.status === "SIGNED" ? (s.signatureRequest!.signedAt ?? new Date()) : undefined,
          },
        })
      )
  );

  const refreshed = await prisma.loanAgreement.findUniqueOrThrow({ where: { id: agreement.id }, include: { signatories: true } });
  const allSigned = refreshed.signatories.every((s) => s.status === "SIGNED");
  const anySigned = refreshed.signatories.some((s) => s.status === "SIGNED");

  if (allSigned) {
    const executed = await prisma.loanAgreement.update({
      where: { id: agreement.id },
      data: { status: "EXECUTED", fullySignedAt: new Date(), executedAt: new Date() },
    });
    await workflow.markAgreementExecuted({ applicationId: agreement.applicationId, organizationId, actor });
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "APPROVE",
      entity: "loan.agreement",
      entityId: agreement.id,
      description: "Loan agreement fully executed — all signatories signed",
    });
    return executed;
  }

  if (anySigned && refreshed.status !== "PARTIALLY_SIGNED") {
    return prisma.loanAgreement.update({ where: { id: agreement.id }, data: { status: "PARTIALLY_SIGNED" } });
  }
  return refreshed;
}

export async function getAgreement(agreementId: string, organizationId: string) {
  const agreement = await prisma.loanAgreement.findFirst({
    where: { id: agreementId, organizationId },
    include: { signatories: true, application: { include: { customer: true, product: true } } },
  });
  if (!agreement) throw new workflow.LoanNotFoundError("Agreement not found");
  return agreement;
}
