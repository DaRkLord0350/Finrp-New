// ============================================================
// lib/invoices/attachments.ts
//
// Invoice file attachments, stored binary-in-DB (mirrors
// services/compliance/complianceDocumentService.ts). Metadata is returned
// for listing/preview; binary bytes only on explicit download.
// ============================================================

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validators/compliance";

const META_SELECT = {
  id: true,
  invoiceId: true,
  organizationId: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  checksum: true,
  uploadedById: true,
  createdAt: true,
} as const;

export const invoiceAttachmentService = {
  async list(invoiceId: string, organizationId: string) {
    return prisma.invoiceAttachment.findMany({
      where: { invoiceId, organizationId },
      select: META_SELECT,
      orderBy: { createdAt: "desc" },
    });
  },

  async upload(params: {
    invoiceId: string;
    organizationId: string;
    file: File;
    uploadedById?: string | null;
  }) {
    const { invoiceId, organizationId, file, uploadedById } = params;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error(`File type "${file.type || "unknown"}" is not allowed`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("File exceeds the 20 MB limit");
    }

    // The invoice must belong to this org.
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: { id: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    return prisma.invoiceAttachment.create({
      data: {
        invoiceId,
        organizationId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        checksum,
        binaryData: buffer,
        uploadedById: uploadedById ?? null,
      },
      select: META_SELECT,
    });
  },

  async download(id: string, organizationId: string) {
    return prisma.invoiceAttachment.findFirst({
      where: { id, organizationId },
      select: { ...META_SELECT, binaryData: true },
    });
  },

  async delete(id: string, organizationId: string) {
    const deleted = await prisma.invoiceAttachment.deleteMany({ where: { id, organizationId } });
    return deleted.count > 0;
  },
};
