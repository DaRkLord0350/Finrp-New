// ============================================================
// lib/services/org-document.service.ts
//
// Module 3 — Document Vault. Preserves the existing Compliance Doc
// Center's "one slot per documentType, upload replaces" UX (see
// app/(dashboard)/settings/compliance/ComplianceDocsClient.tsx,
// unchanged) while adding real version history underneath: the
// first upload for a type creates OrganizationDocument + version 1;
// every subsequent upload for the SAME type archives the current
// file into OrganizationDocumentVersion and updates the parent row
// in place, rather than creating a second visible row.
// ============================================================

import { documentRepository } from "@/lib/repositories/document.repository";
import { createAuditLog } from "@/lib/audit";
import { kycStatusService } from "@/lib/services/kyc-status.service";
import { OrgDocumentError } from "@/lib/org-document/http";

type Actor = { userId: string | null };

export interface UploadDocumentInput {
  documentType: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  expiryDate?: Date | null;
  notes?: string | null;
  folder?: string | null;
  tags?: string[];
}

/** Minimum document set Module 7 treats as "documents complete" for KYC purposes. */
const REQUIRED_KYC_DOCUMENT_TYPES = ["PAN", "GST_CERTIFICATE", "ADDRESS_PROOF"];

export const orgDocumentService = {
  async list(organizationId: string) {
    return documentRepository.listOrgDocuments(organizationId);
  },

  async upload(organizationId: string, actor: Actor, input: UploadDocumentInput) {
    const existing = await documentRepository.findActiveByType(organizationId, input.documentType);

    const document = existing
      ? await documentRepository.replaceWithNewVersion(
          existing.id,
          {
            fileUrl: existing.fileUrl,
            fileName: existing.fileName,
            fileSize: existing.fileSize,
            uploadedById: existing.uploadedById,
            currentVersion: existing.currentVersion,
          },
          {
            displayName: input.displayName,
            fileName: input.fileName,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            fileUrl: input.fileUrl,
            expiryDate: input.expiryDate ?? null,
            notes: input.notes ?? null,
            uploadedById: actor.userId,
          }
        )
      : await documentRepository.createWithInitialVersion(organizationId, {
          documentType: input.documentType,
          displayName: input.displayName,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          fileUrl: input.fileUrl,
          expiryDate: input.expiryDate ?? null,
          notes: input.notes ?? null,
          folder: input.folder ?? null,
          tags: input.tags ?? [],
          uploadedById: actor.userId,
        });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: existing ? "UPDATE" : "CREATE",
      entity: "organization_document",
      entityId: document.id,
      description: existing
        ? `Uploaded new version of "${document.displayName}" (v${document.currentVersion})`
        : `Uploaded "${document.displayName}"`,
    });

    await orgDocumentService.recomputeDocumentsComplete(organizationId);
    return document;
  },

  async listVersions(organizationId: string, documentId: string) {
    const doc = await documentRepository.getOrgDocument(organizationId, documentId);
    if (!doc) throw new OrgDocumentError("Document not found", 404);
    return documentRepository.listVersions(documentId);
  },

  async remove(organizationId: string, actor: Actor, id: string) {
    const doc = await documentRepository.getOrgDocument(organizationId, id);
    if (!doc) throw new OrgDocumentError("Document not found", 404);

    await documentRepository.softDeleteOrgDocument(organizationId, id);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "DELETE",
      entity: "organization_document",
      entityId: id,
      description: `Deleted "${doc.displayName}"`,
    });

    await orgDocumentService.recomputeDocumentsComplete(organizationId);
  },

  async recomputeDocumentsComplete(organizationId: string) {
    const docs = await documentRepository.listOrgDocuments(organizationId);
    const types = new Set(docs.map((d) => d.documentType));
    const complete = REQUIRED_KYC_DOCUMENT_TYPES.every((t) => types.has(t));
    await kycStatusService.markDocumentsComplete(organizationId, complete);
  },
};
