// ============================================================
// FinRP — TBX Beneficiary route handlers
// Thin handler logic called by app/api/banking/beneficiaries/*.
// Persistence/orchestration lives in beneficiary.service.ts; this
// file only deals with dispatch concerns (rate limiting, Inngest
// enqueue, response shape) — mirrors balance.routes.ts exactly.
// ============================================================

import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

const MIN_RESYNC_INTERVAL_MS = 60_000;

export class BeneficiaryActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BeneficiaryActionError";
  }
}

export interface TriggerBeneficiaryActionResult {
  jobId: string;
  status: "queued";
}

async function dispatch(
  organizationId: string,
  vendorId: string,
  action: "CREATE" | "VERIFY" | "SYNC",
  trigger: "MANUAL" | "SCHEDULED" | "RETRY",
  actorId?: string | null
): Promise<TriggerBeneficiaryActionResult> {
  const jobId = `tbx.beneficiary-sync:${vendorId}:${action.toLowerCase()}:${Date.now()}`;
  await inngest.send({
    name: EVENTS.TBX_BENEFICIARY_SYNC_REQUESTED,
    data: { organizationId, vendorId, action, trigger, actorId: actorId ?? null },
    id: jobId,
  });
  return { jobId, status: "queued" };
}

/** Register the vendor's bank details as a TBX beneficiary. */
export async function triggerBeneficiaryCreate(
  organizationId: string,
  vendorId: string,
  actorId?: string | null
): Promise<TriggerBeneficiaryActionResult> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId, deletedAt: null },
    select: { id: true, bankAccount: true, bankIFSC: true },
  });
  if (!vendor) throw new BeneficiaryActionError("Vendor not found", 404);
  if (!vendor.bankAccount || !vendor.bankIFSC) {
    throw new BeneficiaryActionError("Vendor is missing bank account number / IFSC", 422);
  }
  return dispatch(organizationId, vendorId, "CREATE", "MANUAL", actorId);
}

/** Trigger bank-account verification for an existing TBX beneficiary. */
export async function triggerBeneficiaryVerify(
  organizationId: string,
  vendorId: string,
  actorId?: string | null
): Promise<TriggerBeneficiaryActionResult> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId, deletedAt: null },
    select: { id: true, tbxBeneficiaryId: true },
  });
  if (!vendor) throw new BeneficiaryActionError("Vendor not found", 404);
  if (!vendor.tbxBeneficiaryId) throw new BeneficiaryActionError("Vendor has no TBX beneficiary yet — create one first", 422);
  return dispatch(organizationId, vendorId, "VERIFY", "MANUAL", actorId);
}

/** Refresh beneficiary/verification/approval status from TBX, honoring a same-vendor rate limit unless it's a background trigger. */
export async function triggerBeneficiarySync(
  organizationId: string,
  vendorId: string,
  actorId?: string | null,
  opts: { trigger?: "MANUAL" | "SCHEDULED" | "RETRY"; force?: boolean } = {}
): Promise<TriggerBeneficiaryActionResult> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId, deletedAt: null },
    select: { id: true, tbxBeneficiaryId: true, tbxLastSyncAt: true },
  });
  if (!vendor) throw new BeneficiaryActionError("Vendor not found", 404);
  if (!vendor.tbxBeneficiaryId) throw new BeneficiaryActionError("Vendor has no TBX beneficiary yet — create one first", 422);

  const trigger = opts.trigger ?? "MANUAL";
  if (!opts.force && trigger === "MANUAL" && vendor.tbxLastSyncAt) {
    const msSinceSync = Date.now() - vendor.tbxLastSyncAt.getTime();
    if (msSinceSync < MIN_RESYNC_INTERVAL_MS) {
      throw new BeneficiaryActionError("Synced recently — pass force=true to override", 429);
    }
  }

  return dispatch(organizationId, vendorId, "SYNC", trigger, actorId);
}
