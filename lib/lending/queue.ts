// ============================================================
// lib/lending/queue.ts
// Inngest dispatch for lending's async steps (payment-gateway polls).
// Mirrors lib/tbx/queue.ts's enqueue pattern.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

export interface LoanDisbursementPollJobData {
  disbursementId: string;
  organizationId: string;
  actorId: string;
}

export interface LoanCollectionPollJobData {
  repaymentId: string;
  organizationId: string;
}

export async function enqueueDisbursementPoll(data: LoanDisbursementPollJobData): Promise<string> {
  const jobId = `lending_disbursement_poll_${data.disbursementId}`;
  await inngest.send({ name: EVENTS.LENDING_DISBURSEMENT_POLL_REQUESTED, data, id: jobId });
  return jobId;
}

export async function enqueueCollectionPoll(data: LoanCollectionPollJobData): Promise<string> {
  const jobId = `lending_collection_poll_${data.repaymentId}_${Date.now()}`;
  await inngest.send({ name: EVENTS.LENDING_COLLECTION_POLL_REQUESTED, data, id: jobId });
  return jobId;
}
