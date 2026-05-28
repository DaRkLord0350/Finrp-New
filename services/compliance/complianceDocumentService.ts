import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validators/compliance";

const DOCUMENT_META_SELECT = {
  id: true,
  organizationId: true,
  submissionId: true,
  fileName: true,
  fileExtension: true,
  mimeType: true,
  fileSize: true,
  checksum: true,
  version: true,
  isLatest: true,
  documentType: true,
  description: true,
  uploadedById: true,
  uploadedAt: true,
  createdAt: true,
} as const;

export const complianceDocumentService = {
  async upload(params: {
    organizationId: string;
    submissionId?: string;
    file: File;
    documentType?: string;
    description?: string;
    uploadedById?: string;
  }) {
    const { organizationId, submissionId, file, documentType, description, uploadedById } = params;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error(`File type "${file.type}" is not allowed`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File exceeds the 20 MB limit`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileName = file.name;
    const fileExtension = fileName.includes(".")
      ? fileName.split(".").pop()!.toLowerCase()
      : "";

    return prisma.$transaction(async (tx) => {
      if (submissionId) {
        await tx.complianceDocument.updateMany({
          where: { submissionId, organizationId, isLatest: true },
          data: { isLatest: false },
        });
      }

      const existing = submissionId
        ? await tx.complianceDocument.findFirst({
            where: { submissionId, organizationId },
            orderBy: { version: "desc" },
            select: { version: true },
          })
        : null;

      const version = existing ? existing.version + 1 : 1;

      const doc = await tx.complianceDocument.create({
        data: {
          organizationId,
          submissionId: submissionId ?? null,
          fileName,
          fileExtension,
          mimeType: file.type,
          fileSize: file.size,
          checksum,
          binaryData: buffer,
          version,
          isLatest: true,
          documentType: documentType ?? null,
          description: description ?? null,
          uploadedById: uploadedById ?? null,
        },
        select: DOCUMENT_META_SELECT,
      });

      if (submissionId) {
        await tx.complianceAuditLog.create({
          data: {
            organizationId,
            submissionId,
            action: "DOCUMENT_UPLOADED",
            description: `Document "${fileName}" uploaded (v${version})`,
            performedById: uploadedById ?? null,
            newValue: { fileName, mimeType: file.type, fileSize: file.size, version },
          },
        });
      }

      return doc;
    });
  },

  async getBySubmission(submissionId: string, organizationId: string, latestOnly = false) {
    return prisma.complianceDocument.findMany({
      where: {
        submissionId,
        organizationId,
        ...(latestOnly && { isLatest: true }),
      },
      select: DOCUMENT_META_SELECT,
      orderBy: { uploadedAt: "desc" },
    });
  },

  async getMeta(id: string, organizationId: string) {
    return prisma.complianceDocument.findFirst({
      where: { id, organizationId },
      select: DOCUMENT_META_SELECT,
    });
  },

  async downloadById(id: string, organizationId: string) {
    return prisma.complianceDocument.findFirst({
      where: { id, organizationId },
      select: {
        ...DOCUMENT_META_SELECT,
        binaryData: true,
      },
    });
  },

  async delete(id: string, organizationId: string, deletedBy?: string) {
    const doc = await prisma.complianceDocument.findFirst({
      where: { id, organizationId },
      select: { id: true, submissionId: true, fileName: true, version: true, isLatest: true },
    });
    if (!doc) throw new Error("Document not found");

    await prisma.$transaction(async (tx) => {
      await tx.complianceDocument.delete({ where: { id } });

      if (doc.isLatest && doc.submissionId) {
        const previous = await tx.complianceDocument.findFirst({
          where: { submissionId: doc.submissionId, organizationId },
          orderBy: { version: "desc" },
        });
        if (previous) {
          await tx.complianceDocument.update({
            where: { id: previous.id },
            data: { isLatest: true },
          });
        }

        if (deletedBy) {
          await tx.complianceAuditLog.create({
            data: {
              organizationId,
              submissionId: doc.submissionId,
              action: "DOCUMENT_DELETED",
              description: `Document "${doc.fileName}" (v${doc.version}) deleted`,
              performedById: deletedBy,
            },
          });
        }
      }
    });
  },
};
