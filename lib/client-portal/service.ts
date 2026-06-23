// ============================================================
// lib/client-portal/service.ts
//
// Client Portal write services: document requests/uploads, filing
// e-approvals, and conversation messaging. Each mutation:
//   • is tenant-scoped to the firm `organizationId`,
//   • writes an audit-log entry (requirement 8), and
//   • generates portal notifications where relevant (requirement 9).
//
// Reads/aggregates live in queries.ts; the customer↔firm bridge in
// context.ts.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  notifyDocumentRequested,
  notifyDocumentUploaded,
  notifyFilingApprovalRequested,
  notifyFilingDecided,
  notifyMessageReceived,
  customerLoginUserId,
} from "./notifications";
import { Prisma } from "@prisma/client";
import type {
  DocumentFolder,
  DocumentUploadStatus,
  FilingType,
} from "@prisma/client";

export interface PortalActor {
  id: string;
  organizationId: string; // firm org
  firmId: string | null;
  name: string | null;
  email: string;
  userRole: string | null;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

interface FileInput {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
}

// ===========================================================================
// DOCUMENT REQUESTS
// ===========================================================================

export async function createDocumentRequest(
  actor: PortalActor,
  input: {
    customerId: string;
    title: string;
    description?: string | null;
    category?: DocumentFolder;
    dueDate?: string | null;
  }
): Promise<Result<{ id: string }>> {
  const title = input.title?.trim();
  if (!title) return { ok: false, status: 400, error: "Title is required" };

  const customer = await assertCustomerInOrg(actor.organizationId, input.customerId);
  if (!customer) return { ok: false, status: 404, error: "Customer not found" };

  const req = await prisma.documentRequest.create({
    data: {
      organizationId: actor.organizationId,
      customerId: input.customerId,
      requestedById: actor.id,
      title,
      description: input.description?.trim() || null,
      category: input.category ?? "OTHER",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    select: { id: true },
  });

  await audit(actor, "CREATE", "documentRequest", req.id, `Requested document "${title}" from ${customer.name}`);
  await notifyDocumentRequested({
    organizationId: actor.organizationId,
    customerId: input.customerId,
    requestId: req.id,
    title,
  });

  return { ok: true, data: req };
}

/** Customer (or CA on their behalf) uploads a document. */
export async function uploadDocument(
  input: {
    organizationId: string;
    customerId: string;
    requestId?: string | null;
    uploadedById?: string | null;
    file: FileInput;
  }
): Promise<Result<{ id: string }>> {
  if (!input.file?.fileName || !input.file?.fileUrl) {
    return { ok: false, status: 400, error: "fileName and fileUrl are required" };
  }

  let requestId: string | null = null;
  let recipientCaId: string | null = null;
  if (input.requestId) {
    const req = await prisma.documentRequest.findFirst({
      where: { id: input.requestId, organizationId: input.organizationId, customerId: input.customerId },
      select: { id: true, requestedById: true },
    });
    if (!req) return { ok: false, status: 404, error: "Document request not found" };
    requestId = req.id;
    recipientCaId = req.requestedById;
  }
  if (!recipientCaId) {
    recipientCaId = await assignedCaFor(input.customerId);
  }

  const upload = await prisma.$transaction(async (tx) => {
    const up = await tx.documentUpload.create({
      data: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        requestId,
        uploadedById: input.uploadedById ?? null,
        fileName: input.file.fileName,
        fileUrl: input.file.fileUrl,
        mimeType: input.file.mimeType ?? null,
        fileSize: input.file.fileSize ?? 0,
      },
      select: { id: true },
    });
    if (requestId) {
      await tx.documentRequest.update({
        where: { id: requestId },
        data: { status: "UPLOADED" },
      });
    }
    return up;
  });

  await createAuditLog({
    organizationId: input.organizationId,
    userId: input.uploadedById ?? undefined,
    action: "CREATE",
    entity: "documentUpload",
    entityId: upload.id,
    description: `Uploaded document "${input.file.fileName}"`,
  });
  await notifyDocumentUploaded({
    organizationId: input.organizationId,
    customerId: input.customerId,
    uploadId: upload.id,
    fileName: input.file.fileName,
    recipientCaId,
  });

  return { ok: true, data: upload };
}

/** CA reviews/approves/rejects an uploaded document. */
export async function reviewUpload(
  actor: PortalActor,
  uploadId: string,
  decision: { status: DocumentUploadStatus; reviewNotes?: string | null }
): Promise<Result<{ id: string }>> {
  const upload = await prisma.documentUpload.findFirst({
    where: { id: uploadId, organizationId: actor.organizationId },
    select: { id: true, fileName: true, requestId: true },
  });
  if (!upload) return { ok: false, status: 404, error: "Upload not found" };

  await prisma.$transaction(async (tx) => {
    await tx.documentUpload.update({
      where: { id: uploadId },
      data: {
        status: decision.status,
        reviewedById: actor.id,
        reviewNotes: decision.reviewNotes?.trim() || null,
        reviewedAt: new Date(),
      },
    });
    if (upload.requestId) {
      const reqStatus =
        decision.status === "APPROVED"
          ? "APPROVED"
          : decision.status === "REJECTED"
            ? "REJECTED"
            : "UNDER_REVIEW";
      await tx.documentRequest.update({
        where: { id: upload.requestId },
        data: { status: reqStatus },
      });
    }
  });

  await audit(
    actor,
    decision.status === "APPROVED" ? "UPDATE" : "UPDATE",
    "documentUpload",
    uploadId,
    `Marked document "${upload.fileName}" ${decision.status.replace("_", " ").toLowerCase()}`
  );

  return { ok: true, data: { id: uploadId } };
}

// ===========================================================================
// FILING APPROVALS
// ===========================================================================

export async function createFilingApproval(
  actor: PortalActor,
  input: {
    customerId: string;
    type?: FilingType;
    title: string;
    period?: string | null;
    summary?: string | null;
    amount?: number | null;
    documents?: FileInput[];
  }
): Promise<Result<{ id: string }>> {
  const title = input.title?.trim();
  if (!title) return { ok: false, status: 400, error: "Title is required" };

  const customer = await assertCustomerInOrg(actor.organizationId, input.customerId);
  if (!customer) return { ok: false, status: 404, error: "Customer not found" };

  const filing = await prisma.filingApproval.create({
    data: {
      organizationId: actor.organizationId,
      customerId: input.customerId,
      createdById: actor.id,
      type: input.type ?? "GST",
      title,
      period: input.period?.trim() || null,
      summary: input.summary?.trim() || null,
      amount:
        input.amount !== undefined && input.amount !== null
          ? new Prisma.Decimal(input.amount)
          : null,
      documents: input.documents?.length
        ? {
            create: input.documents.map((d) => ({
              fileName: d.fileName,
              fileUrl: d.fileUrl,
              mimeType: d.mimeType ?? null,
              fileSize: d.fileSize ?? 0,
              uploadedById: actor.id,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  await audit(actor, "CREATE", "filingApproval", filing.id, `Requested approval for ${input.type ?? "GST"} filing "${title}"`);
  await notifyFilingApprovalRequested({
    organizationId: actor.organizationId,
    customerId: input.customerId,
    filingId: filing.id,
    title,
  });

  return { ok: true, data: filing };
}

/** Attach GST/ITR documents to a filing (CA). */
export async function addFilingDocuments(
  actor: PortalActor,
  filingId: string,
  files: FileInput[]
): Promise<Result<{ count: number }>> {
  if (!files?.length) return { ok: false, status: 400, error: "No documents provided" };
  const filing = await prisma.filingApproval.findFirst({
    where: { id: filingId, organizationId: actor.organizationId },
    select: { id: true, title: true },
  });
  if (!filing) return { ok: false, status: 404, error: "Filing not found" };

  await prisma.filingDocument.createMany({
    data: files.map((d) => ({
      filingId,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType ?? null,
      fileSize: d.fileSize ?? 0,
      uploadedById: actor.id,
    })),
  });

  await audit(actor, "UPDATE", "filingApproval", filingId, `Added ${files.length} document(s) to filing "${filing.title}"`);
  return { ok: true, data: { count: files.length } };
}

/** Customer approves or rejects a filing. */
export async function decideFiling(
  actor: PortalActor,
  organizationId: string,
  filingId: string,
  decision: { approve: boolean; comment?: string | null }
): Promise<Result<{ id: string }>> {
  const filing = await prisma.filingApproval.findFirst({
    where: { id: filingId, organizationId },
    select: { id: true, title: true, createdById: true, customerId: true, status: true },
  });
  if (!filing) return { ok: false, status: 404, error: "Filing not found" };
  if (filing.status === "APPROVED" || filing.status === "REJECTED" || filing.status === "FILED") {
    return { ok: false, status: 409, error: "This filing has already been decided" };
  }

  await prisma.filingApproval.update({
    where: { id: filingId },
    data: {
      status: decision.approve ? "APPROVED" : "REJECTED",
      customerComment: decision.comment?.trim() || null,
      decidedById: actor.id,
      decidedAt: new Date(),
    },
  });

  await createAuditLog({
    organizationId,
    userId: actor.id,
    action: "UPDATE",
    entity: "filingApproval",
    entityId: filingId,
    description: `${decision.approve ? "Approved" : "Rejected"} filing "${filing.title}"`,
  });
  await notifyFilingDecided({
    organizationId,
    customerId: filing.customerId,
    filingId,
    title: filing.title,
    approved: decision.approve,
    recipientCaId: filing.createdById,
  });

  return { ok: true, data: { id: filingId } };
}

/** Add a comment to a filing (either party). */
export async function addFilingComment(
  args: { organizationId: string; userId: string; authorName: string | null },
  filingId: string,
  body: string
): Promise<Result<{ id: string }>> {
  const text = body?.trim();
  if (!text) return { ok: false, status: 400, error: "Comment is required" };
  const filing = await prisma.filingApproval.findFirst({
    where: { id: filingId, organizationId: args.organizationId },
    select: { id: true },
  });
  if (!filing) return { ok: false, status: 404, error: "Filing not found" };

  const comment = await prisma.filingComment.create({
    data: { filingId, authorId: args.userId, authorName: args.authorName, body: text },
    select: { id: true },
  });

  await createAuditLog({
    organizationId: args.organizationId,
    userId: args.userId,
    action: "UPDATE",
    entity: "filingApproval",
    entityId: filingId,
    description: `Commented on filing`,
  });
  return { ok: true, data: comment };
}

// ===========================================================================
// MESSAGING (Conversation + Message + attachments)
// ===========================================================================

export async function createConversation(
  actor: PortalActor,
  organizationId: string,
  input: { customerId: string; subject?: string | null }
): Promise<Result<{ id: string }>> {
  const customer = await assertCustomerInOrg(organizationId, input.customerId);
  if (!customer) return { ok: false, status: 404, error: "Customer not found" };

  const convo = await prisma.conversation.create({
    data: {
      organizationId,
      customerId: input.customerId,
      subject: input.subject?.trim() || null,
      createdById: actor.id,
    },
    select: { id: true },
  });
  await createAuditLog({
    organizationId,
    userId: actor.id,
    action: "CREATE",
    entity: "conversation",
    entityId: convo.id,
    description: `Started a conversation${input.subject ? `: ${input.subject}` : ""}`,
  });
  return { ok: true, data: convo };
}

export async function sendMessage(
  actor: PortalActor,
  organizationId: string,
  input: { conversationId: string; content: string; subject?: string | null; attachments?: FileInput[] }
): Promise<Result<{ id: string }>> {
  const content = input.content?.trim();
  if (!content) return { ok: false, status: 400, error: "Message content is required" };

  const convo = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId },
    select: { id: true, customerId: true, createdById: true },
  });
  if (!convo) return { ok: false, status: 404, error: "Conversation not found" };

  // Resolve the two parties to set the receiver.
  const customerUserId = await customerLoginUserId(organizationId, convo.customerId);
  const caUserId = convo.createdById === customerUserId
    ? await assignedCaFor(convo.customerId)
    : convo.createdById;

  const senderIsCustomer = actor.id === customerUserId;
  const receiverId = senderIsCustomer ? caUserId : customerUserId;
  if (!receiverId) {
    return { ok: false, status: 409, error: "The other party has not activated portal access yet" };
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        organizationId,
        conversationId: convo.id,
        senderId: actor.id,
        receiverId,
        subject: input.subject?.trim() || null,
        content,
        attachments: input.attachments?.length
          ? {
              create: input.attachments.map((a) => ({
                fileName: a.fileName,
                fileUrl: a.fileUrl,
                mimeType: a.mimeType ?? null,
                fileSize: a.fileSize ?? 0,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });
    await tx.conversation.update({
      where: { id: convo.id },
      data: { lastMessageAt: new Date() },
    });
    return msg;
  });

  await createAuditLog({
    organizationId,
    userId: actor.id,
    action: "CREATE",
    entity: "message",
    entityId: message.id,
    description: `Sent a message`,
  });
  await notifyMessageReceived({
    organizationId,
    customerId: convo.customerId,
    conversationId: convo.id,
    recipientUserId: receiverId,
    audience: senderIsCustomer ? "CA" : "CUSTOMER",
    preview: content,
  });

  return { ok: true, data: message };
}

/** Mark all messages addressed to `userId` in a conversation as read. */
export async function markConversationRead(
  organizationId: string,
  conversationId: string,
  userId: string
): Promise<Result<{ count: number }>> {
  const res = await prisma.message.updateMany({
    where: { conversationId, organizationId, receiverId: userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { ok: true, data: { count: res.count } };
}

// ===========================================================================
// CLIENT PORTAL ACCESS
// ===========================================================================

/** Firm enables (or re-activates) portal access for a CRM customer. */
export async function grantClientPortalAccess(
  actor: PortalActor,
  customerId: string,
  status: "ACTIVE" | "INVITED" | "SUSPENDED" = "ACTIVE"
): Promise<Result<{ id: string }>> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, name: true, firmId: true },
  });
  if (!customer) return { ok: false, status: 404, error: "Customer not found" };

  const access = await prisma.clientPortalAccess.upsert({
    where: { organizationId_customerId: { organizationId: actor.organizationId, customerId } },
    create: {
      organizationId: actor.organizationId,
      customerId,
      firmId: customer.firmId ?? actor.firmId,
      status,
      grantedById: actor.id,
    },
    update: { status, grantedById: actor.id },
    select: { id: true },
  });

  await audit(
    actor,
    "UPDATE",
    "clientPortalAccess",
    access.id,
    `${status === "SUSPENDED" ? "Suspended" : "Enabled"} portal access for ${customer.name}`
  );
  return { ok: true, data: access };
}

// ===========================================================================
// Helpers
// ===========================================================================

async function assertCustomerInOrg(organizationId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
}

async function assignedCaFor(customerId: string): Promise<string | null> {
  const a = await prisma.customerAssignment.findFirst({
    where: { customerId, isActive: true },
    orderBy: { assignedAt: "desc" },
    select: { caId: true },
  });
  return a?.caId ?? null;
}

function audit(
  actor: PortalActor,
  action: "CREATE" | "UPDATE" | "DELETE",
  entity: string,
  entityId: string,
  description: string
) {
  return createAuditLog({
    organizationId: actor.organizationId,
    userId: actor.id,
    action,
    entity,
    entityId,
    description,
  });
}
