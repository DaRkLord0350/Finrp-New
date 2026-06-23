// ============================================================
// CustomerInvitation Repository — tenant-scoped data access
//
// Every read is scoped by organizationId (the firm's tenant). The
// acceptance path (accept.ts) is the only consumer that resolves an
// invite cross-tenant by email/token, and it does so explicitly.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { InviteStatus, Prisma } from "@prisma/client";

const LIST_INCLUDE = {
  invitedBy: { select: { id: true, name: true, email: true } },
  assignedCa: { select: { id: true, name: true, email: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.CustomerInvitationInclude;

export type CustomerInvitationListItem = Prisma.CustomerInvitationGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

export interface CreateCustomerInvitationInput {
  organizationId: string;
  firmId: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  invitedById: string;
  assignedCaId: string | null;
  customerId: string | null;
  expiresAt: Date;
}

export const customerInvitationRepository = {
  create(data: CreateCustomerInvitationInput) {
    return prisma.customerInvitation.create({ data });
  },

  /**
   * List invitations for a firm org. `caId` narrows to invites a given
   * CA either created or is the assigned owner of (CA-portal scope).
   */
  list(
    organizationId: string,
    opts: { caId?: string; statuses?: InviteStatus[] } = {}
  ): Promise<CustomerInvitationListItem[]> {
    const where: Prisma.CustomerInvitationWhereInput = {
      organizationId,
      ...(opts.statuses?.length ? { status: { in: opts.statuses } } : {}),
      ...(opts.caId
        ? { OR: [{ invitedById: opts.caId }, { assignedCaId: opts.caId }] }
        : {}),
    };
    return prisma.customerInvitation.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  },

  findById(organizationId: string, id: string) {
    return prisma.customerInvitation.findFirst({
      where: { id, organizationId },
    });
  },

  findByToken(token: string) {
    return prisma.customerInvitation.findUnique({ where: { token } });
  },

  /** Active (PENDING|SENT, non-expired) invite for an email, newest first. */
  findActiveByEmail(email: string) {
    return prisma.customerInvitation.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: { in: ["PENDING", "SENT"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Pending or sent duplicate in the same firm org (dedupe guard). */
  findOpenForOrg(organizationId: string, email: string) {
    return prisma.customerInvitation.findFirst({
      where: {
        organizationId,
        email: { equals: email, mode: "insensitive" },
        status: { in: ["PENDING", "SENT"] },
      },
      select: { id: true },
    });
  },

  markSent(id: string, isResend: boolean) {
    const now = new Date();
    return prisma.customerInvitation.update({
      where: { id },
      data: {
        status: "SENT",
        lastSentAt: now,
        ...(isResend
          ? { resendCount: { increment: 1 } }
          : { sentAt: now }),
      },
    });
  },

  setStatus(id: string, status: InviteStatus, extra: Prisma.CustomerInvitationUpdateInput = {}) {
    return prisma.customerInvitation.update({
      where: { id },
      data: { status, ...extra },
    });
  },

  /** Bulk-expire stale invites for an org (or globally when omitted). */
  expireStale(organizationId?: string) {
    return prisma.customerInvitation.updateMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: { in: ["PENDING", "SENT"] },
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  },

  /** Counts for the onboarding funnel (firm dashboard / invitations page). */
  async funnel(organizationId: string) {
    const rows = await prisma.customerInvitation.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    });
    const counts: Record<InviteStatus, number> = {
      PENDING: 0,
      SENT: 0,
      ACCEPTED: 0,
      EXPIRED: 0,
      REVOKED: 0,
    };
    for (const r of rows) counts[r.status] = r._count._all;
    return counts;
  },
};
