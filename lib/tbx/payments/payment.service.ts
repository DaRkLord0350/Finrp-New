// ============================================================
// FinRP — TBX Payment service
// Maker-Checker state machine for outbound vendor-bill payments,
// plus the TBX dispatch/poll pipeline and the shared success/failure
// finalizers used by both the webhook handler and the poll fallback.
//
// State machine:
//   DRAFT -> CHECKER_PENDING -> SUBMITTED -> PROCESSING -> SUCCESS
//                            \-> CANCELLED            \-> FAILED
// See prisma/schema.prisma VendorPayment doc comment for the full
// rationale (MAKER_PENDING is reserved for the BULK batch-assembly
// flow, not used by this single-payment implementation).
//
// Accounting entries are created ONLY in finalizePaymentSuccess,
// which both the webhook handler (payment.webhook.ts) and the
// poll-status fallback (below) call — never on submission, never on
// a merely-PROCESSING status. Both callers are idempotent: a
// payment already in a terminal state is a no-op.
// ============================================================

import { Prisma, type TbxPaymentStatus, type VendorPaymentEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBankingLogger } from "@/lib/banking/logger";
import { createAuditLog } from "@/lib/audit";
import { createDebitJournalEntry } from "@/lib/banking/ledger-integration";
import { getTbxPaymentProvider } from "./index";
import { toPaymentUpdateFromInitiate, toPaymentUpdateFromStatus } from "./payment.mapper";
import { TbxPaymentProviderError, SameActorApprovalError, InvalidPaymentStateError } from "./payment.types";

const log = createBankingLogger("tbx-payment");

const TERMINAL_STATUSES: TbxPaymentStatus[] = ["SUCCESS", "FAILED", "CANCELLED"];

export interface PaymentActionOutcome {
  status: "SUCCESS" | "FAILED";
  paymentId: string;
  error?: string;
  errorCode?: string;
}

interface Actor {
  userId: string;
  role?: string;
}

async function appendLog(
  paymentId: string,
  organizationId: string,
  event: VendorPaymentEvent,
  opts: { fromStatus?: TbxPaymentStatus | null; toStatus?: TbxPaymentStatus | null; actorId?: string | null; actorRole?: string | null; detail?: string; providerResponse?: Prisma.InputJsonValue } = {}
) {
  await prisma.vendorPaymentLog.create({
    data: {
      paymentId,
      organizationId,
      event,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      actorId: opts.actorId ?? null,
      actorRole: opts.actorRole ?? null,
      detail: opts.detail,
      providerResponse: opts.providerResponse,
    },
  });
}

async function findPayment(organizationId: string, paymentId: string) {
  const payment = await prisma.vendorPayment.findFirst({
    where: { id: paymentId, organizationId, deletedAt: null },
    include: { purchase: { include: { vendor: true } } },
  });
  if (!payment) throw new Error(`Payment ${paymentId} not found in organization ${organizationId}`);
  return payment;
}

/** Sum of already-SUCCESS payments against a purchase, so amount validation and paymentStatus rollup account for partial payments. */
async function amountAlreadyPaid(purchaseId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.vendorPayment.aggregate({
    where: { purchaseId, status: "SUCCESS", deletedAt: null },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

// ---------------------------------------------------------------------------
// Maker: create + submit
// ---------------------------------------------------------------------------

export interface CreatePaymentInput {
  purchaseId: string;
  bankAccountId: string;
  amount: number;
  paymentType: "NEFT" | "RTGS" | "IMPS" | "BULK" | "SCHEDULED";
  scheduledFor?: Date;
  makerNote?: string;
  batchId?: string;
}

export async function createPayment(organizationId: string, input: CreatePaymentInput, actor: Actor) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: input.purchaseId, organizationId, deletedAt: null },
    include: { vendor: true },
  });
  if (!purchase) throw new Error(`Purchase ${input.purchaseId} not found in organization ${organizationId}`);
  if (!purchase.vendor) throw new InvalidPaymentStateError("This bill has no linked vendor record — link a vendor before paying via TBX");
  if (purchase.vendor.tbxBeneficiaryStatus !== "ACTIVE" || purchase.vendor.tbxApprovalStatus !== "APPROVED") {
    throw new InvalidPaymentStateError(`Vendor "${purchase.vendor.name}" is not an approved TBX beneficiary yet — complete beneficiary onboarding first`);
  }

  const bankAccount = await prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, organizationId, deletedAt: null }, select: { id: true } });
  if (!bankAccount) throw new Error(`Bank account ${input.bankAccountId} not found in organization ${organizationId}`);

  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) throw new InvalidPaymentStateError("Payment amount must be greater than zero");
  const alreadyPaid = await amountAlreadyPaid(input.purchaseId);
  const outstanding = new Prisma.Decimal(purchase.totalAmount).sub(alreadyPaid);
  if (amount.gt(outstanding)) {
    throw new InvalidPaymentStateError(`Payment amount ₹${amount.toString()} exceeds the outstanding balance of ₹${outstanding.toString()} on bill ${purchase.purchaseNumber}`);
  }

  const payment = await prisma.vendorPayment.create({
    data: {
      organizationId,
      purchaseId: input.purchaseId,
      bankAccountId: input.bankAccountId,
      amount,
      paymentType: input.paymentType,
      status: "DRAFT",
      scheduledFor: input.scheduledFor,
      makerNote: input.makerNote,
      batchId: input.batchId,
    },
  });

  await appendLog(payment.id, organizationId, "CREATED", { toStatus: "DRAFT", actorId: actor.userId, actorRole: actor.role });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "vendor_payment",
    entityId: payment.id,
    description: `Payment of ₹${amount.toString()} drafted for bill ${purchase.purchaseNumber} (${input.paymentType})`,
    newValue: { purchaseId: input.purchaseId, amount: input.amount, paymentType: input.paymentType },
  });

  log.info("payment created", { organizationId, paymentId: payment.id, purchaseId: input.purchaseId });
  return payment;
}

