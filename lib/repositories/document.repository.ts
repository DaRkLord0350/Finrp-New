// ============================================================
// Document Repository — tenant-scoped document data access
// ============================================================

import { prisma } from "./base.repository";

export const documentRepository = {
  async listOrgDocuments(organizationId: string) {
    return prisma.organizationDocument.findMany({
      where: { organizationId },
      orderBy: { uploadedAt: "desc" },
    });
  },

  async getOrgDocument(organizationId: string, id: string) {
    return prisma.organizationDocument.findFirst({
      where: { id, organizationId },
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
