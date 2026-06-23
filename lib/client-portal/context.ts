// ============================================================
// lib/client-portal/context.ts
//
// Client Portal tenancy bridge.
//
// Portal records (DocumentRequest, FilingApproval, Conversation,
// PortalNotification, …) live in the FIRM's organization and reference
// a CRM `Customer`. CAs and firm admins read them directly (their own
// `organizationId` IS the firm org). A logged-in customer, however,
// sits in their OWN organization — so we bridge their login to the
// firm-side Customer row via `ClientPortalAccess`.
//
// resolvePortalClient() is lazy: if no access row links the user yet, it
// derives the Customer from the accepted customer-invitation (see
// lib/customer-invitations/accept.ts) or an email match, then upserts
// the bridge so subsequent calls are a single indexed lookup.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface PortalUser {
  id: string;
  email: string;
  organizationId: string;
  firmId: string | null;
  userRole: string | null;
}

export interface PortalClientContext {
  accessId: string;
  customerId: string;
  /** The FIRM organization that owns the portal records. */
  organizationId: string;
  firmId: string | null;
}

/**
 * Resolve the firm-side Customer a logged-in customer maps to, creating
 * the ClientPortalAccess bridge on first access. Returns null when the
 * user is not linked to any firm (no invitation, no matching CRM row).
 */
export async function resolvePortalClient(
  user: PortalUser
): Promise<PortalClientContext | null> {
  // 1. Existing bridge — the fast path.
  const linked = await prisma.clientPortalAccess.findFirst({
    where: { clientUserId: user.id, status: { not: "SUSPENDED" } },
    orderBy: { createdAt: "desc" },
  });
  if (linked) {
    // Stamp last-access without blocking the read.
    void prisma.clientPortalAccess
      .update({ where: { id: linked.id }, data: { lastAccessAt: new Date() } })
      .catch(() => {});
    return {
      accessId: linked.id,
      customerId: linked.customerId,
      organizationId: linked.organizationId,
      firmId: linked.firmId,
    };
  }

  // 2. Derive the CRM Customer from the accepted invitation…
  let customerId: string | null = null;
  let firmOrgId: string | null = null;

  const invite = await prisma.customerInvitation.findFirst({
    where: {
      acceptedOrganizationId: user.organizationId,
      status: "ACCEPTED",
      customerId: { not: null },
    },
    orderBy: { acceptedAt: "desc" },
    select: { customerId: true, organizationId: true, firmId: true },
  });
  if (invite?.customerId) {
    customerId = invite.customerId;
    firmOrgId = invite.organizationId;
  }

  // 3. …or an email match against a firm's CRM (excluding the user's own org).
  if (!customerId && user.email) {
    const customer = await prisma.customer.findFirst({
      where: {
        email: { equals: user.email, mode: "insensitive" },
        organizationId: { not: user.organizationId },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, organizationId: true, firmId: true },
    });
    if (customer) {
      customerId = customer.id;
      firmOrgId = customer.organizationId;
    }
  }

  if (!customerId || !firmOrgId) return null;

  // 4. Upsert the bridge so future calls are O(1).
  const firmId = await resolveFirmId(firmOrgId, customerId);
  const access = await prisma.clientPortalAccess.upsert({
    where: { organizationId_customerId: { organizationId: firmOrgId, customerId } },
    create: {
      organizationId: firmOrgId,
      customerId,
      firmId,
      clientUserId: user.id,
      clientOrganizationId: user.organizationId,
      status: "ACTIVE",
      lastAccessAt: new Date(),
    },
    update: {
      clientUserId: user.id,
      clientOrganizationId: user.organizationId,
      status: "ACTIVE",
      lastAccessAt: new Date(),
    },
  });

  return {
    accessId: access.id,
    customerId,
    organizationId: firmOrgId,
    firmId: access.firmId,
  };
}

async function resolveFirmId(orgId: string, customerId: string): Promise<string | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    select: { firmId: true },
  });
  return customer?.firmId ?? null;
}

/**
 * CRM customer ids actively assigned to a CA (CustomerAssignment).
 * Used to scope a CA's portal views to their own clients.
 */
export async function assignedCustomerIds(caId: string): Promise<string[]> {
  const rows = await prisma.customerAssignment.findMany({
    where: { caId, isActive: true },
    select: { customerId: true },
  });
  return rows.map((r) => r.customerId);
}
