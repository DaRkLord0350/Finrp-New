// ============================================================
// lib/client-portal/notifications.ts
//
// Portal notification generation (requirement 9). Writes
// `PortalNotification` rows — the single source the portal bell /
// notifications pages and firm "unread" counts read from.
//
// Customer-facing notifications target the customer's bridged login
// (ClientPortalAccess.clientUserId) when known, else broadcast to the
// customer audience (resolved by customerId on read). Never throws —
// a notification failure must not break the originating action.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { PortalNotificationAudience, PortalNotificationType } from "@prisma/client";

interface CreateParams {
  organizationId: string; // firm org
  customerId?: string | null;
  recipientUserId?: string | null;
  audience: PortalNotificationAudience;
  type: PortalNotificationType;
  title: string;
  body?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
}

export async function createPortalNotification(p: CreateParams): Promise<void> {
  try {
    await prisma.portalNotification.create({
      data: {
        organizationId: p.organizationId,
        customerId: p.customerId ?? null,
        recipientUserId: p.recipientUserId ?? null,
        audience: p.audience,
        type: p.type,
        title: p.title,
        body: p.body ?? null,
        referenceId: p.referenceId ?? null,
        referenceType: p.referenceType ?? null,
      },
    });
  } catch (err) {
    console.error("[portal:notify] failed:", err);
  }
}

/** Resolve the bridged customer login for direct-targeting, if any. */
export async function customerLoginUserId(
  organizationId: string,
  customerId: string
): Promise<string | null> {
  const access = await prisma.clientPortalAccess.findUnique({
    where: { organizationId_customerId: { organizationId, customerId } },
    select: { clientUserId: true },
  });
  return access?.clientUserId ?? null;
}

// ---------------------------------------------------------------------------
// Event generators — one per requirement-9 event.
// ---------------------------------------------------------------------------

export async function notifyDocumentRequested(args: {
  organizationId: string;
  customerId: string;
  requestId: string;
  title: string;
}) {
  const recipientUserId = await customerLoginUserId(args.organizationId, args.customerId);
  await createPortalNotification({
    organizationId: args.organizationId,
    customerId: args.customerId,
    recipientUserId,
    audience: "CUSTOMER",
    type: "DOCUMENT_REQUESTED",
    title: "New document request",
    body: `Your CA requested: ${args.title}`,
    referenceId: args.requestId,
    referenceType: "documentRequest",
  });
}

export async function notifyDocumentUploaded(args: {
  organizationId: string;
  customerId: string;
  uploadId: string;
  fileName: string;
  recipientCaId: string | null;
}) {
  await createPortalNotification({
    organizationId: args.organizationId,
    customerId: args.customerId,
    recipientUserId: args.recipientCaId,
    audience: "CA",
    type: "DOCUMENT_UPLOADED",
    title: "Document uploaded",
    body: `A client uploaded "${args.fileName}" for review`,
    referenceId: args.uploadId,
    referenceType: "documentUpload",
  });
}

export async function notifyFilingApprovalRequested(args: {
  organizationId: string;
  customerId: string;
  filingId: string;
  title: string;
}) {
  const recipientUserId = await customerLoginUserId(args.organizationId, args.customerId);
  await createPortalNotification({
    organizationId: args.organizationId,
    customerId: args.customerId,
    recipientUserId,
    audience: "CUSTOMER",
    type: "FILING_APPROVAL_REQUESTED",
    title: "Filing needs your approval",
    body: `Please review and approve: ${args.title}`,
    referenceId: args.filingId,
    referenceType: "filingApproval",
  });
}

export async function notifyFilingDecided(args: {
  organizationId: string;
  customerId: string;
  filingId: string;
  title: string;
  approved: boolean;
  recipientCaId: string | null;
}) {
  await createPortalNotification({
    organizationId: args.organizationId,
    customerId: args.customerId,
    recipientUserId: args.recipientCaId,
    audience: "CA",
    type: args.approved ? "FILING_APPROVED" : "FILING_REJECTED",
    title: args.approved ? "Filing approved" : "Filing rejected",
    body: `${args.title} was ${args.approved ? "approved" : "rejected"} by the client`,
    referenceId: args.filingId,
    referenceType: "filingApproval",
  });
}

export async function notifyMessageReceived(args: {
  organizationId: string;
  customerId: string;
  conversationId: string;
  recipientUserId: string;
  audience: PortalNotificationAudience;
  preview: string;
}) {
  await createPortalNotification({
    organizationId: args.organizationId,
    customerId: args.customerId,
    recipientUserId: args.recipientUserId,
    audience: args.audience,
    type: "MESSAGE_RECEIVED",
    title: "New message",
    body: args.preview.slice(0, 140),
    referenceId: args.conversationId,
    referenceType: "conversation",
  });
}
