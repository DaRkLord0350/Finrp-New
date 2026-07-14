// ============================================================
// Document Repository — tenant-scoped document data access
// ============================================================

import { prisma } from "./base.repository";

export const documentRepository = {
  async listOrgDocuments(organizationId: string) {
    return prisma.organizationDocument.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
    });
  },

  async getOrgDocument(organizationId: string, id: string) {
    return prisma.organizationDocument.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  },

  async createOrgDocument(
    organizationId: string,
    data: { documentType: string; displayName: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string; storageKey?: string; expiryDate?: Date }
  ) {
    return prisma.organizationDocument.create({
      data: { organizationId, ...data },
    });
  },

  async deleteOrgDocument(organizationId: string, id: string) {
    return prisma.organizationDocument.deleteMany({ where: { id, organizationId } });
  },

  // ── Module 3: Document Vault (Phase 1) ──────────────────────────
  /** The single ACTIVE row for a given (org, documentType), if any. */
  async findActiveByType(organizationId: string, documentType: string) {
    return prisma.organizationDocument.findFirst({
      where: { organizationId, documentType, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
    });
  },

  async listVersions(documentId: string) {
    return prisma.organizationDocumentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: "desc" },
    });
  },

  /** Create version 1 alongside the initial document row (mirrors CustomerDocument's pattern). */
  async createWithInitialVersion(
    organizationId: string,
    data: {
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
      uploadedById?: string | null;
    }
  ) {
    return prisma.organizationDocument.create({
      data: {
        organizationId,
        ...data,
        currentVersion: 1,
        status: "UPLOADED",
        versions: {
          create: {
            versionNumber: 1,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            uploadedById: data.uploadedById,
          },
        },
      },
    });
  },

  /** Archive the CURRENT file into a version row, then overwrite the parent with the new file. */
  async replaceWithNewVersion(
    id: string,
    current: { fileUrl: string; fileName: string; fileSize: number; uploadedById?: string | null; currentVersion: number },
    next: {
      displayName: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      fileUrl: string;
      expiryDate?: Date | null;
      notes?: string | null;
      uploadedById?: string | null;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.organizationDocumentVersion.create({
        data: {
          documentId: id,
          versionNumber: current.currentVersion,
          fileUrl: current.fileUrl,
          fileName: current.fileName,
          fileSize: current.fileSize,
          uploadedById: current.uploadedById,
        },
      });
      return tx.organizationDocument.update({
        where: { id },
        data: {
          ...next,
          currentVersion: { increment: 1 },
          status: "UPLOADED",
          isVerified: false,
          verifiedBy: null,
          verifiedAt: null,
          uploadedAt: new Date(),
        },
      });
    });
  },

  async softDeleteOrgDocument(organizationId: string, id: string) {
    return prisma.organizationDocument.updateMany({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  },

  async listComplianceDocuments(organizationId: string, submissionId: string) {
    return prisma.complianceDocument.findMany({
      where: { submissionId, organizationId },
      select: {
        id: true, fileName: true, fileSize: true,
        reviewStatus: true, uploadedAt: true, version: true, isLatest: true,
      },
      orderBy: { uploadedAt: "desc" },
    });
  },
};
