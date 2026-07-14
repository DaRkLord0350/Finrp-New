// ============================================================
// lib/tbx/queue.ts
// Inngest dispatch for TBX verification calls that shouldn't block
// a request (wizard submit, bank re-verification, etc.). Mirrors
// lib/tax/queue.ts's enqueue pattern. The Inngest function
// (inngest/functions/tbx.ts) dispatches by jobName back into
// lib/tbx/service.ts and updates the owning domain record.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

export type TbxJobName =
  | "verifyPan"
  | "verifyGstin"
  | "verifyCin"
  | "verifyAadhaar"
  | "verifyBankAccount"
  | "fetchDirector"
  | "fetchCkyc"
  | "screenAmlPep"
  | "createCustomer";

export interface TbxJobData {
  jobName: TbxJobName;
  organizationId: string;
  userId?: string;
  /** e.g. "organization" | "related_party" | "bank_account" */
  subjectType?: string;
  subjectId?: string;
  /** The verifyX/createCustomer input for this jobName. */
  payload: Record<string, unknown>;
}

/** Enqueue a TBX verification call. Deterministic id collapses duplicate dispatches. */
export async function enqueueTbxVerification(data: TbxJobData): Promise<string> {
  const jobId = `tbx_${data.jobName}_${data.subjectId ?? data.organizationId}_${Date.now()}`;
  await inngest.send({ name: EVENTS.TBX_VERIFICATION_REQUESTED, data, id: jobId });
  return jobId;
}
