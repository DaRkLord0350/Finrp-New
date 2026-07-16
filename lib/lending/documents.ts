// ============================================================
// lib/lending/documents.ts
// Loan application document checklist — upload/verify/reject.
// Follows the same "fileUrl is already-uploaded" convention as
// lib/client-portal/service.ts's uploadDocument: this layer records
// metadata against an application, it does not perform the upload.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { LoanDocumentType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";

export interface UploadLoanDocumentInput {
  docType: LoanDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export async function uploadDocument(
  applicationId: string,
  organizationId: string,
  input: UploadLoanDocumentInput,
  actor: { userId: string }
) {
  const app = await workflow.getApplication(applicationId, organizationId);
  const doc = await prisma.loanDocument.create({
    data: {
      applicationId: app.id,
      organizationId,
      docType: input.docType,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      uploadedById: actor.userId,
      status: "PENDING",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.document",
    entityId: doc.id,
    description: `Uploaded ${input.docType} for loan application ${app.applicationNumber}`,
  });
  return doc;
}

export async function verifyDocument(documentId: string, organizationId: string, actor: { userId: string }) {
  const doc = await prisma.loanDocument.findFirst({ where: { id: documentId, organizationId, deletedAt: null } });
  if (!doc) throw new workflow.LoanNotFoundError("Document not found");

  const updated = await prisma.loanDocument.update({
    where: { id: doc.id },
    data: { status: "VERIFIED", verifiedById: actor.userId, verifiedAt: new Date(), rejectionReason: null },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "VERIFY",
    entity: "loan.document",
    entityId: doc.id,
    description: `Verified ${doc.docType} (${doc.fileName})`,
  });
  return updated;
}

export async function rejectDocument(documentId: string, organizationId: string, reason: string, actor: { userId: string }) {
  const doc = await prisma.loanDocument.findFirst({ where: { id: documentId, organizationId, deletedAt: null } });
  if (!doc) throw new workflow.LoanNotFoundError("Document not found");

  const updated = await prisma.loanDocument.update({
    where: { id: doc.id },
    data: { status: "REJECTED", verifiedById: actor.userId, verifiedAt: new Date(), rejectionReason: reason },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "REJECT",
    entity: "loan.document",
    entityId: doc.id,
    description: `Rejected ${doc.docType} (${doc.fileName}): ${reason}`,
  });
  return updated;
}

export async function deleteDocument(documentId: string, organizationId: string, actor: { userId: string }) {
  const doc = await prisma.loanDocument.findFirst({ where: { id: documentId, organizationId, deletedAt: null } });
  if (!doc) throw new workflow.LoanNotFoundError("Document not found");
  const updated = await prisma.loanDocument.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "DELETE",
    entity: "loan.document",
    entityId: doc.id,
    description: `Removed ${doc.docType} (${doc.fileName})`,
  });
  return updated;
}

export async function listDocuments(applicationId: string, organizationId: string) {
  await workflow.getApplication(applicationId, organizationId);
  return prisma.loanDocument.findMany({
    where: { applicationId, organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } }, verifiedBy: { select: { id: true, name: true } } },
  });
}