export async function submitForApproval(organizationId: string, paymentId: string, actor: Actor) {
  const payment = await findPayment(organizationId, paymentId);
  if (payment.status !== "DRAFT") {
    throw new InvalidPaymentStateError(`Payment is in ${payment.status} state — only a DRAFT payment can be submitted for approval`);
  }

  const updated = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "CHECKER_PENDING", makerById: actor.userId, makerAt: new Date() },
  });

  await appendLog(paymentId, organizationId, "SUBMITTED_FOR_APPROVAL", {
    fromStatus: "DRAFT",
    toStatus: "CHECKER_PENDING",
    actorId: actor.userId,
    actorRole: actor.role,
  });

  log.info("payment submitted for approval", { organizationId, paymentId });
  return updated;
}

export async function cancelPayment(organizationId: string, paymentId: string, actor: Actor) {
  const payment = await findPayment(organizationId, paymentId);
  if (payment.status !== "DRAFT" && payment.status !== "CHECKER_PENDING") {
    throw new InvalidPaymentStateError(`Payment is in ${payment.status} state — it can no longer be cancelled`);
  }

  const updated = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED" },
  });

  await appendLog(paymentId, organizationId, "CANCELLED", { fromStatus: payment.status, toStatus: "CANCELLED", actorId: actor.userId, actorRole: actor.role });
  await createAuditLog({ organizationId, userId: actor.userId, action: "UPDATE", entity: "vendor_payment", entityId: paymentId, description: "Payment cancelled before dispatch" });

  log.info("payment cancelled", { organizationId, paymentId });
  return updated;
}

// ---------------------------------------------------------------------------
// Checker: approve / reject
// ---------------------------------------------------------------------------

export async function approvePayment(organizationId: string, paymentId: string, actor: Actor & { canApprove: boolean }) {
  if (!actor.canApprove) {
    throw new InvalidPaymentStateError("Approval requires the banking.approve permission");
  }

  const payment = await findPayment(organizationId, paymentId);
  if (payment.status !== "CHECKER_PENDING") {
    throw new InvalidPaymentStateError(`Payment is in ${payment.status} state — only a CHECKER_PENDING payment can be approved`);
  }
  // Maker-Checker separation of duties: the same person cannot both create
  // and approve a payment, even if they hold both permissions.
  if (payment.makerById && payment.makerById === actor.userId) {
    throw new SameActorApprovalError();
  }

  const updated = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "SUBMITTED", checkerById: actor.userId, checkerAt: new Date() },
  });

  await appendLog(paymentId, organizationId, "APPROVED", { fromStatus: "CHECKER_PENDING", toStatus: "SUBMITTED", actorId: actor.userId, actorRole: actor.role });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "APPROVE",
    entity: "vendor_payment",
    entityId: paymentId,
    description: `Payment of ₹${payment.amount.toString()} approved for dispatch to TBX (${payment.paymentType})`,
  });

  log.info("payment approved", { organizationId, paymentId, checkerById: actor.userId });
  return updated;
}

