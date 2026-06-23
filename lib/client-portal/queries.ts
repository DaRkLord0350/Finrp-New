// ============================================================
// lib/client-portal/queries.ts
//
// Client Portal read model: firm/CA KPIs and the list queries the
// portal pages render. All reads are tenant-scoped to the firm
// `organizationId`; CA-scoped reads additionally narrow to the CA's
// assigned customers.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Firm dashboard KPIs (requirement 6)
// ---------------------------------------------------------------------------
export interface FirmPortalStats {
  activeClients: number;
  pendingUploads: number;
  pendingApprovals: number;
  unreadMessages: number;
}

export async function firmPortalStats(organizationId: string): Promise<FirmPortalStats> {
  const [activeClients, pendingUploads, pendingApprovals, unreadMessages] = await Promise.all([
    prisma.clientPortalAccess.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.documentRequest.count({
      where: { organizationId, status: { in: ["PENDING", "UPLOADED", "UNDER_REVIEW"] } },
    }),
    prisma.filingApproval.count({ where: { organizationId, status: "PENDING" } }),
    prisma.message.count({
      where: {
        organizationId,
        conversationId: { not: null },
        isRead: false,
        sender: { userRole: "CUSTOMER" },
      },
    }),
  ]);
  return { activeClients, pendingUploads, pendingApprovals, unreadMessages };
}

// ---------------------------------------------------------------------------
// CA dashboard stats — scoped to the CA's assigned customers + own records.
// ---------------------------------------------------------------------------
export interface CaPortalStats {
  pendingReviews: number;
  openRequests: number;
  pendingApprovals: number;
}

export async function caPortalStats(
  organizationId: string,
  caId: string,
  customerIds: string[]
): Promise<CaPortalStats> {
  const [pendingReviews, openRequests, pendingApprovals] = await Promise.all([
    prisma.documentUpload.count({
      where: { organizationId, status: "PENDING_REVIEW", customerId: { in: customerIds } },
    }),
    prisma.documentRequest.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "UPLOADED"] },
        OR: [{ requestedById: caId }, { customerId: { in: customerIds } }],
      },
    }),
    prisma.filingApproval.count({
      where: {
        organizationId,
        status: "PENDING",
        OR: [{ createdById: caId }, { customerId: { in: customerIds } }],
      },
    }),
  ]);
  return { pendingReviews, openRequests, pendingApprovals };
}

// ---------------------------------------------------------------------------
// Document requests + uploads
// ---------------------------------------------------------------------------
const REQUEST_INCLUDE = {
  customer: { select: { id: true, name: true, company: true } },
  uploads: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fileName: true, fileUrl: true, status: true,
      reviewNotes: true, reviewedAt: true, createdAt: true,
    },
  },
} satisfies Prisma.DocumentRequestInclude;

export type DocumentRequestRow = Prisma.DocumentRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

export function listDocumentRequests(
  organizationId: string,
  opts: { customerId?: string; caId?: string; customerIds?: string[] } = {}
): Promise<DocumentRequestRow[]> {
  const where: Prisma.DocumentRequestWhereInput = { organizationId };
  if (opts.customerId) where.customerId = opts.customerId;
  else if (opts.caId)
    where.OR = [{ requestedById: opts.caId }, { customerId: { in: opts.customerIds ?? [] } }];
  return prisma.documentRequest.findMany({
    where,
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Uploads awaiting CA review (review queue). */
export function listReviewQueue(
  organizationId: string,
  customerIds: string[]
) {
  return prisma.documentUpload.findMany({
    where: { organizationId, status: { in: ["PENDING_REVIEW", "UNDER_REVIEW"] }, customerId: { in: customerIds } },
    include: { customer: { select: { id: true, name: true } }, request: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

// ---------------------------------------------------------------------------
// Filing approvals
// ---------------------------------------------------------------------------
const FILING_INCLUDE = {
  customer: { select: { id: true, name: true, company: true } },
  documents: { select: { id: true, fileName: true, fileUrl: true, createdAt: true } },
  comments: { orderBy: { createdAt: "asc" }, select: { id: true, authorName: true, body: true, createdAt: true } },
} satisfies Prisma.FilingApprovalInclude;

export type FilingApprovalRow = Prisma.FilingApprovalGetPayload<{ include: typeof FILING_INCLUDE }>;

export function listFilingApprovals(
  organizationId: string,
  opts: { customerId?: string; caId?: string; customerIds?: string[] } = {}
): Promise<FilingApprovalRow[]> {
  const where: Prisma.FilingApprovalWhereInput = { organizationId };
  if (opts.customerId) where.customerId = opts.customerId;
  else if (opts.caId)
    where.OR = [{ createdById: opts.caId }, { customerId: { in: opts.customerIds ?? [] } }];
  return prisma.filingApproval.findMany({
    where,
    include: FILING_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function getFilingApproval(organizationId: string, id: string) {
  return prisma.filingApproval.findFirst({
    where: { id, organizationId },
    include: FILING_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Conversations + messages
// ---------------------------------------------------------------------------
export function listConversations(
  organizationId: string,
  opts: { customerId?: string; customerIds?: string[] } = {}
) {
  return prisma.conversation.findMany({
    where: {
      organizationId,
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.customerIds ? { customerId: { in: opts.customerIds } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, isRead: true, senderId: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
}

export function getConversation(organizationId: string, id: string) {
  return prisma.conversation.findFirst({
    where: { id, organizationId },
    include: {
      customer: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, email: true, userRole: true } },
          attachments: { select: { id: true, fileName: true, fileUrl: true } },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Portal notifications
// ---------------------------------------------------------------------------
export function listCustomerNotifications(
  organizationId: string,
  customerId: string,
  userId: string
) {
  return prisma.portalNotification.findMany({
    where: {
      organizationId,
      audience: "CUSTOMER",
      OR: [{ recipientUserId: userId }, { recipientUserId: null, customerId }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function listFirmNotifications(organizationId: string, userId?: string) {
  return prisma.portalNotification.findMany({
    where: {
      organizationId,
      audience: { in: ["CA", "FIRM"] },
      ...(userId ? { OR: [{ recipientUserId: userId }, { recipientUserId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ---------------------------------------------------------------------------
// Firm client roster (portal access)
// ---------------------------------------------------------------------------
export function listClientAccess(organizationId: string) {
  return prisma.clientPortalAccess.findMany({
    where: { organizationId },
    include: { customer: { select: { id: true, name: true, email: true, company: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

