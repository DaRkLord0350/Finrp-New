// ============================================================
// lib/services/billing.service.ts
//
// Razorpay-backed activation. Bridges the payment gateway and the plan
// state: creates Checkout orders, verifies payments server-side, and
// activates the plan + records billing history only after a valid
// signature (or a verified webhook). Free plans activate directly.
//
// SECURITY: a plan is NEVER activated from a client-reported result —
// activatePaidPlan re-verifies the signature; the webhook is an
// independent capture path. Both are idempotent on the order id.
// ============================================================

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PlanType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { getPlan, isFreePlan, getActivePlans } from "@/lib/billing/plans";
import { invalidateEntitlements, getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchRazorpayPayment,
  getPublicKeyId,
} from "@/lib/billing/razorpay";
import {
  writePlan,
  assertPlanEligible,
  SubscriptionError,
} from "./subscription.service";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const PLAN_FIELDS = {
  name: true,
  billingCategory: true,
  planType: true,
  relationshipStatus: true,
  linkedCAOrganizationId: true,
} as const;

// ── helpers ───────────────────────────────────────────────────
export function generateInvoiceNumber(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `FRP-${ymd}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Keep the cached team-member count in sync (used for plan limits/usage). */
export async function recomputeTeamMemberCount(
  organizationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const count = await tx.user.count({ where: { organizationId, isActive: true } });
  await tx.organization.update({
    where: { id: organizationId },
    data: { teamMemberCount: count },
  });
  return count;
}

// ── checkout (paid plans) ─────────────────────────────────────
export interface CheckoutOrder {
  billingPaymentId: string;
  keyId: string | undefined;
  orderId: string;
  amount: number; // paise
  amountRupees: number;
  currency: string;
  planType: PlanType;
  planName: string;
  organizationName: string;
}

/**
 * Create a Razorpay order for a paid plan and a PENDING BillingPayment
 * row to reconcile against on verify / webhook.
 */
export async function createCheckoutOrder(params: {
  organizationId: string;
  planType: PlanType;
  actorUserId?: string;
}): Promise<CheckoutOrder> {
  const { organizationId, planType, actorUserId } = params;
  const plan = getPlan(planType);

  if (isFreePlan(planType)) {
    throw new SubscriptionError("FREE_PLAN", `${plan.name} is free — no payment required.`, 400);
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: PLAN_FIELDS,
  });
  if (!org) throw new SubscriptionError("ORG_NOT_FOUND", "Organization not found", 404);

  assertPlanEligible(planType);

  const order = await createRazorpayOrder({
    amountRupees: plan.priceMonthly,
    receipt: `org_${organizationId.slice(0, 18)}_${Date.now()}`,
    notes: { organizationId, planType },
  });

  const payment = await prisma.billingPayment.create({
    data: {
      organizationId,
      planType,
      billingCategory: org.billingCategory ?? "BUSINESS",
      amount: new Prisma.Decimal(plan.priceMonthly),
      currency: "INR",
      status: "PENDING",
      razorpayOrderId: order.id,
      createdById: actorUserId ?? null,
    },
  });

  return {
    billingPaymentId: payment.id,
    keyId: getPublicKeyId(),
    orderId: order.id,
    amount: order.amount,
    amountRupees: plan.priceMonthly,
    currency: order.currency,
    planType,
    planName: plan.name,
    organizationName: org.name,
  };
}

// ── activate paid plan (after client checkout) ────────────────
export interface ActivatePaidInput {
  organizationId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  actorUserId?: string;
}

export async function activatePaidPlan(input: ActivatePaidInput) {
  const { organizationId, razorpayOrderId, razorpayPaymentId, razorpaySignature, actorUserId } = input;

  // 1. Verify the signature BEFORE trusting any of the payment data.
  if (!verifyPaymentSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
    throw new SubscriptionError("INVALID_SIGNATURE", "Payment signature verification failed.", 400);
  }

  const payment = await prisma.billingPayment.findFirst({
    where: { razorpayOrderId, organizationId },
  });
  if (!payment) {
    throw new SubscriptionError("ORDER_NOT_FOUND", "No pending order matches this payment.", 404);
  }
  if (payment.status === "CAPTURED") {
    return { alreadyActive: true, planType: payment.planType }; // idempotent
  }

  const method = await fetchRazorpayPayment(razorpayPaymentId)
    .then((p) => (p?.method as string | undefined) ?? null)
    .catch(() => null);

  const now = new Date();
  const periodEnd = new Date(now.getTime() + MONTH_MS);
  const invoiceNumber = generateInvoiceNumber(now);

  await prisma.$transaction(async (tx) => {
    await writePlan(tx, organizationId, payment.planType, {
      status: "ACTIVE",
      periodStart: now,
      periodEnd,
    });
    await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        razorpayPaymentId,
        razorpaySignature,
        method,
        periodStart: now,
        periodEnd,
        invoiceNumber,
      },
    });
    await recomputeTeamMemberCount(organizationId, tx);
  });

  await invalidateEntitlements(organizationId);
  await createAuditLog({
    organizationId,
    userId: actorUserId,
    action: "UPDATE",
    entity: "subscription",
    description: `Activated ${getPlan(payment.planType).name} via Razorpay (payment ${razorpayPaymentId})`,
    newValue: { planType: payment.planType, razorpayPaymentId, invoiceNumber },
  });

  return { alreadyActive: false, planType: payment.planType, invoiceNumber };
}

// ── activate free plan (Solo, or Connected when CA-linked) ─────
export async function activateFreePlan(params: {
  organizationId: string;
  planType: PlanType;
  actorUserId?: string;
}) {
  const { organizationId, planType, actorUserId } = params;
  if (!isFreePlan(planType)) {
    throw new SubscriptionError("NOT_FREE", `${getPlan(planType).name} requires payment.`, 400);
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: PLAN_FIELDS,
  });
  if (!org) throw new SubscriptionError("ORG_NOT_FOUND", "Organization not found", 404);
  assertPlanEligible(planType);

  await prisma.$transaction(async (tx) => {
    await writePlan(tx, organizationId, planType, { status: "ACTIVE" });
    await recomputeTeamMemberCount(organizationId, tx);
  });

  await invalidateEntitlements(organizationId);
  await createAuditLog({
    organizationId,
    userId: actorUserId,
    action: "UPDATE",
    entity: "subscription",
    description: `Activated free ${getPlan(planType).name} plan`,
    newValue: { planType },
  });

  return { planType };
}

// ── webhook capture (independent of the client) ───────────────
/**
 * Capture a payment from a verified webhook. Idempotent: only a PENDING
 * order is activated. This is the source of truth when the client never
 * returns (closed tab, network drop) but the payment succeeded.
 */
export async function captureByOrderId(params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  method?: string | null;
}) {
  const { razorpayOrderId, razorpayPaymentId, method } = params;
  const payment = await prisma.billingPayment.findFirst({
    where: { razorpayOrderId },
  });
  if (!payment || payment.status === "CAPTURED") return { captured: false };

  const now = new Date();
  const periodEnd = new Date(now.getTime() + MONTH_MS);
  const invoiceNumber = payment.invoiceNumber ?? generateInvoiceNumber(now);

  await prisma.$transaction(async (tx) => {
    await writePlan(tx, payment.organizationId, payment.planType, {
      status: "ACTIVE",
      periodStart: now,
      periodEnd,
    });
    await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        razorpayPaymentId: razorpayPaymentId ?? payment.razorpayPaymentId,
        method: method ?? payment.method,
        periodStart: now,
        periodEnd,
        invoiceNumber,
      },
    });
    await recomputeTeamMemberCount(payment.organizationId, tx);
  });

  await invalidateEntitlements(payment.organizationId);
  await createAuditLog({
    organizationId: payment.organizationId,
    action: "UPDATE",
    entity: "subscription",
    description: `Activated ${getPlan(payment.planType).name} via Razorpay webhook (order ${razorpayOrderId})`,
    newValue: { planType: payment.planType, razorpayPaymentId },
  });

  return { captured: true, organizationId: payment.organizationId, planType: payment.planType };
}

export async function markFailedByOrderId(razorpayOrderId: string, reason?: string) {
  const payment = await prisma.billingPayment.findFirst({ where: { razorpayOrderId } });
  if (!payment || payment.status === "CAPTURED") return;
  await prisma.billingPayment.update({
    where: { id: payment.id },
    data: { status: "FAILED", failureReason: reason ?? "Payment failed" },
  });
}

// ── reads (settings / invoices) ───────────────────────────────
export async function listBillingHistory(organizationId: string) {
  return prisma.billingPayment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getInvoice(organizationId: string, paymentId: string) {
  return prisma.billingPayment.findFirst({
    where: { id: paymentId, organizationId, status: "CAPTURED" },
    include: { organization: { select: { name: true, businessProfile: { select: { businessName: true, gstin: true, address: true } } } } },
  });
}

/** Everything the Settings → Billing panel needs, in serialisable form. */
export async function getBillingSummary(organizationId: string) {
  const ent = await getOrgEntitlements(organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      planType: true,
      billingCategory: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      activeClientCount: true,
      linkedCAOrganization: { select: { name: true } },
    },
  });
  if (!org) throw new SubscriptionError("ORG_NOT_FOUND", "Organization not found", 404);

  const plan = org.planType ? getPlan(org.planType) : null;
  const category = org.billingCategory;
  const [teamCount, customerCount, invoiceCount, history] = await Promise.all([
    prisma.user.count({ where: { organizationId, isActive: true } }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId } }),
    listBillingHistory(organizationId),
  ]);

  return {
    entitlements: toEntitlementsDTO(ent),
    category,
    planName: plan?.name ?? null,
    price: plan?.priceMonthly ?? 0,
    status: org.subscriptionStatus,
    renewalDate: org.currentPeriodEnd ? org.currentPeriodEnd.toISOString() : null,
    features: plan?.features ?? [],
    connectedToCA: ent.linkedToActiveCA,
    caName: org.linkedCAOrganization?.name ?? null,
    usage: {
      customers: { used: customerCount, limit: ent.customerLimit },
      invoices: { used: invoiceCount, limit: ent.invoiceLimit },
      team: { used: teamCount, limit: ent.userLimit },
      clients: category === "CA" ? { used: org.activeClientCount, limit: ent.clientLimit } : null,
    },
    catalog: getActivePlans(),
    history: history.map((p) => ({
      id: p.id,
      planType: p.planType,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      method: p.method,
      invoiceNumber: p.invoiceNumber,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