export async function rejectPayment(organizationId: string, paymentId: string, actor: Actor & { canApprove: boolean }, reason: string) {
  if (!actor.canApprove) {
    throw new InvalidPaymentStateError("Rejection requires the banking.approve permission");
  }

  const payment = await findPayment(organizationId, paymentId);
  if (payment.status !== "CHECKER_PENDING") {
    throw new InvalidPaymentStateError(`Payment is in ${payment.status} state — only a CHECKER_PENDING payment can be rejected`);
  }

  const updated = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED", checkerById: actor.userId, checkerAt: new Date(), rejectionReason: reason },
  });

  await appendLog(paymentId, organizationId, "REJECTED", { fromStatus: "CHECKER_PENDING", toStatus: "CANCELLED", actorId: actor.userId, actorRole: actor.role, detail: reason });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "REJECT",
    entity: "vendor_payment",
    entityId: paymentId,
    description: `Payment rejected by checker: ${reason}`,
  });

  log.info("payment rejected", { organizationId, paymentId, reason });
  return updated;
}

// ---------------------------------------------------------------------------
// Dispatch to TBX — called by Inngest once a checker approves.
// ---------------------------------------------------------------------------

export async function dispatchPaymentToTbx(organizationId: string, paymentId: string): Promise<PaymentActionOutcome> {
  const payment = await findPayment(organizationId, paymentId);
  if (payment.status !== "SUBMITTED") {
    // Already dispatched or moved on — idempotent no-op rather than an error,
    // since Inngest may redeliver this job.
    return { status: "SUCCESS", paymentId };
  }

  const vendor = payment.purchase.vendor;
  if (!vendor?.tbxBeneficiaryId) {
    await finalizePaymentFailure(organizationId, paymentId, { reason: "Vendor has no TBX beneficiary at dispatch time" });
    return { status: "FAILED", paymentId, error: "Vendor has no TBX beneficiary", errorCode: "NO_BENEFICIARY" };
  }

  try {
    const provider = getTbxPaymentProvider();
    const result = await provider.initiatePayment({
      organizationId,
      clientReference: payment.id,
      beneficiaryTbxId: vendor.tbxBeneficiaryId,
      amount: Number(payment.amount),
      paymentType: payment.paymentType,
      narration: `Payment for bill ${payment.purchase.purchaseNumber}`.slice(0, 140),
      scheduledFor: payment.scheduledFor ?? undefined,
    });

    if (result.outcome !== "SUCCESS") {
      throw new TbxPaymentProviderError({ message: "TBX reported a failed payment submission", code: "SUBMIT_FAILED" });
    }

    const update = toPaymentUpdateFromInitiate(result);
    await prisma.vendorPayment.update({
      where: { id: paymentId },
      data: { tbxPaymentId: update.tbxPaymentId, tbxStatus: update.tbxStatus, submittedAt: update.submittedAt, status: "PROCESSING" },
    });

    await appendLog(paymentId, organizationId, "SUBMITTED_TO_TBX", {
      fromStatus: "SUBMITTED",
      toStatus: "PROCESSING",
      detail: `TBX payment id ${update.tbxPaymentId}`,
      providerResponse: (result.raw ?? {}) as Prisma.InputJsonValue,
    });

    log.info("payment dispatched to TBX", { organizationId, paymentId, tbxPaymentId: update.tbxPaymentId });
    return { status: "SUCCESS", paymentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxPaymentProviderError ? err.code : "DISPATCH_ERROR";
    await finalizePaymentFailure(organizationId, paymentId, { reason: message });
    log.error("payment dispatch failed", { organizationId, paymentId, errorCode, error: message });
    return { status: "FAILED", paymentId, error: message, errorCode };
  }
}

// ---------------------------------------------------------------------------
// Poll status — background fallback alongside the webhook (Payment Sync).
// ---------------------------------------------------------------------------

export async function pollPaymentStatus(organizationId: string, paymentId: string): Promise<PaymentActionOutcome> {
  const payment = await findPayment(organizationId, paymentId);
  if (TERMINAL_STATUSES.includes(payment.status)) {
    return { status: "SUCCESS", paymentId }; // already resolved — idempotent no-op
  }
  if (!payment.tbxPaymentId) {
    return { status: "SUCCESS", paymentId }; // not dispatched yet, nothing to poll
  }

  try {
    const provider = getTbxPaymentProvider();
    const result = await provider.fetchPaymentStatus({ organizationId, tbxPaymentId: payment.tbxPaymentId });
    if (result.outcome !== "SUCCESS") {
      throw new TbxPaymentProviderError({ message: "TBX reported a failed status fetch", code: "POLL_FAILED" });
    }

    const update = toPaymentUpdateFromStatus(result);
    if (update.tbxStatus === "SUCCESS") {
      await finalizePaymentSuccess(organizationId, paymentId, { utr: update.tbxUtr, rawResponse: (result.raw ?? {}) as Prisma.InputJsonValue });
    } else if (update.tbxStatus === "FAILED") {
      await finalizePaymentFailure(organizationId, paymentId, { reason: update.failureReason ?? "TBX reported payment failure", rawResponse: (result.raw ?? {}) as Prisma.InputJsonValue });
    } else {
      await prisma.vendorPayment.update({ where: { id: paymentId }, data: { tbxStatus: update.tbxStatus } }).catch(() => {});
    }

    return { status: "SUCCESS", paymentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxPaymentProviderError ? err.code : "POLL_ERROR";
    log.error("payment poll failed", { organizationId, paymentId, errorCode, error: message });
    return { status: "FAILED", paymentId, error: message, errorCode };
  }
}

// ---------------------------------------------------------------------------
// Shared finalizers — called by BOTH the webhook handler and the poll
// fallback above. Idempotent: a payment already in a terminal state is a
// no-op, so a duplicate webhook delivery or a race between webhook and
// poll can never double-post accounting entries.
// ---------------------------------------------------------------------------

export async function finalizePaymentSuccess(
  organizationId: string,
  paymentId: string,
  opts: { utr?: string; rawResponse?: Prisma.InputJsonValue }
): Promise<void> {
  const payment = await findPayment(organizationId, paymentId);
  if (TERMINAL_STATUSES.includes(payment.status)) {
    log.info("payment already terminal — skipping duplicate finalize", { organizationId, paymentId, status: payment.status });
    return;
  }

  const processedAt = new Date();
  const posting = await createDebitJournalEntry(
    organizationId,
    payment.bankAccountId,
    payment.amount,
    `TBX payment for bill ${payment.purchase.purchaseNumber}`,
    processedAt,
    { txnType: "VENDOR_PAYMENT", entityType: "VENDOR_PAYMENT", entityId: payment.id }
  );

  await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "SUCCESS", tbxUtr: opts.utr, tbxStatus: "SUCCESS", processedAt, journalEntryId: posting.journalId },
  });

  const alreadyPaid = await amountAlreadyPaid(payment.purchaseId);
  const fullyPaid = alreadyPaid.gte(new Prisma.Decimal(payment.purchase.totalAmount));
  await prisma.purchase.update({
    where: { id: payment.purchaseId },
    data: { paymentStatus: fullyPaid ? "PAID" : "PARTIAL" },
  });

  await appendLog(paymentId, organizationId, "SUCCEEDED", {
    fromStatus: payment.status,
    toStatus: "SUCCESS",
    detail: opts.utr ? `UTR ${opts.utr}` : undefined,
    providerResponse: opts.rawResponse,
  });
  await createAuditLog({
    organizationId,
    action: "POST",
    entity: "vendor_payment",
    entityId: paymentId,
    description: `TBX payment settled — ₹${payment.amount.toString()} posted to ledger for bill ${payment.purchase.purchaseNumber}`,
    newValue: { journalEntryId: posting.journalId, utr: opts.utr },
  });

  log.info("payment succeeded", { organizationId, paymentId, journalId: posting.journalId });
}

export async function finalizePaymentFailure(
  organizationId: string,
  paymentId: string,
  opts: { reason: string; rawResponse?: Prisma.InputJsonValue }
): Promise<void> {
  const payment = await findPayment(organizationId, paymentId);
  if (TERMINAL_STATUSES.includes(payment.status)) {
    log.info("payment already terminal — skipping duplicate finalize", { organizationId, paymentId, status: payment.status });
    return;
  }

  await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "FAILED", tbxStatus: "FAILED", failureReason: opts.reason.slice(0, 500), processedAt: new Date() },
  });

  await appendLog(paymentId, organizationId, "FAILED", {
    fromStatus: payment.status,
    toStatus: "FAILED",
    detail: opts.reason,
    providerResponse: opts.rawResponse,
  });
  await createAuditLog({
    organizationId,
    action: "UPDATE",
    entity: "vendor_payment",
    entityId: paymentId,
    description: `TBX payment failed: ${opts.reason}`,
  });

  log.warn("payment failed", { organizationId, paymentId, reason: opts.reason });
}
